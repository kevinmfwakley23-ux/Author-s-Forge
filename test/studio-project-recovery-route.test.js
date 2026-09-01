const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { createServer } = require("node:http");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

let child;
let dataDir;
let port;
let base;

async function reservePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const selected = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (!selected) throw new Error("Failed to reserve a Studio recovery test port.");
  return selected;
}

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
  });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { response, body };
}

async function waitForServer(timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child?.exitCode !== null) throw new Error(`Studio exited before startup with code ${child.exitCode}.`);
    try {
      const { response } = await request("/api/health");
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Studio did not become ready at ${base}.`);
}

async function stopServer() {
  if (!child || child.killed) return;
  child.kill("SIGTERM");
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 2000);
    child.once("exit", () => { clearTimeout(timer); resolve(); });
  });
  child = null;
}

function memoryIds(project) {
  return project.memories.map((memory) => memory.id).sort();
}

test.before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "forge-project-recovery-route-"));
  port = await reservePort();
  base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ["dist/studio-server.js"], {
    cwd: process.cwd(),
    env: { ...process.env, HOST: "127.0.0.1", PORT: String(port), FORGE_DATA_DIR: dataDir },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await waitForServer();
});

test.after(async () => {
  await stopServer();
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
});

test("Studio package restore is author-approved, durable, and reversible through the live HTTP route", async () => {
  const projectId = `recovery-route-${process.pid}-${Date.now()}`;
  let result = await request("/api/projects", {
    method: "POST",
    body: JSON.stringify({ id: projectId, title: "Recovery Route Acceptance" }),
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));

  result = await request(`/api/projects/${projectId}/memory`, {
    method: "POST",
    body: JSON.stringify({
      id: "baseline-memory",
      class: "creative-note",
      authority: "working",
      summary: "Baseline",
      content: "State captured before later edits.",
      reference: "studio-project-recovery-route-test",
    }),
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));

  result = await request(`/api/projects/${projectId}/package`);
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  const baselinePackage = result.body;
  assert.equal(baselinePackage.manifest.projectId, projectId);

  result = await request(`/api/projects/${projectId}/memory`, {
    method: "POST",
    body: JSON.stringify({
      id: "later-memory",
      class: "creative-note",
      authority: "working",
      summary: "Later edit",
      content: "This state must survive a refused restore and appear in the rollback package.",
      reference: "studio-project-recovery-route-test",
    }),
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));

  result = await request(`/api/projects/${projectId}/package/restore`, {
    method: "POST",
    body: JSON.stringify({ package: baselinePackage }),
  });
  assert.equal(result.response.status, 400, JSON.stringify(result.body));
  assert.match(JSON.stringify(result.body), /explicit author approval/i);

  result = await request(`/api/projects/${projectId}`);
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  assert.deepEqual(memoryIds(result.body), ["baseline-memory", "later-memory"]);

  const rollbackExportedAt = "2026-09-01T08:45:00.000Z";
  result = await request(`/api/projects/${projectId}/package/restore`, {
    method: "POST",
    body: JSON.stringify({
      authorApproved: true,
      package: baselinePackage,
      rollbackExportedAt,
    }),
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.projectId, projectId);
  assert.deepEqual(memoryIds(result.body.restored), ["baseline-memory"]);
  assert.equal(result.body.rollbackPackage.manifest.projectId, projectId);
  assert.equal(result.body.rollbackPackage.manifest.exportedAt, rollbackExportedAt);
  const rollbackPackage = result.body.rollbackPackage;

  result = await request(`/api/projects/${projectId}`);
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  assert.deepEqual(memoryIds(result.body), ["baseline-memory"]);

  result = await request(`/api/projects/${projectId}/package/restore`, {
    method: "POST",
    body: JSON.stringify({ authorApproved: true, package: rollbackPackage }),
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  assert.deepEqual(memoryIds(result.body.restored), ["baseline-memory", "later-memory"]);

  result = await request(`/api/projects/${projectId}`);
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  assert.deepEqual(memoryIds(result.body), ["baseline-memory", "later-memory"]);
});

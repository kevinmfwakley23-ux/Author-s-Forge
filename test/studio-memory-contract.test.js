const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { createServer } = require("node:http");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const { MEMORY_CLASSES, MEMORY_AUTHORITIES, isMemoryClass, isMemoryAuthority } = require("../dist/domain/memory.js");

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
  if (!selected) throw new Error("Failed to reserve a Studio test port.");
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

test.before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "forge-memory-contract-"));
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

test("Studio memory HTTP boundary accepts every canonical memory class and authority", async () => {
  const projectId = `memory-contract-${process.pid}-${Date.now()}`;
  let result = await request("/api/projects", {
    method: "POST",
    body: JSON.stringify({ id: projectId, title: "Memory Contract Acceptance" }),
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));

  assert.ok(MEMORY_CLASSES.length > 0);
  assert.ok(MEMORY_AUTHORITIES.length > 0);
  assert.ok(MEMORY_CLASSES.every(isMemoryClass));
  assert.ok(MEMORY_AUTHORITIES.every(isMemoryAuthority));

  for (const memoryClass of MEMORY_CLASSES) {
    result = await request(`/api/projects/${projectId}/memory`, {
      method: "POST",
      body: JSON.stringify({
        id: `class-${memoryClass}`,
        class: memoryClass,
        authority: "working",
        summary: `Canonical class ${memoryClass}`,
        content: `Runtime acceptance evidence for ${memoryClass}.`,
        reference: "studio-memory-contract-test",
      }),
    });
    assert.equal(result.response.status, 201, `${memoryClass}: ${JSON.stringify(result.body)}`);
    assert.equal(result.body.class, memoryClass);
  }

  for (const authority of MEMORY_AUTHORITIES) {
    result = await request(`/api/projects/${projectId}/memory`, {
      method: "POST",
      body: JSON.stringify({
        id: `authority-${authority}`,
        class: "creative-note",
        authority,
        summary: `Canonical authority ${authority}`,
        content: `Runtime acceptance evidence for ${authority}.`,
        reference: "studio-memory-contract-test",
      }),
    });
    assert.equal(result.response.status, 201, `${authority}: ${JSON.stringify(result.body)}`);
    assert.equal(result.body.authority, authority);
  }
});

test("Studio memory HTTP boundary rejects values outside the canonical contract", async () => {
  const projectId = `invalid-memory-contract-${process.pid}-${Date.now()}`;
  let result = await request("/api/projects", {
    method: "POST",
    body: JSON.stringify({ id: projectId, title: "Invalid Memory Contract Acceptance" }),
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));

  result = await request(`/api/projects/${projectId}/memory`, {
    method: "POST",
    body: JSON.stringify({ class: "future-memory-that-is-not-canonical", authority: "working", summary: "Invalid class", content: "Must fail closed." }),
  });
  assert.equal(result.response.status, 400);
  assert.match(JSON.stringify(result.body), /invalid memory class/i);

  result = await request(`/api/projects/${projectId}/memory`, {
    method: "POST",
    body: JSON.stringify({ class: "creative-note", authority: "trusted-by-accident", summary: "Invalid authority", content: "Must fail closed." }),
  });
  assert.equal(result.response.status, 400);
  assert.match(JSON.stringify(result.body), /invalid memory authority/i);
});
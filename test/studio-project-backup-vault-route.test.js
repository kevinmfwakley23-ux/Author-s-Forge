const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { createServer } = require("node:http");
const { mkdtemp, rm, stat } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

let child;
let dataDir;
let backupDir;
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
  if (!selected) throw new Error("Failed to reserve a Studio backup-vault test port.");
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

async function startServer() {
  child = spawn(process.execPath, ["dist/studio-server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      FORGE_DATA_DIR: dataDir,
      FORGE_BACKUP_DIR: backupDir,
      OPENAI_API_KEY: "",
      OPENAI_MODEL: "",
      OLLAMA_BASE_URL: "",
      OLLAMA_MODEL: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await waitForServer();
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

function packageProject(pkg) {
  const stateFile = pkg.files.find((file) => file.path === "project-state.json" && file.encoding === "utf8");
  assert.ok(stateFile, "Rollback package must contain project-state.json");
  const envelope = JSON.parse(stateFile.content);
  assert.ok(envelope.project, "Rollback package must contain the Studio project envelope");
  return envelope.project;
}

test.before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "forge-studio-backup-data-"));
  backupDir = await mkdtemp(join(tmpdir(), "forge-studio-backup-vault-"));
  port = await reservePort();
  base = `http://127.0.0.1:${port}`;
  await startServer();
});

test.after(async () => {
  await stopServer();
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
  if (backupDir) await rm(backupDir, { recursive: true, force: true });
});

test("Studio backup vault creates, persists, previews, restores, and deletes author-governed project backups", async () => {
  const projectId = `backup-route-${process.pid}-${Date.now()}`;
  let result = await request("/api/projects", {
    method: "POST",
    body: JSON.stringify({ id: projectId, title: "Backup Vault Acceptance" }),
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));

  result = await request(`/api/projects/${projectId}/memory`, {
    method: "POST",
    body: JSON.stringify({
      id: "baseline-memory",
      class: "creative-note",
      authority: "working",
      summary: "Baseline",
      content: "This state belongs in the durable backup.",
      reference: "studio-project-backup-vault-route-test",
    }),
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));

  result = await request(`/api/projects/${projectId}/backups`, {
    method: "POST",
    body: JSON.stringify({
      exportedAt: "2026-09-01T09:35:00.000Z",
      backupId: `route-${process.pid}`,
    }),
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
  const backup = result.body;
  assert.equal(backup.projectId, projectId);
  assert.match(backup.key, /^backups\/.+\.forge-project\.json$/);
  assert.equal(backup.package.manifest.projectId, projectId);

  const storedPath = join(backupDir, "projects", projectId, ...backup.key.split("/"));
  const storedStat = await stat(storedPath);
  assert.ok(storedStat.isFile());
  assert.ok(storedStat.size > 0);

  result = await request(`/api/projects/${projectId}/backups`);
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.projectId, projectId);
  assert.deepEqual(result.body.backups.map((entry) => entry.key), [backup.key]);

  result = await request(`/api/projects/${projectId}/backups/preview`, {
    method: "POST",
    body: JSON.stringify({ key: backup.key }),
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  assert.deepEqual(memoryIds(result.body.project), ["baseline-memory"]);

  result = await request(`/api/projects/${projectId}/memory`, {
    method: "POST",
    body: JSON.stringify({
      id: "later-memory",
      class: "creative-note",
      authority: "working",
      summary: "Later",
      content: "This state must survive a refused backup restore.",
      reference: "studio-project-backup-vault-route-test",
    }),
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));

  result = await request(`/api/projects/${projectId}/backups/restore`, {
    method: "POST",
    body: JSON.stringify({ key: backup.key }),
  });
  assert.equal(result.response.status, 400, JSON.stringify(result.body));
  assert.match(JSON.stringify(result.body), /explicit author approval/i);

  result = await request(`/api/projects/${projectId}`);
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  assert.deepEqual(memoryIds(result.body), ["baseline-memory", "later-memory"]);

  result = await request(`/api/projects/${projectId}/backups/restore`, {
    method: "POST",
    body: JSON.stringify({
      key: backup.key,
      authorApproved: true,
      rollbackExportedAt: "2026-09-01T09:40:00.000Z",
    }),
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  assert.deepEqual(memoryIds(result.body.restored), ["baseline-memory"]);
  assert.deepEqual(memoryIds(packageProject(result.body.rollbackPackage)), ["baseline-memory", "later-memory"]);

  await stopServer();
  await startServer();

  result = await request(`/api/projects/${projectId}/backups`);
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  assert.deepEqual(result.body.backups.map((entry) => entry.key), [backup.key]);

  result = await request(`/api/projects/${projectId}/backups`, {
    method: "DELETE",
    body: JSON.stringify({ key: backup.key }),
  });
  assert.equal(result.response.status, 400, JSON.stringify(result.body));
  assert.match(JSON.stringify(result.body), /explicit author approval/i);

  result = await request(`/api/projects/${projectId}/backups`, {
    method: "DELETE",
    body: JSON.stringify({ key: backup.key, authorApproved: true }),
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  assert.deepEqual(result.body, { projectId, key: backup.key, deleted: true });

  result = await request(`/api/projects/${projectId}/backups`);
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  assert.deepEqual(result.body.backups, []);

  await assert.rejects(stat(storedPath), (error) => error && error.code === "ENOENT");
});

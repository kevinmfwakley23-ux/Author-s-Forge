const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const port = 4300 + Math.floor(Math.random() * 500);
const base = `http://127.0.0.1:${port}`;
const projectId = `acceptance-${process.pid}-${Date.now()}`;
let child;
let dataDir;

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { response, body };
}

async function waitForServer() {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const { response } = await request('/api/health');
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Studio server did not become ready within 10 seconds.');
}

test.before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'authors-forge-acceptance-'));
  child = spawn(process.execPath, ['dist/studio-server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), FORGE_DATA_DIR: dataDir },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', () => {});
  await waitForServer();
});

test.after(async () => {
  if (child && !child.killed) child.kill('SIGTERM');
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
});

test('running Studio executes a complete durable author workflow without a provider', async () => {
  let result = await request('/');
  assert.equal(result.response.status, 200);
  assert.match(String(result.body), /Author's Forge/);

  result = await request('/api/health');
  assert.equal(result.response.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.ai.openai, false);

  result = await request('/api/projects', {
    method: 'POST',
    body: JSON.stringify({ id: projectId, title: 'Application Acceptance Book' }),
  });
  assert.equal(result.response.status, 201);
  assert.equal(result.body.metadata.id, projectId);

  result = await request(`/api/projects/${projectId}/workspace/books`, {
    method: 'POST',
    body: JSON.stringify({ title: 'Acceptance Book', kind: 'novel', description: 'Application-level verification.' }),
  });
  assert.equal(result.response.status, 201);
  const bookId = result.body.id;

  result = await request(`/api/projects/${projectId}/workspace/books/${bookId}/chapters`, {
    method: 'POST',
    body: JSON.stringify({ number: 1, title: 'Opening', synopsis: 'Establish the opening situation.' }),
  });
  assert.equal(result.response.status, 201);
  const chapterId = result.body.chapters.find((chapter) => chapter.number === 1).id;

  result = await request(`/api/projects/${projectId}/workspace/books/${bookId}/chapters/${chapterId}/scenes`, {
    method: 'POST',
    body: JSON.stringify({ number: 1, title: 'First Scene', synopsis: 'Open on the protagonist.' }),
  });
  assert.equal(result.response.status, 201);
  const sceneId = result.body.chapters.find((chapter) => chapter.id === chapterId).scenes[0].id;

  const content = 'The first scene proves that the manuscript editor writes to durable project state.';
  result = await request(`/api/projects/${projectId}/workspace/books/${bookId}/chapters/${chapterId}/scenes/${sceneId}/content`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.content, content);

  result = await request(`/api/projects/${projectId}/memory`, {
    method: 'POST',
    body: JSON.stringify({ class: 'story-canon', authority: 'authoritative', summary: 'Opening canon', content: 'The opening scene is established.', reference: 'acceptance-test' }),
  });
  assert.equal(result.response.status, 201);

  result = await request(`/api/projects/${projectId}/context`, {
    method: 'POST',
    body: JSON.stringify({ query: 'opening scene' }),
  });
  assert.equal(result.response.status, 200);
  assert.match(JSON.stringify(result.body), /Opening canon/);

  result = await request(`/api/projects/${projectId}/edit`, {
    method: 'POST',
    body: JSON.stringify({ text: content, roles: ['line'], manuscriptId: 'acceptance' }),
  });
  assert.equal(result.response.status, 200);
  assert.ok(Array.isArray(result.body.findings));

  result = await request(`/api/projects/${projectId}/genome`, {
    method: 'POST',
    body: JSON.stringify({ nodes: [{ id: 'opening', label: 'Opening', component: 'chapter', references: [chapterId] }] }),
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.nodes.length, 1);

  result = await request(`/api/projects/${projectId}/genome/impact`, {
    method: 'POST',
    body: JSON.stringify({ nodes: result.body.nodes, changedNodeId: 'opening' }),
  });
  assert.equal(result.response.status, 200);

  result = await request(`/api/projects/${projectId}/health`);
  assert.equal(result.response.status, 200);
  assert.equal(result.body.metrics.books, 1);
  assert.equal(result.body.metrics.chapters, 1);
  assert.equal(result.body.metrics.scenes, 1);
  assert.ok(result.body.metrics.words > 0);
  assert.equal(result.body.readiness.hasWriting, true);

  result = await request(`/api/projects/${projectId}/package`);
  assert.equal(result.response.status, 200);
  assert.equal(result.body.workspace.books[0].chapters[0].scenes[0].content, content);

  result = await request(`/api/projects/${projectId}/ai/draft`, {
    method: 'POST',
    body: JSON.stringify({ bookId, chapterId, focus: 'opening scene', instruction: 'Draft the next scene.' }),
  });
  assert.ok([400, 500].includes(result.response.status));
  assert.match(JSON.stringify(result.body), /provider|OPENAI|Ollama|configured|available/i);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');

const projectId = `acceptance-${process.pid}`;
const port = 4317 + (process.pid % 200);
let server;

async function request(path, options = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
  const text = await response.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  return { response, body };
}

test.before(async () => {
  server = spawn(process.execPath, ['dist/studio-server.js'], {
    env: { ...process.env, PORT: String(port), FORGE_DATA_DIR: `.forge-test-${process.pid}` },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let ready = false;
  server.stdout.on('data', (chunk) => { if (String(chunk).includes(String(port))) ready = true; });
  for (let i = 0; i < 80 && !ready; i += 1) {
    try {
      const result = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (result.ok) { ready = true; break; }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.equal(ready, true, 'Studio server did not become ready');
});

test.after(async () => {
  if (!server) return;
  server.kill('SIGTERM');
  await Promise.race([once(server, 'exit'), new Promise((resolve) => setTimeout(resolve, 1000))]);
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

  const bookId = 'acceptance-book';
  result = await request(`/api/projects/${projectId}/workspace/books`, {
    method: 'POST',
    body: JSON.stringify({ id: bookId, title: 'Acceptance Book', kind: 'novel', description: 'Application-level verification.' }),
  });
  assert.equal(result.response.status, 201);
  assert.equal(result.body.id, bookId);

  const chapterId = 'acceptance-chapter';
  result = await request(`/api/projects/${projectId}/workspace/books/${bookId}/chapters`, {
    method: 'POST',
    body: JSON.stringify({ id: chapterId, number: 1, title: 'Opening', synopsis: 'Establish the opening situation.' }),
  });
  assert.equal(result.response.status, 201);
  assert.equal(result.body.id, chapterId);
  assert.equal(result.body.number, 1);

  const sceneId = 'acceptance-scene';
  result = await request(`/api/projects/${projectId}/workspace/books/${bookId}/chapters/${chapterId}/scenes`, {
    method: 'POST',
    body: JSON.stringify({ id: sceneId, number: 1, title: 'First Scene', synopsis: 'Open on the protagonist.' }),
  });
  assert.equal(result.response.status, 201);
  assert.equal(result.body.id, sceneId);
  assert.equal(result.body.number, 1);

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
  assert.ok(Array.isArray(result.body.records));
  assert.ok(result.body.records.some((record) => record.summary === 'Opening canon'));

  result = await request(`/api/projects/${projectId}/ai/draft`, {
    method: 'POST',
    body: JSON.stringify({ bookId, chapterId, instruction: 'Draft this opening.', focus: 'opening', maxOutputTokens: 100 }),
  });
  assert.equal(result.response.status, 503);
  assert.match(result.body.error, /provider/i);

  result = await request(`/api/projects/${projectId}/workspace`);
  assert.equal(result.response.status, 200);
  const persistedBook = result.body.books.find((book) => book.id === bookId);
  assert.ok(persistedBook);
  const persistedChapter = persistedBook.chapters.find((chapter) => chapter.id === chapterId);
  assert.ok(persistedChapter);
  assert.equal(persistedChapter.scenes.find((scene) => scene.id === sceneId).content, content);
});

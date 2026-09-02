#!/usr/bin/env node
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { spawn } = require('node:child_process');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { chromium } = require('@playwright/test');

const HOST = '127.0.0.1';
const projectId = `architecture-browser-${Date.now()}`;
let providerPayload;

function json(res, status, value) { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)); }
async function readBody(req) { let raw = ''; for await (const chunk of req) raw += String(chunk); return raw ? JSON.parse(raw) : {}; }
async function freePort() {
  const server = createServer();
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, HOST, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}
function architecturePlan() {
  return {
    premise: 'A parent investigates a disappearance while a winter storm seals the mountain city from outside help.',
    themes: ['trust', 'grief', 'memory'],
    audience: 'Adult psychological-thriller readers who expect grounded suspense and escalating personal stakes.',
    genreExpectations: ['Grounded suspense', 'Escalating personal stakes'],
    canonCandidates: ['The disappearance occurred three days before the opening.'],
    characterCandidates: ['The searching parent', 'An investigator with divided loyalties', 'A witness whose knowledge changes the timeline'],
    locations: ['Home', 'Storm-blocked roads', 'Civic records office'],
    timelineConsiderations: ['Track storm closures, travel time, clue discovery order, and who knows each fact.'],
    assumptions: ['The witness may be unreliable, but that is not established canon.'],
    chapterPlan: [
      { number: 1, title: 'The Closed Road', summary: 'Establish the disappearance and isolation.', requiredEvents: ['The last road closes.'], continuityDependencies: [] },
      { number: 2, title: 'The Contradiction', summary: 'Expose evidence that breaks the accepted timeline.', requiredEvents: ['A civic timestamp contradicts the witness.'], continuityDependencies: ['The city is already isolated.'] },
    ],
    scenePlan: [
      { chapterNumber: 1, title: 'Roadblock', summary: 'The parent learns outside help is cut off.', goal: 'Leave for help.', conflict: 'The storm closes the road.', outcome: 'The investigation must continue locally.' },
      { chapterNumber: 2, title: 'Records Desk', summary: 'A public record contradicts the accepted timeline.', goal: 'Confirm the last known time.', conflict: 'The witness account and record disagree.', outcome: 'The timeline becomes uncertain.' },
    ],
    unresolvedQuestions: ['Motive', 'Witness reliability'],
    productionRisks: ['Accidental knowledge leakage', 'Promoting inference into canon without author approval'],
  };
}
async function mockProvider() {
  const server = createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/v1/chat/completions') return json(res, 404, { error: { message: 'not found' } });
    providerPayload = await readBody(req);
    return json(res, 200, {
      id: 'architecture-browser-provider',
      choices: [{ message: { content: JSON.stringify(architecturePlan()) } }],
      usage: { prompt_tokens: 900, completion_tokens: 500, total_tokens: 1400 },
    });
  });
  return new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, HOST, () => resolve(server)); });
}
async function waitForApp(app, url, timeout = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (app.exitCode !== null) throw new Error(`Studio exited before becoming healthy.\n${String(app.__forgeStderr || '').trim()}`);
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}.\n${String(app.__forgeStderr || '').trim()}`);
}
async function api(base, path, method = 'GET', payload) {
  const response = await fetch(base + path, { method, headers: { 'content-type': 'application/json' }, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) });
  const text = await response.text();
  assert.equal(response.ok, true, `${method} ${path}: ${text}`);
  return text ? JSON.parse(text) : {};
}
function startApp(dataDir, port, providerPort) {
  const app = spawn(process.execPath, ['dist/studio-server.js'], {
    env: {
      ...process.env, HOST, PORT: String(port), FORGE_DATA_DIR: dataDir,
      AI_PROVIDER_ORDER: 'omniroute', AI_SPEND_POLICY: 'no-paid-tokens',
      OMNIROUTE_BASE_URL: `http://${HOST}:${providerPort}`, OMNIROUTE_MODEL: 'architecture-browser-model', OMNIROUTE_BILLING_CLASS: 'subscription', OMNIROUTE_API_KEY: '',
      ROUTER9_BASE_URL: '', KINGS_AI_ENDPOINT: '', OPENAI_API_KEY: '', OLLAMA_BASE_URL: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  app.__forgeStderr = '';
  app.stderr.on('data', (chunk) => { app.__forgeStderr += String(chunk); });
  return app;
}
async function stopApp(app) {
  if (!app || app.exitCode !== null) return;
  const exited = new Promise((resolve) => app.once('exit', resolve));
  app.kill('SIGTERM');
  await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 2000))]);
  if (app.exitCode === null) { app.kill('SIGKILL'); await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 1000))]); }
}

async function main() {
  const dataDir = await mkdtemp(join(tmpdir(), 'forge-architecture-browser-'));
  const port = await freePort();
  const provider = await mockProvider();
  const address = provider.address();
  const providerPort = typeof address === 'object' && address ? address.port : 0;
  const app = startApp(dataDir, port, providerPort);
  let browser;
  try {
    const base = `http://${HOST}:${port}`;
    await waitForApp(app, `${base}/api/health`);
    await api(base, '/api/projects', 'POST', { id: projectId, title: 'Canon-Aware Architecture Browser' });
    await api(base, `/api/projects/${projectId}/memory`, 'POST', {
      class: 'story-canon', authority: 'authoritative', summary: 'Winter isolation is binding canon',
      content: 'A severe winter storm isolates the mountain city and blocks normal travel during the disappearance investigation.', reference: 'author-architecture-browser-canon',
    });
    const before = await api(base, `/api/projects/${projectId}/workspace`);
    assert.equal(before.books.length, 0);

    browser = await chromium.launch({ executablePath: process.env.FORGE_BROWSER_EXECUTABLE || chromium.executablePath(), headless: true, args: ['--no-sandbox', '--disable-gpu'] });
    const desktop = await browser.newContext({ viewport: { width: 1365, height: 900 } });
    const page = await desktop.newPage();
    page.on('dialog', (dialog) => dialog.accept());
    await page.goto(`${base}/?project=${projectId}#architecture`, { waitUntil: 'networkidle' });
    await page.locator('#arch-idea').fill('A parent searches for the truth behind a disappearance while the city is cut off from outside help. Preserve established project canon and separate facts from assumptions.');
    await page.locator('#arch-kind').selectOption('psychological-thriller');
    await page.locator('#arch-target').fill('2');
    const generateResponse = page.waitForResponse((response) => response.url().endsWith(`/api/projects/${projectId}/story-architecture/generate`) && response.request().method() === 'POST');
    await page.locator('#arch-run').click();
    assert.equal((await generateResponse).ok(), true);
    await page.waitForFunction(() => document.querySelector('#story-architecture-premise')?.value.includes('winter storm'));
    assert.match(await page.locator('#story-architecture-status').innerText(), /unapproved|not approved/i);
    assert.match(await page.locator('#arch-result').innerText(), /Canon candidates \(not Project Brain canon\)/i);

    const snapshot = await api(base, `/api/projects/${projectId}/story-architecture`);
    assert.equal(snapshot.candidates.length, 1);
    assert.equal(snapshot.candidates[0].approved, false);
    const candidateId = snapshot.candidates[0].id;

    const approveResponse = page.waitForResponse((response) => response.url().endsWith(`/story-architecture/candidates/${candidateId}/approve`) && response.request().method() === 'POST');
    await page.locator('#story-architecture-approve').click();
    assert.equal((await approveResponse).ok(), true);
    await page.waitForFunction(() => /Approved exact architecture/i.test(document.querySelector('#story-architecture-status')?.textContent || ''));

    const seedResponse = page.waitForResponse((response) => response.url().endsWith(`/story-architecture/candidates/${candidateId}/chapter-card-seed`) && response.request().method() === 'POST');
    await page.locator('#story-architecture-seed').click();
    assert.equal((await seedResponse).ok(), true);
    await page.waitForFunction(() => document.querySelector('#chapter-card-workflow-brief')?.value.includes('APPROVED STORY ARCHITECTURE'));
    assert.equal(await page.locator('#chapter-card-workflow-target').inputValue(), '2');
    assert.match(await page.locator('#chapter-card-workflow-events').inputValue(), /last road closes/i);

    assert.ok(providerPayload);
    const system = String(providerPayload.messages?.find((message) => message.role === 'system')?.content || '');
    const user = String(providerPayload.messages?.find((message) => message.role === 'user')?.content || '');
    assert.match(system, /winter storm isolates the mountain city/i, 'durable Project Brain canon must reach architecture provider context');
    assert.match(user, /TARGET CHAPTERS: 2/);
    assert.match(user, /psychological-thriller/);

    const after = await api(base, `/api/projects/${projectId}/workspace`);
    assert.equal(after.books.length, 0, 'architecture approval/seed must not create manuscript structure');
    const project = await api(base, `/api/projects/${projectId}`);
    assert.equal(project.memories.filter((memory) => memory.class === 'story-canon').length, 1, 'architecture approval must not promote canon candidates');

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => /Approved exact architecture/i.test(document.querySelector('#story-architecture-status')?.textContent || ''));
    await desktop.close();

    const mobile = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
    const mobilePage = await mobile.newPage();
    await mobilePage.goto(`${base}/?project=${projectId}#architecture`, { waitUntil: 'networkidle' });
    const box = await mobilePage.locator('#story-architecture-seed').boundingBox();
    assert.ok(box && box.width > 0 && box.height >= 40, 'architecture downstream action must remain touch-usable on Android-sized viewport');
    const overflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 2, `architecture view must not horizontally overflow Android viewport (overflow=${overflow})`);
    await mobile.close();

    console.log('STORY ARCHITECTURE BROWSER ACCEPTANCE PASSED: real provider + durable structured candidate + exact approval + restart persistence + approved Chapter Card seed + no manuscript/canon mutation + Android touch/fit.');
  } finally {
    if (browser) await browser.close().catch(() => {});
    await stopApp(app);
    provider.close();
    await rm(dataDir, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });

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

function json(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(value));
}

async function readBody(req) {
  let raw = '';
  for await (const chunk of req) raw += String(chunk);
  return raw ? JSON.parse(raw) : {};
}

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

async function mockProvider() {
  const server = createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/v1/chat/completions') return json(res, 404, { error: { message: 'not found' } });
    providerPayload = await readBody(req);
    const text = [
      'Premise: A parent investigates a disappearance while a winter storm seals the mountain city from outside help.',
      'Themes: trust, grief, memory, and the cost of choosing certainty over connection.',
      'Audience: adult psychological-thriller readers who expect grounded suspense and escalating personal stakes.',
      'Canon candidates: preserve the isolated mountain-city setting and treat every new factual detail as a candidate until the author approves it.',
      'Character candidates: the searching parent, the missing person, an investigator with divided loyalties, and a witness whose knowledge changes the apparent timeline.',
      'Locations: home, storm-blocked roads, a civic records office, and one controlled reveal location.',
      'Timeline considerations: track storm closures, travel time, who knows each clue, and the exact order of discoveries.',
      'Chapter plan: establish the disappearance, tighten isolation, expose contradictory evidence, force a costly choice, reveal the hidden relationship, and resolve the central question without changing established canon.',
      'Scene plan: every scene should carry an objective, obstacle, new information, continuity dependency, emotional turn, and exit hook.',
      'Unresolved questions: motive, reliability of the witness, and which facts the author wants locked before drafting.',
      'Production risks: accidental knowledge leakage, timeline compression, and promoting an inference into canon without author approval.',
    ].join('\n\n');
    return json(res, 200, {
      id: 'architecture-browser-provider',
      choices: [{ message: { content: text } }],
      usage: { prompt_tokens: 900, completion_tokens: 260, total_tokens: 1160 },
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, HOST, () => resolve(server));
  });
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
  const response = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
  const text = await response.text();
  assert.equal(response.ok, true, `${method} ${path}: ${text}`);
  return text ? JSON.parse(text) : {};
}

function startApp(dataDir, port, providerPort) {
  const app = spawn(process.execPath, ['dist/studio-server.js'], {
    env: {
      ...process.env,
      HOST,
      PORT: String(port),
      FORGE_DATA_DIR: dataDir,
      AI_PROVIDER_ORDER: 'omniroute',
      AI_SPEND_POLICY: 'no-paid-tokens',
      OMNIROUTE_BASE_URL: `http://${HOST}:${providerPort}`,
      OMNIROUTE_MODEL: 'architecture-browser-model',
      OMNIROUTE_BILLING_CLASS: 'subscription',
      OMNIROUTE_API_KEY: '',
      ROUTER9_BASE_URL: '',
      KINGS_AI_ENDPOINT: '',
      OPENAI_API_KEY: '',
      OLLAMA_BASE_URL: '',
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
  if (app.exitCode === null) {
    app.kill('SIGKILL');
    await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 1000))]);
  }
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
      class: 'story-canon',
      authority: 'authoritative',
      summary: 'Winter isolation is binding canon',
      content: 'A severe winter storm isolates the mountain city and blocks normal travel during the disappearance investigation.',
      reference: 'author-architecture-browser-canon',
    });

    const before = await api(base, `/api/projects/${projectId}/workspace`);
    assert.equal(before.books.length, 0, 'architecture candidate test must begin without manuscript structure');

    browser = await chromium.launch({ executablePath: process.env.FORGE_BROWSER_EXECUTABLE || chromium.executablePath(), headless: true, args: ['--no-sandbox', '--disable-gpu'] });
    const desktop = await browser.newContext({ viewport: { width: 1365, height: 900 } });
    const page = await desktop.newPage();
    await page.goto(`${base}/?project=${projectId}#architecture`, { waitUntil: 'networkidle' });
    await page.locator('#arch-idea').fill('A parent searches for the truth behind a disappearance while the city is cut off from outside help. Preserve established project canon and separate facts from assumptions.');
    await page.locator('#arch-kind').selectOption('psychological-thriller');
    await page.locator('#arch-target').fill('22');
    const responsePromise = page.waitForResponse((response) => response.url().endsWith(`/api/projects/${projectId}/ai/architecture`) && response.request().method() === 'POST');
    await page.locator('#arch-run').click();
    const response = await responsePromise;
    assert.equal(response.ok(), true, await response.text());
    const result = await response.json();
    assert.equal(result.candidate, true);
    assert.equal(result.authorApprovalRequired, true);
    assert.equal(result.contextBoundary, 'project-brain');
    await page.waitForFunction(() => document.querySelector('#arch-result')?.textContent.includes('Premise:'));
    assert.match(await page.locator('#success-banner').innerText(), /Nothing was added to manuscript or canon/i);
    assert.match(await page.locator('#arch-result').innerText(), /Production risks:/);
    await desktop.close();

    assert.ok(providerPayload, 'real browser action must reach the configured provider boundary');
    const system = String(providerPayload.messages?.find((message) => message.role === 'system')?.content || '');
    const user = String(providerPayload.messages?.find((message) => message.role === 'user')?.content || '');
    assert.match(system, /winter storm isolates the mountain city/i, 'durable Project Brain canon must reach the provider context');
    assert.match(user, /TARGET CHAPTERS: 22/);
    assert.match(user, /psychological-thriller/);

    const after = await api(base, `/api/projects/${projectId}/workspace`);
    assert.equal(after.books.length, 0, 'architecture generation must remain candidate-only and must not create manuscript structure');
    const project = await api(base, `/api/projects/${projectId}`);
    assert.equal(project.memories.filter((memory) => memory.class === 'story-canon').length, 1, 'architecture generation must not silently promote new canon');

    const mobile = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
    const mobilePage = await mobile.newPage();
    await mobilePage.goto(`${base}/?project=${projectId}#architecture`, { waitUntil: 'networkidle' });
    const box = await mobilePage.locator('#arch-run').boundingBox();
    assert.ok(box && box.width > 0 && box.height >= 40, 'architecture action must remain touch-usable on Android-sized viewport');
    const overflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 2, `architecture view must not horizontally overflow Android viewport (overflow=${overflow})`);
    await mobile.close();

    console.log('STORY ARCHITECTURE BROWSER ACCEPTANCE PASSED: real UI route + Project Brain canon context + candidate-only author control + no manuscript/canon mutation + Android touch/fit.');
  } finally {
    if (browser) await browser.close().catch(() => {});
    await stopApp(app);
    provider.close();
    await rm(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

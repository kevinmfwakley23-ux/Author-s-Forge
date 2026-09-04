#!/usr/bin/env node
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtemp, rm, readFile, stat } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { chromium } = require('@playwright/test');

const HOST = '127.0.0.1';
const PORT = 6130 + Math.floor(Math.random() * 80);
const PROJECT_ID = 'media-studio-acceptance';

async function waitForHttp(url, timeoutMs = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function api(base, path, method = 'GET', payload) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${method} ${path} failed (${response.status}): ${body.error || JSON.stringify(body)}`);
  return body;
}

async function main() {
  const dataDir = await mkdtemp(join(tmpdir(), 'forge-media-studio-'));
  const server = spawn(process.execPath, ['dist/studio-server.js'], {
    env: {
      ...process.env,
      HOST,
      PORT: String(PORT),
      FORGE_DATA_DIR: dataDir,
      OPENAI_API_KEY: '', OPENAI_MODEL: '', OLLAMA_BASE_URL: '', OLLAMA_MODEL: '',
      KINGS_AI_ENDPOINT: '', OMNIROUTE_BASE_URL: '', ROUTER9_BASE_URL: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let browser;
  try {
    const base = `http://${HOST}:${PORT}`;
    await waitForHttp(`${base}/api/health`);
    await api(base, '/api/projects', 'POST', { id: PROJECT_ID, title: 'Design Motion Acceptance' });

    browser = await chromium.launch({ executablePath: process.env.FORGE_BROWSER_EXECUTABLE || chromium.executablePath(), headless: true, args: ['--no-sandbox', '--disable-gpu'] });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, acceptDownloads: true });
    const page = await context.newPage();
    await page.goto(`${base}/forge-media-studio.html?project=${PROJECT_ID}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelector('#media-canvas')?.width > 0);

    assert.equal(await page.locator('#media-project').inputValue(), PROJECT_ID);
    assert.equal(await page.locator('#media-modes [data-mode="calendar"]').count(), 1);
    assert.equal(await page.locator('#media-modes [data-mode="advertisement"]').count(), 1);
    assert.equal(await page.locator('#media-modes [data-mode="daily-planner"]').count(), 1);
    assert.equal(await page.locator('#media-modes [data-mode="meme"]').count(), 1);
    assert.equal(await page.locator('#media-modes [data-mode="gif"]').count(), 1);
    assert.equal(await page.locator('#media-modes [data-mode="stop-motion"]').count(), 1);

    await page.locator('#media-title').fill('Royal Calendar Proof');
    await page.locator('#media-save').tap();
    await page.waitForFunction(() => document.querySelector('#media-status')?.textContent.includes('Saved Calendar Office'));
    const project = await api(base, `/api/projects/${PROJECT_ID}`);
    const memory = project.memories.find((item) => item.relevanceTags?.includes('forge-media-studio:calendar'));
    assert.ok(memory, 'calendar office should create durable Project Brain working memory');
    assert.equal(memory.class, 'creative-note');
    assert.equal(memory.authority, 'working');

    await page.locator('#media-modes [data-mode="advertisement"]').tap();
    await page.locator('[data-field="adPreset"]').selectOption('story');
    await page.waitForFunction(() => document.querySelector('#media-canvas')?.height === 1920);
    const adSize = await page.locator('#media-canvas').evaluate((node) => ({ width: node.width, height: node.height }));
    assert.deepEqual(adSize, { width: 1080, height: 1920 });

    await page.locator('#media-modes [data-mode="gif"]').tap();
    await page.waitForFunction(() => document.querySelectorAll('#media-frame-list .media-frame').length >= 2);
    const gifDownloadPromise = page.waitForEvent('download');
    await page.locator('#media-export-gif').tap();
    const gifDownload = await gifDownloadPromise;
    const gifPath = join(dataDir, 'proof.gif');
    await gifDownload.saveAs(gifPath);
    assert.ok((await stat(gifPath)).size > 500, 'GIF export should contain real encoded bytes');
    const gifBytes = await readFile(gifPath);
    assert.equal(gifBytes.subarray(0, 6).toString('ascii'), 'GIF89a');
    assert.equal(gifBytes.at(-1), 0x3b, 'GIF should contain a trailer byte');
    const gifBase64 = gifBytes.toString('base64');
    const decodedGif = await page.evaluate(async (encoded) => new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => resolve(null);
      image.src = `data:image/gif;base64,${encoded}`;
    }), gifBase64);
    assert.ok(decodedGif && decodedGif.width > 0 && decodedGif.height > 0, `browser must decode exported GIF: ${JSON.stringify(decodedGif)}`);

    await page.locator('#media-modes [data-mode="stop-motion"]').tap();
    assert.equal(await page.locator('#media-export-video').isEnabled(), true);
    const videoCapability = await page.evaluate(() => ({
      mediaRecorder: typeof MediaRecorder !== 'undefined',
      captureStream: typeof document.createElement('canvas').captureStream === 'function',
      supported: typeof MediaRecorder !== 'undefined' && typeof document.createElement('canvas').captureStream === 'function' && ['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm','video/mp4'].some((mime) => !MediaRecorder.isTypeSupported || MediaRecorder.isTypeSupported(mime)),
    }));
    assert.equal(typeof videoCapability.mediaRecorder, 'boolean');
    assert.equal(typeof videoCapability.captureStream, 'boolean');
    if (videoCapability.supported) {
      const videoDownloadPromise = page.waitForEvent('download', { timeout: 15000 });
      await page.locator('#media-export-video').tap();
      const videoDownload = await videoDownloadPromise;
      const suffix = /\.mp4$/i.test(videoDownload.suggestedFilename()) ? 'mp4' : 'webm';
      const videoPath = join(dataDir, `proof.${suffix}`);
      await videoDownload.saveAs(videoPath);
      assert.ok((await stat(videoPath)).size > 1000, 'stop-motion export should contain real recorded video bytes');
    } else {
      await page.locator('#media-export-video').tap();
      await page.waitForFunction(() => /does not expose MediaRecorder|reports no supported MediaRecorder/.test(document.querySelector('#media-status')?.textContent || ''));
    }

    const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, body: document.body.scrollWidth, document: document.documentElement.scrollWidth }));
    assert.ok(dimensions.body <= dimensions.viewport + 1, `Design & Motion body overflowed mobile viewport: ${JSON.stringify(dimensions)}`);
    assert.ok(dimensions.document <= dimensions.viewport + 1, `Design & Motion document overflowed mobile viewport: ${JSON.stringify(dimensions)}`);
    const saveBox = await page.locator('#media-save').boundingBox();
    assert.ok(saveBox && saveBox.height >= 40, `Design & Motion save control is too small for touch: ${JSON.stringify(saveBox)}`);

    console.log('FORGE DESIGN & MOTION BROWSER ACCEPTANCE PASSED: six offices + durable working memory + ad presets + browser-decodable GIF89a + real stop-motion bytes when supported + Android layout.');
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill('SIGTERM');
    await new Promise((resolve) => server.exitCode !== null ? resolve() : server.once('exit', resolve));
    await rm(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });

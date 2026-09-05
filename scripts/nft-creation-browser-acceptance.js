#!/usr/bin/env node
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtemp, rm, readFile, stat } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { chromium } = require('@playwright/test');

const HOST = '127.0.0.1';
const PORT = 6570 + Math.floor(Math.random() * 90);
const PROJECT_ID = 'nft-office-acceptance';
const COLLECTION_ID = 'royal-beasts';

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
  const text = await response.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { throw new Error(`${method} ${path} returned invalid JSON (${response.status})`); }
  if (!response.ok) throw new Error(`${method} ${path} failed (${response.status}): ${body.error || JSON.stringify(body)}`);
  return body;
}

async function main() {
  const dataDir = await mkdtemp(join(tmpdir(), 'forge-nft-office-'));
  const server = spawn(process.execPath, ['dist/nft-creation-server.js'], {
    env: {
      ...process.env,
      HOST,
      NFT_PORT: String(PORT),
      FORGE_DATA_DIR: dataDir,
      OPENAI_API_KEY: '', OPENAI_MODEL: '', OLLAMA_BASE_URL: '', OLLAMA_MODEL: '',
      KINGS_AI_ENDPOINT: '', OMNIROUTE_BASE_URL: '', OMNIROUTE_API_KEY: '', ROUTER9_BASE_URL: '', ROUTER9_API_KEY: '',
      GROQ_API_KEY: '', MISTRAL_API_KEY: '', GEMINI_API_KEY: '', ANTHROPIC_API_KEY: '', OPENROUTER_API_KEY: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let browser;
  try {
    const base = `http://${HOST}:${PORT}`;
    await waitForHttp(`${base}/api/health`);
    const health = await api(base, '/api/health');
    assert.equal(health.service, 'authors-forge-nft-creation-office');
    assert.deepEqual(health.tokenStandards, ['erc-721', 'erc-1155', 'metaplex-core']);

    await api(base, '/api/projects', 'POST', { id: PROJECT_ID, title: 'NFT Acceptance Project' });
    await api(base, `/api/projects/${PROJECT_ID}/nft`, 'POST', {
      id: COLLECTION_ID,
      title: 'Royal Beasts', symbol: 'RBEAST', description: 'Original heraldic creatures forged as a coherent collectible series.',
      collectionType: 'generative-series', tokenStandard: 'erc-721', chain: 'base', supply: 4, seed: 'acceptance-seed', royaltyBps: 500, storageMode: 'ipfs',
      audience: 'Collectors interested in original heraldic fantasy character art.',
      artisticThesis: 'Each creature looks like a royal crest that became alive.',
      styleGuide: 'Sculptural silhouettes, black marble shadows, restrained gold, no text.',
      lore: 'Four houses contest the last forge crown.',
      rightsNote: 'Original author-directed artwork only; every source is declared before use.',
    });
    const traits = [
      { id: 'house', label: 'House', values: [{ value: 'Sun', weight: 1 }, { value: 'Moon', weight: 1 }] },
      { id: 'crown', label: 'Crown', values: [{ value: 'Gold', weight: 1 }, { value: 'Obsidian', weight: 1 }] },
    ];
    await api(base, `/api/projects/${PROJECT_ID}/nft/${COLLECTION_ID}/traits`, 'PUT', { traits });
    const manifest = await api(base, `/api/projects/${PROJECT_ID}/nft/${COLLECTION_ID}/manifest`, 'POST', {});
    assert.equal(manifest.items.length, 4);
    const signatures = manifest.items.map((item) => item.attributes.map((attribute) => `${attribute.traitId}:${attribute.value}`).join('|'));
    assert.equal(new Set(signatures).size, 4);

    for (const item of manifest.items) {
      const attached = await api(base, `/api/projects/${PROJECT_ID}/nft/${COLLECTION_ID}/art/${item.tokenId}/author`, 'POST', {
        imageUri: `ipfs://bafy-acceptance/${item.tokenId}.png`,
        sourceReference: `acceptance-author-art-${item.tokenId}`,
        authorDeclaresRights: true,
      });
      assert.equal(attached.items.find((candidate) => candidate.tokenId === item.tokenId).artworkStatus, 'approved');
    }
    await api(base, `/api/projects/${PROJECT_ID}/nft/${COLLECTION_ID}/launch-plan`, 'PUT', {
      launchPlan: {
        mintType: 'scheduled-drop', reveal: 'post-mint',
        phases: [{ name: 'Allowlist', audience: 'Early community', allowlistRequired: true }, { name: 'Public', audience: 'Public collectors', allowlistRequired: false }],
        story: 'Meet the four houses, understand the art process, then reveal each crest after mint.',
        roadmap: ['Publish a provenance archive', 'Release process notes'],
        communityPlan: ['Share art process openly', 'Explain traits and rarity without investment language'],
      },
    });
    const preflight = await api(base, `/api/projects/${PROJECT_ID}/nft/${COLLECTION_ID}/preflight`);
    assert.equal(preflight.errors, 0);
    assert.equal(preflight.readyForMetadata, true);
    assert.equal(preflight.readyForLaunchPackage, true);
    assert.ok(preflight.collectorReadiness >= 90);

    const project = await api(base, `/api/projects/${PROJECT_ID}`);
    const artMemories = (project.memories || []).filter((memory) => memory.relevanceTags?.includes('nft-artwork'));
    assert.equal(artMemories.length, 4, 'author artwork should create provenance memories');
    assert.ok(artMemories.every((memory) => memory.content.includes('Author explicitly declared')));

    browser = await chromium.launch({ executablePath: process.env.FORGE_BROWSER_EXECUTABLE || chromium.executablePath(), headless: true, args: ['--no-sandbox', '--disable-gpu'] });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, acceptDownloads: true });
    const page = await context.newPage();
    await page.goto(`${base}/?project=${PROJECT_ID}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelector('#nft-current-title')?.textContent === 'Royal Beasts');
    assert.equal(await page.locator('#nft-tabs [data-view]').count(), 6);
    assert.match(await page.locator('#nft-current-meta').textContent(), /erc-721/i);

    await page.locator('#nft-tabs [data-view="metadata"]').tap();
    await page.waitForFunction(() => /0 error\(s\)/.test(document.querySelector('#nft-preflight')?.textContent || ''));
    assert.match(await page.locator('#nft-readiness-score').textContent(), /\d+%/);

    await page.locator('#nft-build-package').tap();
    await page.waitForFunction(() => !document.querySelector('#nft-download-package')?.disabled);
    assert.match(await page.locator('#nft-package-preview').textContent(), /No mint or upload was claimed|metadataFileCount|contractGuidance/i);

    const packageDownloadPromise = page.waitForEvent('download');
    await page.locator('#nft-download-package').tap();
    const packageDownload = await packageDownloadPromise;
    const packagePath = join(dataDir, 'nft-launch-package.json');
    await packageDownload.saveAs(packagePath);
    assert.ok((await stat(packagePath)).size > 1000);
    const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
    assert.equal(packageJson.kind, 'forge-nft-launch-package');
    assert.equal(packageJson.metadataFiles.length, 4);
    assert.match(packageJson.notes.join(' '), /does not deploy a contract, mint tokens/i);

    const csvDownloadPromise = page.waitForEvent('download');
    await page.locator('#nft-download-csv').tap();
    const csvDownload = await csvDownloadPromise;
    const csvPath = join(dataDir, 'nft-metadata.csv');
    await csvDownload.saveAs(csvPath);
    const csv = await readFile(csvPath, 'utf8');
    assert.match(csv, /^token_id,name,description,image,House,Crown/m);
    assert.match(csv, /ipfs:\/\/bafy-acceptance\/1\.png/);

    await page.locator('#nft-tabs [data-view="ai"]').tap();
    await page.locator('#nft-ai-form textarea[name="instruction"]').fill('Strengthen the collection strategy without promising sales or investment returns.');
    const responsePromise = page.waitForResponse((response) => response.url().endsWith('/ai/propose') && response.request().method() === 'POST');
    await page.locator('#nft-ai-form button[type="submit"]').tap();
    const aiResponse = await responsePromise;
    assert.equal(aiResponse.status(), 400);
    await page.waitForFunction(() => /No AI provider is configured|could not complete/i.test(document.querySelector('#nft-status')?.textContent || ''));
    assert.equal(await page.locator('#nft-proposals .nft-proposal').count(), 0, 'Forge must not fabricate an AI proposal without a provider');

    const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, body: document.body.scrollWidth, document: document.documentElement.scrollWidth }));
    assert.ok(dimensions.body <= dimensions.viewport + 1, `NFT Office body overflowed mobile viewport: ${JSON.stringify(dimensions)}`);
    assert.ok(dimensions.document <= dimensions.viewport + 1, `NFT Office document overflowed mobile viewport: ${JSON.stringify(dimensions)}`);
    const preflightButton = await page.locator('#nft-preflight-top').boundingBox();
    assert.ok(preflightButton && preflightButton.height >= 40, `NFT preflight control is too small for touch: ${JSON.stringify(preflightButton)}`);

    console.log('NFT CREATION OFFICE BROWSER ACCEPTANCE PASSED: durable collection + deterministic unique traits + provenance-gated author art + launch plan + real JSON/CSV package + honest no-provider AI failure + Android layout.');
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill('SIGTERM');
    await new Promise((resolve) => server.exitCode !== null ? resolve() : server.once('exit', resolve));
    await rm(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });

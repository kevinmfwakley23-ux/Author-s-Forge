#!/usr/bin/env node
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtemp, rm, readFile, stat } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { chromium } = require('@playwright/test');

const HOST = '127.0.0.1';
const PORT = 6680 + Math.floor(Math.random() * 70);
const PROJECT_ID = 'nft-production-director-acceptance';
const SERIES_ID = 'royal-series';

async function waitForHttp(url, timeoutMs = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function api(base, path, method = 'GET', payload, allowFailure = false) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
  const text = await response.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!allowFailure && !response.ok) throw new Error(`${method} ${path} failed (${response.status}): ${body.error || JSON.stringify(body)}`);
  return { response, body };
}

function collectionInput(id, title, symbol, artUri) {
  return {
    id, title, symbol, description: `${title} is one chapter in an original heraldic creature series.`,
    collectionType: 'one-of-one', tokenStandard: 'erc-721', chain: 'base', supply: 1, storageMode: 'ipfs', royaltyBps: 500,
    audience: 'Collectors of original heraldic fantasy art.',
    artisticThesis: 'Heraldic visual language becomes a living creature without copying an existing collection.',
    styleGuide: 'Strong silhouette, black/ivory foundation, restrained gold, engraved texture, no text.',
    lore: 'Each collection reveals one house in the same original world.',
    rightsNote: 'Every final artwork requires author or Image Lab provenance before release.',
    artUri,
  };
}

async function createReadyCollection(base, input) {
  await api(base, `/api/projects/${PROJECT_ID}/nft`, 'POST', input);
  const { body: manifest } = await api(base, `/api/projects/${PROJECT_ID}/nft/${input.id}/manifest`, 'POST', {});
  assert.equal(manifest.items.length, 1);
  const { body: attached } = await api(base, `/api/projects/${PROJECT_ID}/nft/${input.id}/art/1/author`, 'POST', {
    imageUri: input.artUri,
    sourceReference: `${input.id}-original-source.psd`,
    authorDeclaresRights: true,
  });
  assert.equal(attached.items[0].artworkStatus, 'approved');
  await api(base, `/api/projects/${PROJECT_ID}/nft/${input.id}/launch-plan`, 'PUT', {
    launchPlan: {
      mintType: 'scheduled-drop', reveal: 'instant',
      phases: [{ name: 'Public', audience: 'Public collectors', start: input.id === 'alpha' ? '2026-10-01T17:00:00.000Z' : '2026-10-24T17:00:00.000Z', allowlistRequired: false }],
      story: `Introduce ${input.title} as an original art release inside the Royal Series.`,
      roadmap: ['Publish provenance bundle'],
      communityPlan: ['Share process transparently and avoid investment language'],
    },
  });
}

async function main() {
  const dataDir = await mkdtemp(join(tmpdir(), 'forge-nft-production-director-'));
  const server = spawn(process.execPath, ['dist/nft-creation-server.js'], {
    env: {
      ...process.env,
      HOST,
      NFT_PORT: String(PORT),
      FORGE_DATA_DIR: dataDir,
      PINATA_JWT: '', PINATA_GROUP_ID: '',
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
    const { body: health } = await api(base, '/api/health');
    assert.equal(health.externalStorage.pinataPublicIpfsConfigured, false);
    assert.equal(health.minting.walletSigningConfigured, false);

    await api(base, '/api/projects', 'POST', { id: PROJECT_ID, title: 'NFT Production Director Acceptance' });
    await createReadyCollection(base, collectionInput('alpha', 'Royal Alpha', 'RALPHA', 'ipfs://bafy-alpha/art.png'));
    await createReadyCollection(base, collectionInput('beta', 'Royal Beta', 'RBETA', 'ipfs://bafy-beta/art.png'));

    const { body: series } = await api(base, `/api/projects/${PROJECT_ID}/nft-series`, 'POST', {
      id: SERIES_ID,
      title: 'Royal Series',
      thesis: 'One original heraldic world expressed through distinct creature releases.',
      audience: 'Collectors of original fantasy art and visual worldbuilding.',
      collectionIds: ['alpha', 'beta'],
      sets: [{ id: 'genesis', title: 'Genesis Set', collectionIds: ['alpha', 'beta'], releaseOrder: ['alpha', 'beta'], positioningNote: 'Alpha establishes the visual language; Beta expands the world.' }],
      rules: {
        sharedStylePrinciples: ['strong silhouette', 'restrained gold'],
        sharedLoreRules: ['house symbolism remains consistent'],
        provenanceRequirements: ['author or Image Lab provenance on every final artwork'],
        minimumDaysBetweenDrops: 14,
        maxConcurrentLaunches: 1,
      },
    });
    assert.equal(series.id, SERIES_ID);

    const { body: qa } = await api(base, `/api/projects/${PROJECT_ID}/nft-series/${SERIES_ID}/qa`, 'POST', {});
    assert.equal(qa.errors, 0);
    assert.equal(qa.readyForSeriesLaunch, true);
    assert.equal(qa.collectionCount, 2);
    assert.equal(qa.approvedArtworkCount, 2);

    const { body: storagePlan } = await api(base, `/api/projects/${PROJECT_ID}/nft/alpha/storage/plan`, 'POST', {});
    assert.equal(storagePlan.configured, false);
    assert.equal(storagePlan.existingIpfsMedia, 1);
    assert.equal(storagePlan.mediaUploadsRequired, 0);
    assert.equal(storagePlan.estimatedUploads, 2, 'one metadata upload + one manifest upload');

    browser = await chromium.launch({ executablePath: process.env.FORGE_BROWSER_EXECUTABLE || chromium.executablePath(), headless: true, args: ['--no-sandbox', '--disable-gpu'] });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, acceptDownloads: true });
    const page = await context.newPage();
    await page.goto(`${base}/?project=${PROJECT_ID}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#nft-production-director');
    await page.waitForFunction(() => document.querySelectorAll('#nft-series-select option').length >= 2);

    const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, body: document.body.scrollWidth, document: document.documentElement.scrollWidth }));
    assert.ok(dimensions.body <= dimensions.viewport + 1, `Production Director body overflowed mobile viewport: ${JSON.stringify(dimensions)}`);
    assert.ok(dimensions.document <= dimensions.viewport + 1, `Production Director document overflowed mobile viewport: ${JSON.stringify(dimensions)}`);

    await page.locator('#nft-series-select').selectOption(SERIES_ID);
    await page.waitForFunction(() => document.querySelector('#nft-series-form input[name="title"]')?.value === 'Royal Series');
    assert.equal(await page.locator('#nft-series-qa').isDisabled(), false);
    await page.locator('#nft-series-qa').tap();
    await page.waitForFunction(() => /"readyForSeriesLaunch": true/.test(document.querySelector('#nft-series-output')?.textContent || ''));
    assert.match(await page.locator('#nft-series-output').textContent(), /"collectionCount": 2/);
    const qaButton = await page.locator('#nft-series-qa').boundingBox();
    assert.ok(qaButton && qaButton.height >= 40, `Series QA control is too small for touch: ${JSON.stringify(qaButton)}`);

    const provenanceDownloadPromise = page.waitForEvent('download');
    await page.locator('#nft-series-provenance').tap();
    const provenanceDownload = await provenanceDownloadPromise;
    const provenancePath = join(dataDir, 'series-provenance.json');
    await provenanceDownload.saveAs(provenancePath);
    assert.ok((await stat(provenancePath)).size > 1000);
    const provenance = JSON.parse(await readFile(provenancePath, 'utf8'));
    assert.equal(provenance.kind, 'forge-nft-series-provenance-bundle');
    assert.equal(provenance.collections.length, 2);
    assert.ok(provenance.collections.every((collection) => collection.items.every((item) => item.provenanceReady === true)));
    assert.match(provenance.note, /does not create a cryptographic C2PA signature/i);

    await page.locator('[data-director-view="storage"]').tap();
    await page.waitForFunction(() => /not configured/i.test(document.querySelector('#nft-storage-provider')?.textContent || ''));
    assert.equal(await page.locator('#nft-storage-publish').isDisabled(), true, 'real publishing must stay disabled without PINATA_JWT');
    await page.locator('#nft-storage-collection').selectOption('alpha');
    await page.locator('#nft-storage-plan').tap();
    await page.waitForFunction(() => /"existingIpfsMedia": 1/.test(document.querySelector('#nft-storage-output')?.textContent || ''));
    assert.match(await page.locator('#nft-storage-output').textContent(), /"configured": false/);

    await page.locator('[data-director-view="market"]').tap();
    await page.locator('#nft-market-collection').selectOption('alpha');
    await page.locator('#nft-market-form textarea[name="focus"]').fill('Current reveal and audience-positioning mechanics; do not predict price or demand.');
    const researchResponsePromise = page.waitForResponse((response) => response.url().endsWith('/market-research') && response.request().method() === 'POST');
    await page.locator('#nft-market-form button[type="submit"]').tap();
    const researchResponse = await researchResponsePromise;
    assert.ok([400, 503].includes(researchResponse.status()), `hosted research without configured/allowed provider should fail honestly, got ${researchResponse.status()}`);
    await page.waitForFunction(() => /blocked|not configured|requires|unavailable|provider|spend policy/i.test(document.querySelector('#nft-status')?.textContent || ''));
    assert.doesNotMatch(await page.locator('#nft-market-output').textContent(), /guaranteed demand|guaranteed return|price target/i);

    const project = (await api(base, `/api/projects/${PROJECT_ID}`)).body;
    assert.ok((project.memories || []).some((memory) => memory.relevanceTags?.includes('nft-series')), 'series state should be recorded in Project Brain');
    assert.equal((project.memories || []).filter((memory) => memory.relevanceTags?.includes('pinata')).length, 0, 'dry-run storage planning must not fabricate a verified publication memory');

    console.log('NFT PRODUCTION DIRECTOR BROWSER ACCEPTANCE PASSED: Android-safe Series/Set Director + cross-collection QA + provenance download + honest Market Signal failure + IPFS dry-run with publishing disabled when unconfigured.');
    await context.close();
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill('SIGTERM');
    await new Promise((resolve) => server.exitCode !== null ? resolve() : server.once('exit', resolve));
    await rm(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
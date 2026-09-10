#!/usr/bin/env node

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { existsSync, readdirSync } = require("node:fs");
const { mkdtemp, rm } = require("node:fs/promises");
const { homedir, tmpdir } = require("node:os");
const { join } = require("node:path");
const zlib = require("node:zlib");
const { chromium } = require("@playwright/test");
const { FileProjectStore } = require("../dist/infrastructure/file-project-store.js");
const {
  createProject,
  withProjectStudioWorkspace,
  withProjectKdpMarketIntelligenceReports,
  withProjectBookCoverPlans,
  withProjectIllustrationAssetLibrary,
} = require("../dist/domain/project.js");
const {
  createStudioWorkspace,
  createWorkspaceBook,
  addWorkspaceBook,
  addWorkspaceChapter,
  addWorkspaceScene,
  saveSceneContent,
} = require("../dist/domain/studio-workspace.js");
const { createKdpMarketIntelligenceReport } = require("../dist/domain/kdp-market-intelligence.js");
const { createBookCoverPlan } = require("../dist/domain/book-cover-studio.js");
const { createIllustrationAsset } = require("../dist/domain/illustration-asset-library.js");

const HOST = "127.0.0.1";
const PORT = 5680 + Math.floor(Math.random() * 150);
const projectId = `publishing-promotion-${Date.now()}`;
const bookId = "book-release";
const chapterId = "chapter-release";
const sceneId = "scene-release";
const coverPlanId = "ebook-cover-release-1";
const coverAssetId = "cover-art-release-1";
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
  return Buffer.concat([length, typeBytes, data, crc]);
}

function deterministicCoverPngDataUri(width = 625, height = 1000) {
  const stride = width * 4;
  const scanlines = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (stride + 1);
    scanlines[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = row + 1 + x * 4;
      scanlines[offset] = 26 + Math.floor((x / Math.max(1, width - 1)) * 36);
      scanlines[offset + 1] = 42 + Math.floor((y / Math.max(1, height - 1)) * 28);
      scanlines[offset + 2] = 66;
      scanlines[offset + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const bytes = Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(scanlines, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

function findBrowser() {
  if (process.env.FORGE_BROWSER_EXECUTABLE) {
    if (!existsSync(process.env.FORGE_BROWSER_EXECUTABLE)) throw new Error(`FORGE_BROWSER_EXECUTABLE does not exist: ${process.env.FORGE_BROWSER_EXECUTABLE}`);
    return process.env.FORGE_BROWSER_EXECUTABLE;
  }
  const systemBrowser = ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/chrome"].find(existsSync);
  if (systemBrowser) return systemBrowser;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH === "0"
    ? join(process.cwd(), "node_modules", "playwright-core")
    : process.env.PLAYWRIGHT_BROWSERS_PATH || join(homedir(), ".cache", "ms-playwright");
  if (!existsSync(root)) return null;
  const candidates = [];
  const walk = (directory, depth = 0) => {
    if (depth > 5) return;
    let entries;
    try { entries = readdirSync(directory, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = join(directory, entry.name);
      if (entry.isFile() && entry.name === "chrome") candidates.push(full);
      else if (entry.isDirectory()) walk(full, depth + 1);
    }
  };
  walk(root);
  return candidates.find((candidate) => /chromium|chrome/i.test(candidate)) ?? candidates[0] ?? null;
}

async function waitForHttp(url, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function jsonRequest(baseUrl, path, options = {}, expectedOk = true) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
  });
  const text = await response.text();
  let payload;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  assert.equal(response.ok, expectedOk, `${options.method || "GET"} ${path} expected ok=${expectedOk} but got ${response.status}: ${text}`);
  return { response, payload };
}

async function seed(dataDir) {
  const store = new FileProjectStore(dataDir);
  let workspace = createStudioWorkspace();
  workspace = addWorkspaceBook(workspace, createWorkspaceBook({
    id: bookId,
    title: "Heartwood Friendship",
    kind: "novel",
    description: "A release-integrity fixture for a text publication about friendship and belonging.",
    now: "2026-08-31T00:00:00.000Z",
  }));
  workspace = addWorkspaceChapter(workspace, bookId, {
    id: chapterId,
    number: 1,
    title: "One Brave Hello",
    synopsis: "A small act of courage opens the door to friendship.",
  });
  workspace = addWorkspaceScene(workspace, bookId, chapterId, {
    id: sceneId,
    number: 1,
    title: "The Hello",
    synopsis: "A hesitant introduction becomes the beginning of a durable friendship.",
  });
  workspace = saveSceneContent(
    workspace,
    bookId,
    chapterId,
    sceneId,
    "Mara stopped at the edge of the garden path, found enough courage for one brave hello, and discovered that belonging could begin with a single honest sentence.",
  );
  let project = withProjectStudioWorkspace(
    createProject({ id: projectId, title: "Publishing Promotion Acceptance", now: "2026-08-31T00:00:00.000Z" }),
    workspace,
    "2026-08-31T00:01:00.000Z",
  );

  const coverArt = createIllustrationAsset({
    id: coverAssetId,
    projectId,
    bookId,
    chapterId,
    sceneId,
    characterId: "cover-subject",
    locationId: "cover-setting",
    prompt: "Original portrait cover art used to verify the real final-cover production boundary.",
    references: [],
    style: "original atmospheric fiction cover",
    generationSettings: { purpose: "cover-art", dpi: 300 },
    approvalStatus: "approved",
    assetUri: deterministicCoverPngDataUri(),
    now: "2026-08-31T00:02:00.000Z",
  });
  project = withProjectIllustrationAssetLibrary(project, {
    formatVersion: 1,
    projectId,
    assets: [coverArt],
    characterDesignLocks: [],
  }, "2026-08-31T00:02:30.000Z");

  const ebookCover = createBookCoverPlan({
    id: coverPlanId,
    projectId,
    bookId,
    format: "ebook",
    publishing: {
      platform: "kdp",
      binding: "paperback",
      interiorType: "black-white",
      paperType: "white",
      trimWidthInches: 6,
      trimHeightInches: 9,
      pageCount: 120,
      bleedInches: 0.125,
      readingDirection: "ltr",
    },
    title: "Heartwood Friendship",
    author: "Kevin Wakley",
    frontPrompt: "Author-approved final eBook cover direction.",
    spineText: "",
    backText: "eBook cover",
    outputFormat: "jpeg",
    dpi: 300,
    version: 1,
    approvalStatus: "draft",
    now: "2026-08-31T00:03:30.000Z",
  });
  project = withProjectBookCoverPlans(project, [ebookCover], "2026-08-31T00:03:40.000Z");

  const report = createKdpMarketIntelligenceReport({
    id: "market-browser-1",
    projectId,
    bookId,
    question: "Find friendship story keywords and observable market signals.",
    market: "Amazon.com / United States",
    researchedAt: "2026-08-31T00:04:00.000Z",
    evidence: [{
      id: "e1",
      source: "Current observed sample",
      url: "https://example.org/current-market",
      observedAt: "2026-08-31T00:04:00.000Z",
      observation: "The observed sample contains current friendship and belonging titles.",
      strength: "moderate",
    }],
    signals: [{
      id: "s1",
      topic: "keyword-opportunities",
      label: "Friendship intent",
      observation: "Making-friends language matches the proposed book.",
      direction: "positive",
      evidenceIds: ["e1"],
    }],
    comparableTitles: [
      { title: "Friendship Sample A", category: "Friendship Fiction", price: 9.99, currency: "USD", bestSellerRank: 12000, reviewCount: 140, rating: 4.7, publishedDate: "2026-05-01", sourceUrl: "https://example.org/current-market", observedAt: "2026-08-31T00:04:00.000Z" },
      { title: "Friendship Sample B", category: "Friendship Fiction", price: 11.99, currency: "USD", bestSellerRank: 18000, reviewCount: 80, rating: 4.5, publishedDate: "2025-12-01", sourceUrl: "https://example.org/current-market", observedAt: "2026-08-31T00:04:00.000Z" },
    ],
    keywordRecommendations: [{
      phrase: "making new friends",
      score: 94,
      rationale: "Specific reader-search intent aligned to the actual story.",
      evidenceIds: ["e1"],
      recommendedForKdpSlot: true,
      complianceNotes: ["accurate to the central theme"],
    }],
    nicheOpportunities: [{
      niche: "friendship and belonging fiction",
      score: 88,
      demandSignal: "high",
      competitionSignal: "moderate",
      rationale: "Current sample supports reader interest while differentiation still matters.",
      evidenceIds: ["e1"],
    }],
    assessment: {
      level: "promising",
      rationale: "The current observed sample supports further consideration.",
      signals: ["friendship search intent"],
      limitations: ["sample is not the entire market"],
      disclaimer: "This report describes observable market signals and research evidence. It is not a guarantee, forecast, or promise of sales, rankings, revenue, or commercial performance.",
    },
  });
  project = withProjectKdpMarketIntelligenceReports(project, [report], "2026-08-31T00:05:00.000Z");
  await store.create(project);
}

async function main() {
  const executablePath = findBrowser();
  if (!executablePath) throw new Error("PUBLISHING/PROMOTION BROWSER ACCEPTANCE BLOCKED: no Chrome/Chromium executable found.");
  const dataDir = await mkdtemp(join(tmpdir(), "authors-forge-publishing-promotion-"));
  await seed(dataDir);
  const server = spawn(process.execPath, ["dist/studio-server.js"], {
    env: {
      ...process.env,
      PORT: String(PORT),
      HOST,
      FORGE_DATA_DIR: dataDir,
      OPENAI_API_KEY: "",
      OPENAI_MODEL: "",
      OPENAI_MARKET_RESEARCH_MODEL: "",
      OLLAMA_BASE_URL: "",
      OLLAMA_MODEL: "",
      OMNIROUTE_BASE_URL: "",
      ROUTER9_BASE_URL: "",
      KINGS_AI_ENDPOINT: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let browser;
  try {
    const baseUrl = `http://${HOST}:${PORT}`;
    await waitForHttp(`${baseUrl}/api/health`);
    browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-gpu"] });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${baseUrl}/?project=${encodeURIComponent(projectId)}#publishing`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.forgePublishingPromotion && document.querySelector("#forge-publishing-office") && document.querySelector("#publishing-book")?.options.length);

    const form = page.locator("#publishing-metadata-form");
    await form.locator('[name="title"]').fill("Heartwood Friendship");
    await form.locator('[name="author"]').fill("Kevin Wakley");
    await form.locator('[name="description"]').fill("A friendship and belonging story in which one brave greeting changes the direction of two lives.");
    await form.locator('[name="keywords"]').fill("friendship belonging fiction");
    await form.locator('[name="categories"]').fill("Fiction");
    await form.locator('[name="primaryAudience"]').selectOption("general");
    const saveResponse = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/publishing/metadata"));
    await form.locator('button[type="submit"]').click();
    assert.equal((await saveResponse).ok(), true, "Publishing metadata must save through the live Studio route");
    const saved = (await jsonRequest(baseUrl, `/api/projects/${projectId}/publishing/metadata?bookId=${bookId}`)).payload;
    assert.equal(saved.metadata.title, "Heartwood Friendship");

    await page.locator('nav a[data-route="marketing"]').click();
    await page.waitForFunction(() => location.hash === "#marketing" && document.querySelector("#forge-promotion-office"));
    await page.locator("#refresh-market-research").click();
    await page.waitForFunction(() => document.querySelector("#market-report")?.textContent.includes("making new friends"));
    assert.match(await page.locator("#market-report").textContent(), /Median BSR/);

    page.once("dialog", (dialog) => dialog.accept());
    const applyResponse = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/market-research/apply-keywords"));
    await page.locator("#apply-market-keywords").click();
    assert.equal((await applyResponse).ok(), true, "researched keywords must apply through author-approved live route");
    const updated = (await jsonRequest(baseUrl, `/api/projects/${projectId}/publishing/metadata?bookId=${bookId}`)).payload;
    assert.deepEqual(updated.metadata.keywords, ["making new friends"]);

    const researchFailure = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/market-research"));
    await page.locator("#run-market-research").click();
    const failedResearch = await researchFailure;
    assert.equal(failedResearch.ok(), false, "live market research must fail honestly when credentials/model are absent");
    assert.match(await failedResearch.text(), /OPENAI_API_KEY|OPENAI_MARKET_RESEARCH_MODEL|OPENAI_MODEL/);

    const promotionForm = page.locator("#promotion-generate-form");
    await promotionForm.locator('[name="audience"]').fill("Adult fiction readers");
    await promotionForm.locator('[name="readerPromise"]').fill("A warm friendship and belonging story");
    const promotionFailure = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/promotion/generate"));
    await promotionForm.locator('button[type="submit"]').click();
    const failedPromotion = await promotionFailure;
    assert.equal(failedPromotion.ok(), false, "AI Promotion must fail honestly when no real provider is configured");
    assert.match(await failedPromotion.text(), /No AI provider is configured|All configured AI resources failed/);

    const campaign = {
      id: "campaign-browser-1",
      projectId,
      bookId,
      objective: "Launch accurately",
      audience: "Adult fiction readers",
      readerPromise: "A warm friendship and belonging story",
      researchReportIds: ["market-browser-1"],
      assets: [{
        id: "social-browser-1",
        channel: "social",
        kind: "social-post",
        title: "One brave hello",
        body: "A story about friendship, courage, and belonging.",
        status: "draft",
        evidence: [{ source: `book:${bookId}`, claim: "Friendship and belonging are central to the book.", confidence: "known" }],
        sourceResearchIds: ["market-browser-1"],
      }],
    };
    await jsonRequest(baseUrl, `/api/projects/${projectId}/promotion/campaigns`, { method: "POST", body: JSON.stringify({ bookId, campaign }) });
    await page.locator("#refresh-campaigns").click();
    await page.waitForFunction(() => document.querySelector("#promotion-campaigns")?.textContent.includes("One brave hello"));
    const approveResponse = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/approve"));
    await page.locator('[data-promo-action="approve"]').click();
    assert.equal((await approveResponse).ok(), true, "Promotion approval must use durable Studio route");
    await page.waitForFunction(() => document.querySelector("#promotion-campaigns")?.textContent.includes("approved"));
    await page.locator("#promotion-readiness").click();
    await page.waitForFunction(() => document.querySelector("#promotion-readiness-result")?.textContent.includes("Promotion is release-ready"));

    await page.locator('nav a[data-route="publishing"]').click();
    const readiness = page.locator("#publishing-readiness-form");
    await readiness.locator('[name="releaseFormat"]').selectOption("ebook");
    assert.equal(await readiness.locator('[name="coverFileType"]').inputValue(), "", "browser must not declare authoritative cover evidence");
    assert.equal(await readiness.locator('[name="coverValidated"]').isChecked(), false, "browser must not self-certify cover validation");
    assert.equal(await readiness.locator('[name="productionValidated"]').isChecked(), false, "browser must not self-certify production validation");

    let readinessResponse = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/publishing/readiness"));
    await readiness.locator('button[type="submit"]').click();
    let readinessPayload = await (await readinessResponse).json();
    assert.equal(readinessPayload.checks.find((item) => item.id === "production-validation").status, "attention", "release must remain blocked before a real artifact exists");
    assert.equal(readinessPayload.checks.find((item) => item.id === "cover-validation").status, "attention", "a draft cover plan without verified bytes must remain blocked");
    await page.locator("#run-release-gate").click();
    await page.waitForFunction(() => document.querySelector("#release-gate-result")?.textContent.includes("RELEASE BLOCKED"));

    const exported = await page.evaluate(async ({ projectId: pid, bookId: bid }) => {
      const response = await fetch(`/api/projects/${pid}/export`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bookId: bid, format: "epub", pageSize: "6x9", pageNumbers: true, includeTitlePage: true, includeToc: true }),
      });
      return { ok: response.ok, status: response.status, payload: await response.json() };
    }, { projectId, bookId });
    assert.equal(exported.ok, true, `live production export failed: ${JSON.stringify(exported.payload)}`);
    assert.equal(exported.payload.persisted, true);
    assert.equal(exported.payload.format, "epub");
    assert.match(exported.payload.evidence.sourceSha256, /^[a-f0-9]{64}$/);
    assert.match(exported.payload.evidence.sha256, /^[a-f0-9]{64}$/);
    assert.equal(Buffer.from(exported.payload.contentBase64, "base64").subarray(0, 2).toString(), "PK", "EPUB must contain real ZIP bytes");

    const artifactLedger = (await jsonRequest(baseUrl, `/api/projects/${projectId}/production/artifacts?bookId=${bookId}&format=epub`)).payload;
    assert.equal(artifactLedger.artifacts.length, 1);
    assert.equal(artifactLedger.artifacts[0].valid, true, artifactLedger.artifacts[0].issues.join("; "));

    const coverResult = await page.evaluate(async ({ projectId: pid, bookId: bid, planId, assetId }) => {
      const response = await fetch(`/api/projects/${pid}/cover/artifacts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bookId: bid, planId, assetId, authorApproved: true }),
      });
      const text = await response.text();
      let payload;
      try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
      return { ok: response.ok, status: response.status, payload };
    }, { projectId, bookId, planId: coverPlanId, assetId: coverAssetId });
    assert.equal(coverResult.ok, true, `live final-cover production failed: ${JSON.stringify(coverResult.payload)}`);
    assert.equal(coverResult.payload.evidence.fileFormat, "jpeg");
    assert.equal(coverResult.payload.evidence.widthPixels, 625);
    assert.equal(coverResult.payload.evidence.heightPixels, 1000);
    assert.match(coverResult.payload.evidence.sha256, /^[a-f0-9]{64}$/);
    const coverBytes = Buffer.from(coverResult.payload.contentBase64, "base64");
    assert.equal(coverBytes[0], 0xff, "final eBook cover must contain real JPEG bytes");
    assert.equal(coverBytes[1], 0xd8, "final eBook cover must contain real JPEG bytes");

    const coverLedger = (await jsonRequest(baseUrl, `/api/projects/${projectId}/cover/artifacts?bookId=${bookId}&planId=${coverPlanId}`)).payload;
    assert.equal(coverLedger.artifacts.length, 1);
    assert.equal(coverLedger.artifacts[0].valid, true, coverLedger.artifacts[0].issues.join("; "));
    assert.equal(coverLedger.artifacts[0].evidence.sourceAssetId, coverAssetId);

    readinessResponse = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/publishing/readiness"));
    await readiness.locator('button[type="submit"]').click();
    readinessPayload = await (await readinessResponse).json();
    assert.equal(readinessPayload.checks.filter((item) => item.status === "attention" && item.severity === "error").length, 0, "current verified EPUB + verified final cover artifact should remove release-blocking Publishing errors");
    assert.equal(readinessPayload.checks.find((item) => item.id === "production-validation").status, "passed");
    assert.equal(readinessPayload.checks.find((item) => item.id === "cover-validation").status, "passed");

    await page.locator("#run-release-gate").click();
    await page.waitForFunction(() => document.querySelector("#release-gate-result")?.textContent.includes("READY TO RELEASE"));
    assert.doesNotMatch(await page.locator("#release-gate-result").textContent(), /publishing-readiness|promotion-readiness/i, "verified Publishing + Promotion evidence should clear the combined gate");

    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent: "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/150 Mobile Safari/537.36",
    });
    const mobile = await mobileContext.newPage();
    await mobile.goto(`${baseUrl}/?project=${encodeURIComponent(projectId)}#marketing`, { waitUntil: "networkidle" });
    await mobile.waitForFunction(() => window.forgePublishingPromotion && document.querySelector("#run-market-research"));
    const marketBox = await mobile.locator("#run-market-research").boundingBox();
    assert.ok(marketBox && marketBox.height >= 40, `market research touch target too small: ${JSON.stringify(marketBox)}`);
    await mobile.locator('nav a[data-route="publishing"]').tap();
    const releaseBox = await mobile.locator("#run-release-gate").boundingBox();
    assert.ok(releaseBox && releaseBox.height >= 40, `release gate touch target too small: ${JSON.stringify(releaseBox)}`);
    const dimensions = await mobile.evaluate(() => ({ viewport: document.documentElement.clientWidth, body: document.body.scrollWidth, document: document.documentElement.scrollWidth }));
    assert.ok(dimensions.body <= dimensions.viewport + 1, `Publishing/Promotion body overflows Android viewport: ${JSON.stringify(dimensions)}`);
    assert.ok(dimensions.document <= dimensions.viewport + 1, `Publishing/Promotion document overflows Android viewport: ${JSON.stringify(dimensions)}`);
    await mobileContext.close();

    console.log("PUBLISHING/PROMOTION BROWSER ACCEPTANCE PASSED: durable metadata + saved market evidence + author-approved promotion + honest provider failure + blocked-before-artifacts + real persisted source-bound EPUB + real verified final JPEG cover + ready-after-verification + Android touch/overflow.");
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill("SIGTERM");
    await new Promise((resolve) => server.exitCode !== null ? resolve() : server.once("exit", resolve));
    await rm(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});

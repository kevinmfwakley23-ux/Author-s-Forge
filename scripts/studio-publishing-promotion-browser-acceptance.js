#!/usr/bin/env node

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { existsSync, readdirSync } = require("node:fs");
const { mkdtemp, rm } = require("node:fs/promises");
const { homedir, tmpdir } = require("node:os");
const { join } = require("node:path");
const { chromium } = require("@playwright/test");
const { FileProjectStore } = require("../dist/infrastructure/file-project-store.js");
const { createProject, withProjectStudioWorkspace, withProjectKdpMarketIntelligenceReports } = require("../dist/domain/project.js");
const { createStudioWorkspace, createWorkspaceBook, addWorkspaceBook } = require("../dist/domain/studio-workspace.js");
const { createKdpMarketIntelligenceReport } = require("../dist/domain/kdp-market-intelligence.js");

const HOST = "127.0.0.1";
const PORT = 5680 + Math.floor(Math.random() * 150);
const projectId = `publishing-promotion-${Date.now()}`;
const bookId = "book-release";

function findBrowser() {
  if (process.env.FORGE_BROWSER_EXECUTABLE) {
    if (!existsSync(process.env.FORGE_BROWSER_EXECUTABLE)) throw new Error(`FORGE_BROWSER_EXECUTABLE does not exist: ${process.env.FORGE_BROWSER_EXECUTABLE}`);
    return process.env.FORGE_BROWSER_EXECUTABLE;
  }
  const systemBrowser = ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/chrome"].find(existsSync);
  if (systemBrowser) return systemBrowser;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH === "0" ? join(process.cwd(), "node_modules", "playwright-core") : process.env.PLAYWRIGHT_BROWSERS_PATH || join(homedir(), ".cache", "ms-playwright");
  if (!existsSync(root)) return null;
  const candidates = [];
  const walk = (directory, depth = 0) => {
    if (depth > 5) return;
    let entries; try { entries = readdirSync(directory, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) { const full = join(directory, entry.name); if (entry.isFile() && entry.name === "chrome") candidates.push(full); else if (entry.isDirectory()) walk(full, depth + 1); }
  };
  walk(root);
  return candidates.find((candidate) => /chromium|chrome/i.test(candidate)) ?? candidates[0] ?? null;
}

async function waitForHttp(url, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) { try { if ((await fetch(url)).ok) return; } catch {} await new Promise((resolve) => setTimeout(resolve, 100)); }
  throw new Error(`Timed out waiting for ${url}`);
}

async function jsonRequest(baseUrl, path, options = {}, expectedOk = true) {
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers: { "content-type": "application/json", ...(options.headers || {}) } });
  const text = await response.text();
  let payload; try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  assert.equal(response.ok, expectedOk, `${options.method || "GET"} ${path} expected ok=${expectedOk} but got ${response.status}: ${text}`);
  return { response, payload };
}

async function seed(dataDir) {
  const store = new FileProjectStore(dataDir);
  let workspace = createStudioWorkspace();
  workspace = addWorkspaceBook(workspace, createWorkspaceBook({ id: bookId, title: "Heartwood Friendship", kind: "childrens-book", description: "A gentle animal story about making a new friend and belonging.", now: "2026-09-01T15:00:00.000Z" }));
  let project = withProjectStudioWorkspace(createProject({ id: projectId, title: "Publishing Promotion Acceptance", now: "2026-09-01T15:00:00.000Z" }), workspace, "2026-09-01T15:01:00.000Z");
  const report = createKdpMarketIntelligenceReport({
    id: "market-browser-1", projectId, bookId, question: "Find friendship story keywords and observable market signals.", market: "Amazon.com / United States", researchedAt: "2026-09-01T15:02:00.000Z",
    evidence: [{ id: "e1", source: "Current observed sample", url: "https://example.org/current-market", observedAt: "2026-09-01T15:02:00.000Z", observation: "The observed sample contains current friendship and belonging titles.", strength: "moderate" }],
    signals: [{ id: "s1", topic: "keyword-opportunities", label: "Friendship intent", observation: "Making-friends language matches the proposed book.", direction: "positive", evidenceIds: ["e1"] }],
    comparableTitles: [
      { title: "Friendship Sample A", category: "Children's Friendship", price: 9.99, currency: "USD", bestSellerRank: 12000, reviewCount: 140, rating: 4.7, publishedDate: "2026-05-01", sourceUrl: "https://example.org/current-market", observedAt: "2026-09-01T15:02:00.000Z" },
      { title: "Friendship Sample B", category: "Children's Friendship", price: 11.99, currency: "USD", bestSellerRank: 18000, reviewCount: 80, rating: 4.5, publishedDate: "2025-12-01", sourceUrl: "https://example.org/current-market", observedAt: "2026-09-01T15:02:00.000Z" },
    ],
    keywordRecommendations: [{ phrase: "making new friends", score: 94, rationale: "Specific reader-search intent aligned to the actual story.", evidenceIds: ["e1"], recommendedForKdpSlot: true, complianceNotes: ["accurate to the central theme"] }],
    nicheOpportunities: [{ niche: "gentle animal friendship and belonging stories", score: 88, demandSignal: "high", competitionSignal: "moderate", rationale: "Current sample supports reader interest while differentiation still matters.", evidenceIds: ["e1"] }],
    assessment: { level: "promising", rationale: "The current observed sample supports further consideration.", signals: ["friendship search intent"], limitations: ["sample is not the entire market"], disclaimer: "This report describes observable market signals and research evidence. It is not a guarantee, forecast, or promise of sales, rankings, revenue, or commercial performance." },
  });
  project = withProjectKdpMarketIntelligenceReports(project, [report], "2026-09-01T15:03:00.000Z");
  await store.create(project);
}

async function main() {
  const executablePath = findBrowser();
  if (!executablePath) throw new Error("PUBLISHING/PROMOTION BROWSER ACCEPTANCE BLOCKED: no Chrome/Chromium executable found.");
  const dataDir = await mkdtemp(join(tmpdir(), "authors-forge-publishing-promotion-"));
  await seed(dataDir);
  const server = spawn(process.execPath, ["dist/studio-server.js"], { env: { ...process.env, PORT: String(PORT), HOST, FORGE_DATA_DIR: dataDir, OPENAI_API_KEY: "", OPENAI_MODEL: "", OPENAI_MARKET_RESEARCH_MODEL: "", OLLAMA_BASE_URL: "", OLLAMA_MODEL: "" }, stdio: ["ignore", "pipe", "pipe"] });
  let browser;
  try {
    const baseUrl = `http://${HOST}:${PORT}`;
    await waitForHttp(`${baseUrl}/api/health`);
    browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-gpu"] });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${baseUrl}/?project=${encodeURIComponent(projectId)}#publishing`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.forgePublishingPromotion && document.querySelector("#forge-publishing-office") && document.querySelector("#publishing-book")?.options.length);
    await page.locator('nav a[data-route="publishing"]').click();
    await page.waitForFunction(() => location.hash === "#publishing");

    const form = page.locator("#publishing-metadata-form");
    await form.locator('[name="title"]').fill("Heartwood Friendship");
    await form.locator('[name="author"]').fill("Kevin Wakley");
    await form.locator('[name="description"]').fill("A gentle animal story about making a new friend, finding belonging, and learning that one brave hello can matter.");
    await form.locator('[name="keywords"]').fill("animal friendship story");
    await form.locator('[name="categories"]').fill("Children's Fiction");
    await form.locator('[name="primaryAudience"]').selectOption("children");
    await form.locator('[name="readingAgeMin"]').fill("5");
    await form.locator('[name="readingAgeMax"]').fill("9");
    const saveResponse = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/publishing/metadata"));
    await form.locator('button[type="submit"]').click();
    assert.equal((await saveResponse).ok(), true, "Publishing metadata must save through the live Studio route");
    const saved = (await jsonRequest(baseUrl, `/api/projects/${projectId}/publishing/metadata?bookId=${bookId}`)).payload;
    assert.equal(saved.metadata.title, "Heartwood Friendship");
    assert.deepEqual(saved.metadata.keywords, ["animal friendship story"]);

    await page.locator('nav a[data-route="marketing"]').click();
    await page.waitForFunction(() => location.hash === "#marketing" && document.querySelector("#forge-promotion-office"));
    await page.locator("#refresh-market-research").click();
    await page.waitForFunction(() => document.querySelector("#market-report")?.textContent.includes("making new friends"));
    assert.match(await page.locator("#market-report").textContent(), /Median BSR/);
    assert.match(await page.locator("#market-report").textContent(), /15000/);

    page.once("dialog", (dialog) => dialog.accept());
    const applyResponse = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/market-research/apply-keywords"));
    await page.locator("#apply-market-keywords").click();
    assert.equal((await applyResponse).ok(), true, "researched keywords must apply through author-approved live route");
    const updated = (await jsonRequest(baseUrl, `/api/projects/${projectId}/publishing/metadata?bookId=${bookId}`)).payload;
    assert.deepEqual(updated.metadata.keywords, ["making new friends"]);

    const researchFailure = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/market-research"));
    await page.locator("#run-market-research").click();
    const failed = await researchFailure;
    assert.equal(failed.ok(), false, "live market research must fail honestly when credentials/model are absent");
    assert.match(await failed.text(), /OPENAI_API_KEY|OPENAI_MARKET_RESEARCH_MODEL|OPENAI_MODEL/);

    const campaign = {
      id: "campaign-browser-1", projectId, bookId, objective: "Launch accurately", audience: "Parents and teachers", readerPromise: "A warm friendship and belonging story", researchReportIds: ["market-browser-1"],
      assets: [{ id: "social-browser-1", channel: "social", kind: "social-post", title: "One brave hello", body: "A gentle Heartwood story about friendship and belonging.", status: "draft", evidence: [{ source: `book:${bookId}`, claim: "Friendship and belonging are central to the book.", confidence: "known" }], sourceResearchIds: ["market-browser-1"] }],
    };
    await jsonRequest(baseUrl, `/api/projects/${projectId}/promotion/campaigns`, { method: "POST", body: JSON.stringify({ bookId, campaign }) });
    await page.locator("#refresh-campaigns").click();
    await page.waitForFunction(() => document.querySelector("#promotion-campaigns")?.textContent.includes("One brave hello"));
    const approveResponse = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/approve"));
    await page.locator('[data-promo-action="approve"]').click();
    assert.equal((await approveResponse).ok(), true, "Promotion approval must use durable Studio route");
    await page.locator("#promotion-readiness").click();
    await page.waitForFunction(() => document.querySelector("#promotion-readiness-result")?.textContent.includes("Promotion is release-ready"));

    await page.locator('nav a[data-route="publishing"]').click();
    const readiness = page.locator("#publishing-readiness-form");
    await readiness.locator('[name="hasTitlePage"]').check();
    await readiness.locator('[name="hasCopyrightPage"]').check();
    await readiness.locator('[name="hasTableOfContents"]').check();
    await readiness.locator('[name="formattingValidated"]').check();
    await readiness.locator('[name="pageNumbering"]').check();
    await readiness.locator('[name="imagesResolved"]').check();
    await readiness.locator('[name="imagesApproved"]').check();
    await readiness.locator('[name="resolutionValidated"]').check();
    await readiness.locator('[name="productionValidated"]').check();
    await readiness.locator('[name="fileTypes"]').fill("epub");
    const readinessResponse = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/publishing/readiness"));
    await readiness.locator('button[type="submit"]').click();
    assert.equal((await readinessResponse).ok(), true);
    await page.locator("#run-release-gate").click();
    await page.waitForFunction(() => document.querySelector("#release-gate-result")?.textContent.includes("RELEASE BLOCKED"));
    assert.match(await page.locator("#release-gate-result").textContent(), /publishing-readiness/i, "missing final cover evidence must remain a real release blocker");

    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/150 Mobile Safari/537.36" });
    const mobile = await mobileContext.newPage();
    await mobile.goto(`${baseUrl}/?project=${encodeURIComponent(projectId)}#marketing`, { waitUntil: "networkidle" });
    await mobile.waitForFunction(() => window.forgePublishingPromotion && document.querySelector("#run-market-research"));
    const buttonBox = await mobile.locator("#run-market-research").boundingBox();
    assert.ok(buttonBox && buttonBox.height >= 40, `market research touch target too small: ${JSON.stringify(buttonBox)}`);
    const dimensions = await mobile.evaluate(() => ({ viewport: document.documentElement.clientWidth, body: document.body.scrollWidth, document: document.documentElement.scrollWidth }));
    assert.ok(dimensions.body <= dimensions.viewport + 1, `Publishing/Promotion body overflows Android viewport: ${JSON.stringify(dimensions)}`);
    assert.ok(dimensions.document <= dimensions.viewport + 1, `Publishing/Promotion document overflows Android viewport: ${JSON.stringify(dimensions)}`);
    await mobileContext.close();

    console.log("PUBLISHING/PROMOTION BROWSER ACCEPTANCE PASSED: durable metadata + saved market statistics + author-approved keywords + honest live-provider failure + durable promotion approval/readiness + release blocking + Android touch/overflow.");
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill("SIGTERM");
    await new Promise((resolve) => server.exitCode !== null ? resolve() : server.once("exit", resolve));
    await rm(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
#!/usr/bin/env node

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { existsSync, readdirSync } = require("node:fs");
const { mkdtemp, rm } = require("node:fs/promises");
const { homedir, tmpdir } = require("node:os");
const { join } = require("node:path");
const { chromium } = require("@playwright/test");

const HOST = "127.0.0.1";
const PORT = 5900 + Math.floor(Math.random() * 100);
const projectId = `promotion-performance-browser-${Date.now()}`;
const bookId = "book-performance";
const campaignId = "campaign-performance";

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
  function walk(directory, depth = 0) {
    if (depth > 5) return;
    let entries; try { entries = readdirSync(directory, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) { const full = join(directory, entry.name); if (entry.isFile() && entry.name === "chrome") candidates.push(full); else if (entry.isDirectory()) walk(full, depth + 1); }
  }
  walk(root);
  return candidates.find((candidate) => /chromium|chrome/i.test(candidate)) ?? candidates[0] ?? null;
}
async function waitForHttp(url, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) { try { if ((await fetch(url)).ok) return; } catch {} await new Promise((resolve) => setTimeout(resolve, 100)); }
  throw new Error(`Timed out waiting for ${url}`);
}
async function request(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers: { "content-type":"application/json", ...(options.headers || {}) } });
  const text = await response.text();
  let payload; try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  assert.equal(response.ok, true, `${options.method || "GET"} ${path} failed (${response.status}): ${text}`);
  return payload;
}
function localInput(date) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}

async function main() {
  const executablePath = findBrowser();
  if (!executablePath) throw new Error("PROMOTION PERFORMANCE BROWSER ACCEPTANCE BLOCKED: no Chrome/Chromium executable found.");
  const dataDir = await mkdtemp(join(tmpdir(), "authors-forge-promotion-performance-browser-"));
  const server = spawn(process.execPath, ["dist/studio-server.js"], { env: { ...process.env, PORT:String(PORT), HOST, FORGE_DATA_DIR:dataDir, OPENAI_API_KEY:"", OPENAI_MODEL:"", OLLAMA_BASE_URL:"", OLLAMA_MODEL:"" }, stdio:["ignore","pipe","pipe"] });
  let browser;
  try {
    const baseUrl = `http://${HOST}:${PORT}`;
    await waitForHttp(`${baseUrl}/api/health`);
    await request(baseUrl, "/api/projects", { method:"POST", body:JSON.stringify({ id:projectId, title:"Promotion Performance Browser" }) });
    await request(baseUrl, `/api/projects/${projectId}/workspace/books`, { method:"POST", body:JSON.stringify({ id:bookId, title:"Performance Book", kind:"novel", description:"A book used to verify evidence-bounded campaign analytics." }) });
    const campaign = {
      id:campaignId, projectId, bookId, objective:"Measure launch results", audience:"Readers", readerPromise:"An accurate description of the book", researchReportIds:[],
      assets:[{ id:"asset-performance", channel:"social", kind:"social-post", title:"Launch creative", body:"An accurate launch message.", status:"approved", approvedAt:new Date(Date.now()-3600000).toISOString(), evidence:[{ source:`book:${bookId}`, claim:"Launch message describes the book", confidence:"known" }] }],
    };
    await request(baseUrl, `/api/projects/${projectId}/promotion/campaigns`, { method:"POST", body:JSON.stringify({ bookId, campaign }) });

    browser = await chromium.launch({ executablePath, headless:true, args:["--no-sandbox","--disable-gpu"] });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${baseUrl}/?project=${encodeURIComponent(projectId)}#marketing`, { waitUntil:"networkidle" });
    await page.waitForFunction(() => window.forgePublishingPromotion && window.forgePromotionPerformance && document.querySelector("#promotion-performance-card"));
    await page.locator('nav a[data-route="marketing"]').click();
    await page.locator("#refresh-campaigns").click();
    await page.waitForFunction(() => document.querySelector("#promotion-campaigns")?.textContent.includes("Launch creative"));

    const form = page.locator("#promotion-performance-form");
    await form.locator('[name="source"]').selectOption("amazon-ads");
    await form.locator('[name="assetId"]').selectOption("asset-performance");
    const end = new Date(Date.now() - 60000), start = new Date(end.getTime() - 24*60*60*1000);
    await form.locator('[name="periodStart"]').fill(localInput(start));
    await form.locator('[name="periodEnd"]').fill(localInput(end));
    await form.locator('[name="impressions"]').fill("1000");
    await form.locator('[name="clicks"]').fill("50");
    await form.locator('[name="spend"]').fill("20");
    await form.locator('[name="attributedOrders"]').fill("5");
    await form.locator('[name="attributedRevenue"]').fill("100");
    await form.locator('[name="sourceReference"]').fill("Amazon Ads campaign report export");
    const responsePromise = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/promotion/performance"));
    await form.locator('button[type="submit"]').click();
    const response = await responsePromise;
    assert.equal(response.ok(), true, `performance route failed: ${await response.text()}`);
    await page.waitForFunction(() => document.querySelector("#promotion-performance-results")?.textContent.includes("ROAS"));
    const text = await page.locator("#promotion-performance-results").textContent();
    assert.match(text, /5%/i, "observed 50/1000 clicks should render 5% CTR");
    assert.match(text, /20%/i, "observed 20 spend / 100 attributed revenue should render 20% ACOS");

    const summary = await request(baseUrl, `/api/projects/${projectId}/promotion/performance?bookId=${bookId}&campaignId=${campaignId}`);
    assert.equal(summary.snapshots.length, 1);
    assert.equal(summary.snapshots[0].derived.ctrPercent, 5);
    assert.equal(summary.snapshots[0].derived.costPerClick, 0.4);
    assert.equal(summary.snapshots[0].derived.acosPercent, 20);
    assert.equal(summary.snapshots[0].derived.roas, 5);
    const durable = await request(baseUrl, `/api/projects/${projectId}`);
    assert.ok(durable.memories.some((memory) => memory.class === "marketing-memory" && memory.relevanceTags?.includes("promotion-performance")), "performance evidence must persist in project memory");

    const mobileContext = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true, userAgent:"Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/150 Mobile Safari/537.36" });
    const mobile = await mobileContext.newPage();
    await mobile.goto(`${baseUrl}/?project=${encodeURIComponent(projectId)}#marketing`, { waitUntil:"networkidle" });
    await mobile.waitForFunction(() => document.querySelector("#promotion-performance-card"));
    const buttonBox = await mobile.locator('#promotion-performance-form button[type="submit"]').boundingBox();
    assert.ok(buttonBox && buttonBox.height >= 40, `performance record touch target too small: ${JSON.stringify(buttonBox)}`);
    const dimensions = await mobile.evaluate(() => ({ viewport:document.documentElement.clientWidth, body:document.body.scrollWidth, document:document.documentElement.scrollWidth }));
    assert.ok(dimensions.body <= dimensions.viewport + 1, `performance UI body overflows Android viewport: ${JSON.stringify(dimensions)}`);
    assert.ok(dimensions.document <= dimensions.viewport + 1, `performance UI document overflows Android viewport: ${JSON.stringify(dimensions)}`);
    await mobileContext.close();

    console.log("PROMOTION PERFORMANCE BROWSER ACCEPTANCE PASSED: observed-source recording + durable evidence + supported CTR/CPC/ACOS/ROAS derivation + Android touch/overflow.");
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill("SIGTERM");
    await new Promise((resolve) => server.exitCode !== null ? resolve() : server.once("exit", resolve));
    await rm(dataDir, { recursive:true, force:true });
  }
}
main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });

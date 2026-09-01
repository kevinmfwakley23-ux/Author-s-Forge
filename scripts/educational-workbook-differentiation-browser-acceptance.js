#!/usr/bin/env node
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { chromium } = require("@playwright/test");

const HOST = "127.0.0.1";
const PORT = 6900 + Math.floor(Math.random() * 100);
const projectId = `diff-browser-${Date.now()}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitForHttp(url, timeout = 12000) { const start = Date.now(); while (Date.now() - start < timeout) { try { if ((await fetch(url)).ok) return; } catch {} await sleep(100); } throw new Error(`Timed out waiting for ${url}`); }
async function stop(server) { if (!server || server.exitCode !== null) return; server.kill("SIGTERM"); await Promise.race([new Promise((resolve) => server.once("exit", resolve)), sleep(2500)]); if (server.exitCode === null) server.kill("SIGKILL"); }
async function request(url, options = {}) { const response = await fetch(url, { ...options, headers: { "content-type": "application/json", ...(options.headers || {}) } }); const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.error || `${response.status} ${url}`); return payload; }
function seededActivities() {
  const activities = [];
  let n = 1;
  for (const difficulty of ["intro", "practice", "challenge"]) {
    for (let i = 0; i < 2; i += 1) {
      activities.push({ id: `${difficulty}-${i + 1}`, subject: "math", gradeBands: ["3-5"], kind: "math-practice", difficulty, prompt: `Solve fraction comparison ${n}.`, answer: String(n), explanation: `Expected answer ${n}.`, standards: ["CCSS.MATH.CONTENT.4.NF.A.2"], tags: ["fractions"], points: 1 });
      n += 1;
    }
  }
  return activities;
}

async function main() {
  const dataDir = await mkdtemp(join(tmpdir(), "authors-forge-diff-browser-"));
  let server, browser;
  try {
    server = spawn(process.execPath, ["dist/educational-workbook-server.js"], { env: { ...process.env, HOST, WORKBOOK_PORT: String(PORT), FORGE_DATA_DIR: dataDir }, stdio: ["ignore", "pipe", "pipe"] });
    const base = `http://${HOST}:${PORT}`;
    await waitForHttp(`${base}/api/health`);
    await request(`${base}/api/projects`, { method: "POST", body: JSON.stringify({ id: projectId, title: "Differentiation Browser Acceptance" }) });
    await request(`${base}/api/projects/${projectId}/workbooks/library/import`, { method: "POST", body: JSON.stringify({ activities: seededActivities() }) });

    browser = await chromium.launch({ executablePath: process.env.FORGE_BROWSER_EXECUTABLE || chromium.executablePath(), headless: true, args: ["--no-sandbox", "--disable-gpu"] });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, acceptDownloads: true });
    const page = await context.newPage();
    await page.goto(`${base}/educational-differentiation.html?project=${encodeURIComponent(projectId)}`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelector("#project-status")?.classList.contains("good"));
    const overflow = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, body: document.body.scrollWidth, doc: document.documentElement.scrollWidth }));
    assert.ok(overflow.body <= overflow.viewport + 1 && overflow.doc <= overflow.viewport + 1, `Differentiation workspace overflows mobile viewport: ${JSON.stringify(overflow)}`);

    await page.locator('#readiness-form [name="activityCountPerVariant"]').fill("2");
    await page.locator('#readiness-form [name="subjects"]').fill("math");
    await page.locator('#readiness-form [name="standards"]').fill("CCSS.MATH.CONTENT.4.NF.A.2");
    await page.locator('#readiness-form [name="tags"]').fill("fractions");
    const readinessResponse = page.waitForResponse((response) => response.url().includes("/workbooks/differentiation/readiness") && response.request().method() === "GET");
    await page.locator('#readiness-form button[type="submit"]').tap();
    assert.equal((await readinessResponse).ok(), true);
    await page.waitForFunction(() => document.querySelector("#readiness-result")?.textContent.includes("READY"));
    assert.match(await page.locator("#readiness-result").innerText(), /support.*2 eligible.*core.*2 eligible.*extension.*2 eligible/is);

    await page.locator('#pack-form [name="id"]').fill("browser-pack");
    await page.locator('#pack-form [name="title"]').fill("Fractions Differentiated Practice");
    await page.locator('#pack-form [name="activityCountPerVariant"]').fill("2");
    await page.locator('#pack-form [name="learningObjectives"]').fill("Compare fractions with unlike denominators\nExplain fraction comparison reasoning");
    await page.locator('#pack-form [name="subjects"]').fill("math");
    await page.locator('#pack-form [name="standards"]').fill("CCSS.MATH.CONTENT.4.NF.A.2");
    await page.locator('#pack-form [name="tags"]').fill("fractions");
    const packResponse = page.waitForResponse((response) => response.url().endsWith("/workbooks/differentiation/packs") && response.request().method() === "POST");
    await page.locator('#pack-form button[type="submit"]').tap();
    assert.equal((await packResponse).ok(), true);
    await page.waitForFunction(() => document.querySelector("#pack-result")?.textContent.includes("Extension Challenge"));
    const packText = await page.locator("#pack-result").innerText();
    assert.match(packText, /Supported Practice/);
    assert.match(packText, /Core Practice/);
    assert.match(packText, /Extension Challenge/);

    const packs = await request(`${base}/api/projects/${projectId}/workbooks/differentiation/packs`);
    assert.equal(packs.packs.length, 1);
    assert.deepEqual(packs.packs[0].variants.map((variant) => variant.difficulty), ["intro", "practice", "challenge"]);
    const editions = await request(`${base}/api/projects/${projectId}/workbooks/editions`);
    assert.equal(editions.filter((edition) => edition.id.startsWith("browser-pack-")).length, 3);

    const author = page.locator('[data-guide-author="browser-pack"]').first();
    await author.fill("Browser Test Educator");
    const guideResponse = page.waitForResponse((response) => response.url().includes("/browser-pack/teacher-guide") && response.request().method() === "POST");
    const downloadPromise = page.waitForEvent("download");
    await page.locator('[data-guide="browser-pack"]').first().tap();
    const response = await guideResponse;
    assert.equal(response.ok(), true);
    const payload = await response.json();
    const bytes = Buffer.from(payload.artifact.contentBase64, "base64");
    assert.equal(bytes.subarray(0, 5).toString("ascii"), "%PDF-");
    assert.equal(payload.totalPages, 4);
    const download = await downloadPromise;
    assert.match(download.suggestedFilename(), /teacher-guide\.pdf$/);

    await context.close();
    console.log("EDUCATIONAL WORKBOOK DIFFERENTIATION BROWSER ACCEPTANCE PASSED: exact readiness + three durable tiers + teacher guide PDF + Android fit.");
  } finally {
    if (browser) await browser.close().catch(() => {});
    await stop(server).catch(() => {});
    await rm(dataDir, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });

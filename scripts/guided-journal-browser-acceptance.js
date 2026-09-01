#!/usr/bin/env node
const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { chromium } = require("@playwright/test");

const HOST = "127.0.0.1";
const PORT = 5600 + Math.floor(Math.random() * 100);
const AI_PORT = PORT + 120;
const projectId = `journal-browser-${Date.now()}`;
const categories = ["remember", "discover", "challenge", "create", "become", "hope"];

async function waitForHttp(url, timeout = 10000) { const start = Date.now(); while (Date.now() - start < timeout) { try { if ((await fetch(url)).ok) return; } catch {} await new Promise((r) => setTimeout(r, 100)); } throw new Error(`Timed out waiting for ${url}`); }
function json(res, status, value) { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(value)); }
async function readBody(req) { let raw = ""; for await (const chunk of req) raw += String(chunk); return raw ? JSON.parse(raw) : {}; }
function mockAi() {
  const server = createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/v1/chat/completions") return json(res, 404, { error: { message: "not found" } });
    const payload = await readBody(req); const user = payload.messages?.find((m) => m.role === "user")?.content || "";
    if (String(user).includes("Return JSON shaped exactly as {\"frontPrompt\"")) return json(res, 200, { id: "journal-cover-test", choices: [{ message: { content: JSON.stringify({ frontPrompt: "Warm hand-drawn doorway opening toward a bright horizon, clean typography space, no text rendered in artwork", backText: "A guided place to remember, discover, challenge, create, become, and hope.", coverStatement: { text: "Ask a better question.", tags: ["reflection"] } }) } }] });
    const count = Number(String(user).match(/Create exactly (\d+)/)?.[1] || 2); const category = String(user).match(/original ([a-z-]+) prompts/)?.[1] || "discover";
    return json(res, 200, { id: "journal-prompt-test", choices: [{ message: { content: JSON.stringify({ prompts: Array.from({ length: count }, (_, i) => ({ text: `AI ${category} acceptance question ${i + 1}?`, tags: ["acceptance", category] })) }) } }] });
  });
  return new Promise((resolve) => server.listen(AI_PORT, HOST, () => resolve(server)));
}

async function main() {
  const dataDir = await mkdtemp(join(tmpdir(), "forge-journal-browser-"));
  const aiServer = await mockAi();
  const app = spawn(process.execPath, ["dist/guided-journal-server.js"], { env: { ...process.env, HOST, JOURNAL_PORT: String(PORT), FORGE_DATA_DIR: dataDir, AI_PROVIDER_ORDER: "omniroute", OMNIROUTE_BASE_URL: `http://${HOST}:${AI_PORT}`, OMNIROUTE_MODEL: "journal-test-model", OMNIROUTE_API_KEY: "", ROUTER9_BASE_URL: "", KINGS_AI_ENDPOINT: "", OPENAI_API_KEY: "", OLLAMA_BASE_URL: "" }, stdio: ["ignore", "pipe", "pipe"] });
  let browser;
  try {
    const base = `http://${HOST}:${PORT}`;
    await waitForHttp(`${base}/api/health`);
    let response = await fetch(`${base}/api/projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: projectId, title: "Guided Journal Acceptance" }) });
    assert.equal(response.ok, true, await response.text());
    const prompts = categories.flatMap((category) => Array.from({ length: 4 }, (_, i) => ({ id: `${category}-${i + 1}`, category, text: `${category} acceptance question ${i + 1}?`, tags: ["acceptance", category], enabled: true })));
    response = await fetch(`${base}/api/projects/${projectId}/journal/library/import`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompts, coverStatements: [{ id: "statement-1", text: "A question can change a day.", tags: ["reflection"], enabled: true }] }) });
    assert.equal(response.ok, true, await response.text());

    browser = await chromium.launch({ executablePath: process.env.FORGE_BROWSER_EXECUTABLE || chromium.executablePath(), headless: true, args: ["--no-sandbox", "--disable-gpu"] });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${base}/?project=${projectId}`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelector("#project-title")?.textContent === "Guided Journal Acceptance");
    assert.match(await page.locator("#brain-status").innerText(), /24 prompts/);
    assert.match(await page.locator("#brain-status").innerText(), /omniroute/);

    await page.locator('[data-panel="randomizer"]').click();
    await page.locator('#random-form [name="seed"]').fill("acceptance-random");
    const randomResponse = page.waitForResponse((r) => r.url().endsWith("/journal/random") && r.request().method() === "POST");
    await page.locator('#random-form button[type="submit"]').click();
    assert.equal((await randomResponse).ok(), true);
    await page.waitForFunction(() => document.querySelector("#random-result")?.textContent.includes("acceptance question"));

    await page.locator('[data-panel="edition"]').click();
    await page.locator('#edition-form [name="title"]').fill("The Better Question Acceptance Journal");
    await page.locator('#edition-form [name="seed"]').fill("acceptance-edition");
    await page.locator('#edition-form [name="promptCount"]').fill("12");
    await page.locator('#edition-form [name="pageStyle"]').selectOption("lined");
    const editionResponse = page.waitForResponse((r) => r.url().endsWith("/journal/editions") && r.request().method() === "POST");
    await page.locator('#edition-form button[type="submit"]').click();
    const edition = await (await editionResponse).json(); assert.equal(edition.prompts.length, 12); assert.equal(edition.pageStyle, "lined");
    await page.waitForFunction(() => document.querySelector("#current-edition")?.textContent.includes("12 questions"));

    await page.locator('[data-panel="formatting"]').click();
    await page.locator('#format-form [name="author"]').fill("Kevin Wakley");
    const renderResponse = page.waitForResponse((r) => r.url().endsWith("/journal/render") && r.request().method() === "POST");
    await page.locator('#format-form button[type="submit"]').click();
    const rendered = await (await renderResponse).json();
    assert.equal(rendered.artifact.format, "kdp-pdf"); assert.ok(rendered.layout.totalPages >= 24); assert.equal(Buffer.from(rendered.artifact.contentBase64, "base64").subarray(0, 5).toString(), "%PDF-");
    await page.waitForSelector("#download-pdf");

    await page.locator('[data-panel="ai"]').click();
    await page.locator('#ai-prompt-form [name="category"]').selectOption("discover");
    await page.locator('#ai-prompt-form [name="count"]').fill("2");
    await page.locator('#ai-prompt-form [name="purpose"]').fill("Help readers reflect on meaningful choices.");
    const aiPromptResponse = page.waitForResponse((r) => r.url().endsWith("/journal/ai/prompts") && r.request().method() === "POST");
    await page.locator('#ai-prompt-form button[type="submit"]').click();
    const proposal = await (await aiPromptResponse).json(); assert.equal(proposal.prompts.length, 2); assert.equal(proposal.ai.provider, "omniroute");
    await page.waitForFunction(() => document.querySelectorAll("#ai-prompt-result .ai-card").length === 2);
    const approveResponse = page.waitForResponse((r) => r.url().endsWith("/journal/ai/prompts/approve") && r.request().method() === "POST");
    await page.locator("#approve-ai-prompts").click(); assert.equal((await approveResponse).ok(), true);

    await page.locator('[data-panel="cover"]').click();
    await page.locator('#ai-cover-form [name="audience"]').fill("Adults who enjoy reflective guided journaling");
    const aiCoverResponse = page.waitForResponse((r) => r.url().endsWith("/journal/ai/cover") && r.request().method() === "POST");
    await page.locator('#ai-cover-form button[type="submit"]').click(); const coverDirection = await (await aiCoverResponse).json(); assert.equal(coverDirection.ai.provider, "omniroute");
    await page.waitForFunction(() => document.querySelector('#cover-form [name="frontPrompt"]')?.value.includes("horizon"));
    await page.locator('#cover-form [name="author"]').fill("Kevin Wakley");
    const coverResponse = page.waitForResponse((r) => r.url().endsWith("/journal/cover") && r.request().method() === "POST");
    await page.locator('#cover-form button[type="submit"]').click(); const cover = await (await coverResponse).json();
    assert.equal(cover.plan.publishing.pageCount, rendered.layout.totalPages); assert.ok(cover.plan.dimensions.spineWidthInches > 0);
    await page.waitForFunction(() => document.querySelector("#cover-result")?.textContent.includes("Spine"));

    await page.reload({ waitUntil: "networkidle" });
    await page.locator('[data-panel="history"]').click();
    await page.waitForFunction(() => document.querySelector("#edition-list")?.textContent.includes("The Better Question Acceptance Journal"));
    const info = await (await fetch(`${base}/api/projects/${projectId}`)).json(); assert.ok(info.memoryCount >= 2); assert.equal(info.coverPlanCount, 1); assert.equal(info.promptCount, 26);

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const phone = await mobile.newPage(); await phone.goto(`${base}/?project=${projectId}`, { waitUntil: "networkidle" });
    await phone.waitForFunction(() => document.querySelector("#project-title")?.textContent === "Guided Journal Acceptance");
    const dims = await phone.evaluate(() => ({ viewport: document.documentElement.clientWidth, body: document.body.scrollWidth, doc: document.documentElement.scrollWidth }));
    assert.ok(dims.body <= dims.viewport + 1, `Guided Journal mobile body overflow: ${JSON.stringify(dims)}`); assert.ok(dims.doc <= dims.viewport + 1, `Guided Journal mobile document overflow: ${JSON.stringify(dims)}`);
    const nav = phone.locator('[data-panel="randomizer"]'); const navBox = await nav.boundingBox(); assert.ok(navBox && navBox.height >= 40, `Journal mobile nav target too small: ${JSON.stringify(navBox)}`); await nav.tap();
    await phone.locator('#random-form [name="seed"]').fill("mobile-random"); const mobileRandom = phone.waitForResponse((r) => r.url().endsWith("/journal/random")); await phone.locator('#random-form button[type="submit"]').tap(); assert.equal((await mobileRandom).ok(), true);
    await mobile.close(); await context.close();
    console.log("GUIDED JOURNAL BROWSER ACCEPTANCE PASSED: durable library + randomizer + edition + lined PDF + Brain-aware AI approval + Cover Studio geometry + restart persistence + Android touch/fit.");
  } finally {
    if (browser) await browser.close().catch(() => {}); app.kill("SIGTERM"); aiServer.close(); await rm(dataDir, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });

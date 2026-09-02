#!/usr/bin/env node
const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { chromium } = require("@playwright/test");

const HOST = "127.0.0.1";
const PORT = 6800 + Math.floor(Math.random() * 100);
const AI_PORT = PORT + 130;
const projectId = `research-browser-${Date.now()}`;
const consultedUrl = "https://history.example/primary-source";

function json(res, status, value) { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(value)); }
async function body(req) { let raw = ""; for await (const chunk of req) raw += String(chunk); return raw ? JSON.parse(raw) : {}; }
async function waitForHttp(url, timeout = 12000) { const start = Date.now(); while (Date.now() - start < timeout) { try { if ((await fetch(url)).ok) return; } catch {} await new Promise((r) => setTimeout(r, 100)); } throw new Error(`Timed out waiting for ${url}`); }
function mockResponses() {
  const server = createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/v1/responses") return json(res, 404, { error: { message: "not found" } });
    const request = await body(req);
    assert.equal(request.model, "research-browser-model");
    assert.equal(request.tool_choice, "required");
    assert.deepEqual(request.include, ["web_search_call.action.sources"]);
    const user = request.input?.find((item) => item.role === "user")?.content || "";
    const bad = String(user).includes("hallucinated URL");
    const claims = [{
      source: "Historical Primary Source",
      date: "2026-08-29",
      url: bad ? "https://invented.example/not-consulted" : consultedUrl,
      claim: bad ? "This claim must never persist." : "The consulted primary source documents the exact historical detail requested by the author.",
      confidence: "high",
      relevance: "high",
    }];
    return json(res, 200, {
      id: "research-browser-response",
      output: [
        { type: "web_search_call", action: { sources: [{ type: "url", url: consultedUrl }] } },
        { type: "message", content: [{ type: "output_text", text: JSON.stringify({ claims }) }] },
      ],
    });
  });
  return new Promise((resolve) => server.listen(AI_PORT, HOST, () => resolve(server)));
}
async function api(base, path, method = "GET", payload) {
  const response = await fetch(base + path, { method, headers: { "content-type": "application/json" }, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) });
  const text = await response.text();
  assert.equal(response.ok, true, `${method} ${path} failed (${response.status}): ${text}`);
  return text ? JSON.parse(text) : {};
}
async function main() {
  const dataDir = await mkdtemp(join(tmpdir(), "forge-research-browser-"));
  const ai = await mockResponses();
  const app = spawn(process.execPath, ["dist/studio-server.js"], {
    env: { ...process.env, HOST, PORT: String(PORT), FORGE_DATA_DIR: dataDir, OPENAI_API_KEY: "research-browser-key", OPENAI_MODEL: "research-browser-model", OPENAI_RESEARCH_MODEL: "research-browser-model", OPENAI_RESPONSES_ENDPOINT: `http://${HOST}:${AI_PORT}/v1/responses`, AI_PROVIDER_ORDER: "openai", OMNIROUTE_BASE_URL: "", ROUTER9_BASE_URL: "", KINGS_AI_ENDPOINT: "", OLLAMA_BASE_URL: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let browser;
  try {
    const base = `http://${HOST}:${PORT}`;
    await waitForHttp(`${base}/api/health`);
    await api(base, "/api/projects", "POST", { id: projectId, title: "Live Research Acceptance" });

    browser = await chromium.launch({ executablePath: process.env.FORGE_BROWSER_EXECUTABLE || chromium.executablePath(), headless: true, args: ["--no-sandbox", "--disable-gpu"] });
    const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await desktop.newPage();
    await page.goto(`${base}/research.html?project=${projectId}`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelector("#research-status")?.textContent.includes("Live research blocked"));
    assert.equal(await page.locator("#run-live-research").isDisabled(), true, "No Paid Tokens must block hosted research in the browser.");

    await api(base, `/api/projects/${projectId}/ai/control`, "POST", { spendPolicy: "unrestricted", routingMode: "economy", providerOrder: ["openai"], pinnedProvider: null, pinnedModel: null, maxEstimatedRequestCostUsd: null });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelector("#research-status")?.textContent.includes("Live research ready"));
    assert.equal(await page.locator("#run-live-research").isDisabled(), false);

    await page.locator("#research-domain").selectOption("historical-period");
    await page.locator("#research-question").fill("What primary-source detail should this 1890s scene preserve?");
    await page.locator("#research-because").fill("Keep the manuscript historically accurate without changing the plot.");
    const liveResponse = page.waitForResponse((r) => r.url().endsWith("/research/live") && r.request().method() === "POST");
    await page.locator("#run-live-research").click();
    const completed = await liveResponse;
    assert.equal(completed.status(), 201, await completed.text());
    await page.waitForFunction(() => document.querySelector("#research-results")?.textContent.includes("consulted primary source"));
    assert.equal(await page.locator(`#research-results a[href="${consultedUrl}"]`).count(), 1);
    await page.waitForFunction(() => document.querySelector("#saved-research")?.textContent.includes("consulted primary source"));

    const afterSuccess = await api(base, `/api/projects/${projectId}`);
    const researchMemories = afterSuccess.memories.filter((memory) => memory.class === "research-memory");
    assert.equal(researchMemories.length, 1);
    assert.equal(researchMemories[0].authority, "working");
    assert.equal(JSON.parse(researchMemories[0].content).url, consultedUrl);

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelector("#saved-research")?.textContent.includes("consulted primary source"));
    await page.locator("#research-question").fill("Return a hallucinated URL so Forge proves it fails closed.");
    await page.locator("#research-because").fill("Acceptance safety check.");
    const badResponse = page.waitForResponse((r) => r.url().endsWith("/research/live") && r.request().method() === "POST");
    await page.locator("#run-live-research").click();
    assert.equal((await badResponse).status(), 500);
    await page.waitForFunction(() => document.querySelector("#research-error")?.textContent.includes("not returned by hosted web search"));
    assert.equal((await api(base, `/api/projects/${projectId}`)).memories.filter((memory) => memory.class === "research-memory").length, 1, "Rejected research must not mutate durable memory.");

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const phone = await mobile.newPage();
    await phone.goto(`${base}/research.html?project=${projectId}`, { waitUntil: "networkidle" });
    await phone.waitForFunction(() => document.querySelector("#research-status")?.textContent.includes("Live research ready"));
    const dims = await phone.evaluate(() => ({ viewport: document.documentElement.clientWidth, body: document.body.scrollWidth, doc: document.documentElement.scrollWidth }));
    assert.ok(dims.body <= dims.viewport + 1, `Research mobile body overflow: ${JSON.stringify(dims)}`);
    assert.ok(dims.doc <= dims.viewport + 1, `Research mobile document overflow: ${JSON.stringify(dims)}`);
    const buttonBox = await phone.locator("#run-live-research").boundingBox();
    assert.ok(buttonBox && buttonBox.height >= 40, `Research mobile touch target too small: ${JSON.stringify(buttonBox)}`);
    assert.match(await phone.locator("#saved-research").innerText(), /consulted primary source/);
    await mobile.close();
    await desktop.close();

    console.log("LIVE RESEARCH BROWSER ACCEPTANCE PASSED: owner spend gate + hosted web_search + source verification + durable working memory + rejected hallucinated URL + reload + Android fit/touch.");
  } finally {
    if (browser) await browser.close().catch(() => {});
    app.kill("SIGTERM");
    ai.close();
    await rm(dataDir, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });

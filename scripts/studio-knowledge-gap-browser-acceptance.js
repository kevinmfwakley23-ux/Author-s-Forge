#!/usr/bin/env node
const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { chromium } = require("@playwright/test");

const HOST = "127.0.0.1";
const PORT = 7020 + Math.floor(Math.random() * 100);
const AI_PORT = PORT + 120;
const projectId = `gap-browser-${Date.now()}`;
const consultedUrl = "https://archive.example/1895-lighting";
const gapQuestion = "What street-lighting technology was actually in use in this city in 1895?";

function json(res, status, value) { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(value)); }
async function body(req) { let raw = ""; for await (const chunk of req) raw += String(chunk); return raw ? JSON.parse(raw) : {}; }
async function waitForHttp(url, timeout = 12000) { const start = Date.now(); while (Date.now() - start < timeout) { try { if ((await fetch(url)).ok) return; } catch {} await new Promise((r) => setTimeout(r, 100)); } throw new Error(`Timed out waiting for ${url}`); }
async function api(base, path, method = "GET", payload) {
  const response = await fetch(base + path, { method, headers: { "content-type": "application/json" }, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) });
  const text = await response.text();
  assert.equal(response.ok, true, `${method} ${path} failed (${response.status}): ${text}`);
  return text ? JSON.parse(text) : {};
}

function mockAi() {
  const server = createServer(async (req, res) => {
    if (req.method !== "POST") return json(res, 404, { error: { message: "not found" } });
    const request = await body(req);
    if (req.url === "/v1/chat/completions") {
      assert.equal(request.model, "radar-browser-model");
      const system = String(request.messages?.find((item) => item.role === "system")?.content || "");
      assert.match(system, /Knowledge Gap Radar/);
      assert.match(system, /Do NOT answer the questions/);
      return json(res, 200, {
        id: "radar-browser-response",
        choices: [{ message: { content: JSON.stringify({ gaps: [
          {
            domain: "historical-period",
            question: gapQuestion,
            researchedBecause: "The dated scene should not rely on anachronistic public infrastructure.",
            basis: "The author explicitly asked Radar to inspect an 1895 street scene with a street lamp.",
            priority: "high",
          },
          {
            domain: "occupation",
            question: "What tools would a working stone mason plausibly carry for this task in 1895?",
            researchedBecause: "The work sequence should be grounded before the author revises tool details.",
            basis: "The scene focus mentions period trade work but does not establish period-appropriate tools.",
            priority: "medium",
          },
        ] }) } }],
      });
    }
    if (req.url === "/v1/responses") {
      assert.equal(request.model, "research-browser-model");
      assert.equal(request.tool_choice, "required");
      assert.deepEqual(request.include, ["web_search_call.action.sources"]);
      return json(res, 200, {
        id: "gap-research-browser-response",
        output: [
          { type: "web_search_call", action: { sources: [{ type: "url", url: consultedUrl }] } },
          { type: "message", content: [{ type: "output_text", text: JSON.stringify({ claims: [{
            source: "City Archive",
            date: "2026-08-31",
            url: consultedUrl,
            claim: "The consulted archive documents the street-lighting system relevant to the author's 1895 setting.",
            confidence: "high",
            relevance: "high",
          }] }) }] },
        ],
      });
    }
    return json(res, 404, { error: { message: "not found" } });
  });
  return new Promise((resolve) => server.listen(AI_PORT, HOST, () => resolve(server)));
}

async function main() {
  const dataDir = await mkdtemp(join(tmpdir(), "forge-gap-browser-"));
  const ai = await mockAi();
  const app = spawn(process.execPath, ["dist/studio-server.js"], {
    env: {
      ...process.env,
      HOST,
      PORT: String(PORT),
      FORGE_DATA_DIR: dataDir,
      AI_PROVIDER_ORDER: "omniroute,openai",
      OMNIROUTE_BASE_URL: `http://${HOST}:${AI_PORT}`,
      OMNIROUTE_MODEL: "radar-browser-model",
      OMNIROUTE_BILLING_CLASS: "subscription",
      OMNIROUTE_API_KEY: "",
      ROUTER9_BASE_URL: "",
      KINGS_AI_ENDPOINT: "",
      OLLAMA_BASE_URL: "",
      OPENAI_API_KEY: "research-browser-key",
      OPENAI_MODEL: "research-browser-model",
      OPENAI_RESEARCH_MODEL: "research-browser-model",
      OPENAI_RESPONSES_ENDPOINT: `http://${HOST}:${AI_PORT}/v1/responses`,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let browser;
  try {
    const base = `http://${HOST}:${PORT}`;
    await waitForHttp(`${base}/api/health`);
    await api(base, "/api/projects", "POST", { id: projectId, title: "Knowledge Gap Browser Acceptance" });
    browser = await chromium.launch({ executablePath: process.env.FORGE_BROWSER_EXECUTABLE || chromium.executablePath(), headless: true, args: ["--no-sandbox", "--disable-gpu"] });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${base}/research.html?project=${projectId}`, { waitUntil: "networkidle" });

    await page.waitForFunction(() => document.querySelector("#research-status")?.textContent.includes("blocked"));
    assert.equal(await page.locator("#run-live-research").isDisabled(), true, "Hosted source research must remain blocked under No Paid Tokens.");
    assert.equal(await page.locator("#scan-knowledge-gaps").isDisabled(), false, "Subscription-covered Radar should remain available through the normal broker.");

    await page.locator("#gap-focus").fill("Inspect the 1895 street scene and period trade details for facts I should verify.");
    const scanResponse = page.waitForResponse((response) => response.url().endsWith("/research/gaps/scan") && response.request().method() === "POST");
    await page.locator("#scan-knowledge-gaps").click();
    assert.equal((await scanResponse).status(), 201);
    await page.waitForFunction((question) => document.querySelector("#knowledge-gaps")?.textContent.includes(question), gapQuestion);
    assert.match(await page.locator("#knowledge-gaps").innerText(), /hypothesis only/i);
    assert.match(await page.locator("#knowledge-gaps").innerText(), /Detected by omniroute\/radar-browser-model/i);
    assert.equal(await page.locator('[data-gap-action="research"]').first().isDisabled(), true, "Radar must not bypass hosted research spend policy.");

    let project = await api(base, `/api/projects/${projectId}`);
    assert.equal(project.memories.filter((memory) => memory.class === "research-memory").length, 0, "Radar questions must not become Project Brain facts.");
    const gapList = await api(base, `/api/projects/${projectId}/research/gaps`);
    assert.equal(gapList.gaps.length, 2);
    assert.equal(gapList.policy.projectBrainMemory, false);
    const firstGapId = gapList.gaps.find((gap) => gap.question === gapQuestion).id;

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction((question) => document.querySelector("#knowledge-gaps")?.textContent.includes(question), gapQuestion);
    assert.match(await page.locator("#radar-status").innerText(), /2 open research questions/i, "Gap queue must survive server-backed reload.");

    await api(base, `/api/projects/${projectId}/ai/control`, "POST", { spendPolicy: "unrestricted", routingMode: "economy", providerOrder: ["omniroute", "openai"], pinnedProvider: null, pinnedModel: null, maxEstimatedRequestCostUsd: null });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelector("#research-status")?.textContent.includes("ready"));
    const researchButton = page.locator(`[data-gap-id="${firstGapId}"][data-gap-action="research"]`);
    assert.equal(await researchButton.isDisabled(), false);
    const researchResponse = page.waitForResponse((response) => response.url().endsWith(`/research/gaps/${firstGapId}/research`) && response.request().method() === "POST");
    await researchButton.click();
    assert.equal((await researchResponse).status(), 201);
    await page.waitForFunction((question) => {
      const card = [...document.querySelectorAll(".gap-card")].find((node) => node.textContent.includes(question));
      return card?.dataset.status === "researched" && card.textContent.includes("Evidence linked");
    }, gapQuestion);
    await page.waitForFunction(() => document.querySelector("#saved-research")?.textContent.includes("consulted archive"));

    project = await api(base, `/api/projects/${projectId}`);
    assert.equal(project.memories.filter((memory) => memory.class === "research-memory").length, 1, "Only verified source-backed research may enter working Project Brain research memory.");
    const completedGap = (await api(base, `/api/projects/${projectId}/research/gaps`)).gaps.find((gap) => gap.id === firstGapId);
    assert.equal(completedGap.status, "researched");
    assert.equal(completedGap.researchMemoryIds.length, 1);

    const dismissButton = page.locator('[data-gap-action="dismiss"]').first();
    await dismissButton.click();
    await page.waitForFunction(() => [...document.querySelectorAll(".gap-card")].some((node) => node.dataset.status === "dismissed"));

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const phone = await mobile.newPage();
    await phone.goto(`${base}/research.html?project=${projectId}`, { waitUntil: "networkidle" });
    await phone.waitForSelector("#knowledge-gap-radar");
    const dims = await phone.evaluate(() => ({ viewport: document.documentElement.clientWidth, body: document.body.scrollWidth, doc: document.documentElement.scrollWidth }));
    assert.ok(dims.body <= dims.viewport + 1, `Knowledge Gap Radar mobile body overflow: ${JSON.stringify(dims)}`);
    assert.ok(dims.doc <= dims.viewport + 1, `Knowledge Gap Radar mobile document overflow: ${JSON.stringify(dims)}`);
    const scanBox = await phone.locator("#scan-knowledge-gaps").boundingBox();
    assert.ok(scanBox && scanBox.height >= 40, `Knowledge Gap Radar mobile scan target too small: ${JSON.stringify(scanBox)}`);
    await mobile.close();
    await context.close();

    console.log("KNOWLEDGE GAP RADAR BROWSER ACCEPTANCE PASSED: proactive real-AI questions + no Project Brain contamination + durable queue + spend-gated source verification + evidence linkage + dismissal + Android fit/touch.");
  } finally {
    if (browser) await browser.close().catch(() => {});
    app.kill("SIGTERM");
    ai.close();
    await rm(dataDir, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });

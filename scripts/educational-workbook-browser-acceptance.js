#!/usr/bin/env node
const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { chromium } = require("@playwright/test");

const HOST = "127.0.0.1";
const PORT = 5750 + Math.floor(Math.random() * 100);
const AI_PORT = PORT + 120;
const projectId = `workbook-browser-${Date.now()}`;

async function waitForHttp(url, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function responseJson(responsePromise, label) {
  const response = await responsePromise;
  const text = await response.text();
  assert.equal(response.ok(), true, `${label} failed (${response.status()}): ${text}`);
  try { return JSON.parse(text); }
  catch { assert.fail(`${label} returned invalid JSON: ${text}`); }
}

function json(res, status, value) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(value));
}

function mockAi() {
  const server = createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/v1/chat/completions") return json(res, 404, { error: { message: "not found" } });
    let raw = "";
    for await (const chunk of req) raw += String(chunk);
    const payload = JSON.parse(raw || "{}");
    assert.equal(payload.model, "workbook-test-model");
    const user = payload.messages?.find((message) => message.role === "user")?.content || "";
    assert.match(String(user), /Learning objective: Practice multiplication facts accurately/);
    return json(res, 200, {
      id: "workbook-ai-browser",
      choices: [{ message: { content: JSON.stringify({
        activities: [
          { prompt: "Solve 8 × 6.", answer: "48", explanation: "Eight groups of six equal 48.", standards: [], tags: ["multiplication"], points: 1 },
          { prompt: "Solve 7 × 12.", answer: "84", explanation: "Seven groups of twelve equal 84.", standards: [], tags: ["multiplication"], points: 1 },
        ],
      }) } }],
      usage: { prompt_tokens: 140, completion_tokens: 60, total_tokens: 200 },
    });
  });
  return new Promise((resolve) => server.listen(AI_PORT, HOST, () => resolve(server)));
}

async function main() {
  const dataDir = await mkdtemp(join(tmpdir(), "forge-workbook-browser-"));
  const aiServer = await mockAi();
  const app = spawn(process.execPath, ["dist/educational-workbook-server.js"], {
    env: {
      ...process.env,
      HOST,
      WORKBOOK_PORT: String(PORT),
      FORGE_DATA_DIR: dataDir,
      AI_PROVIDER_ORDER: "omniroute",
      OMNIROUTE_BASE_URL: `http://${HOST}:${AI_PORT}`,
      OMNIROUTE_MODEL: "workbook-test-model",
      OMNIROUTE_API_KEY: "",
      ROUTER9_BASE_URL: "",
      KINGS_AI_ENDPOINT: "",
      OPENAI_API_KEY: "",
      OPENAI_MODEL: "",
      OLLAMA_BASE_URL: "",
      OLLAMA_MODEL: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let browser;
  try {
    const base = `http://${HOST}:${PORT}`;
    await waitForHttp(`${base}/api/health`);
    let response = await fetch(`${base}/api/projects`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: projectId, title: "Educational Workbook Acceptance" }),
    });
    assert.equal(response.ok, true, await response.text());

    const activities = [
      { id: "math-1", subject: "math", gradeBands: ["3-5"], kind: "math-practice", prompt: "Solve 9 × 7.", answer: "63", standards: ["CCSS.MATH.CONTENT.4.NBT.B.5"], tags: ["multiplication"], points: 1 },
      { id: "math-2", subject: "math", gradeBands: ["3-5"], kind: "multiple-choice", prompt: "Which fraction equals one half?", choices: ["1/4", "2/4", "3/4"], answer: "2/4", standards: ["CCSS.MATH.CONTENT.4.NF.A.1"], tags: ["fractions"], points: 1 },
      { id: "lit-1", subject: "literacy", gradeBands: ["3-5"], kind: "short-answer", prompt: "What does a main idea tell the reader?", answer: "The central point of a text.", standards: ["CCSS.ELA-LITERACY.RI.4.2"], tags: ["reading"], points: 1 },
      { id: "science-1", subject: "science", gradeBands: ["3-5"], kind: "true-false", prompt: "Water can exist as a solid, liquid, or gas.", answer: "true", standards: [], tags: ["matter"], points: 1 },
    ];
    response = await fetch(`${base}/api/projects/${projectId}/workbooks/library/import`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ activities }),
    });
    assert.equal(response.ok, true, await response.text());

    browser = await chromium.launch({ executablePath: process.env.FORGE_BROWSER_EXECUTABLE || chromium.executablePath(), headless: true, args: ["--no-sandbox", "--disable-gpu"] });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${base}/?project=${projectId}`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelector("#project-status")?.textContent.includes("Educational Workbook Acceptance"));
    assert.match(await page.locator("#metrics").innerText(), /4 activities/);

    await page.locator('[data-show="ai"]').click();
    await page.locator('#ai-form [name="count"]').fill("2");
    await page.locator('#ai-form [name="learningObjective"]').fill("Practice multiplication facts accurately");
    const aiResponse = page.waitForResponse((r) => r.url().endsWith("/workbooks/ai/activities") && r.request().method() === "POST");
    await page.locator('#ai-form button[type="submit"]').click();
    const proposal = await responseJson(aiResponse, "Educational Workbook Brain AI proposal");
    assert.equal(proposal.status, "pending");
    assert.equal(proposal.ai.provider, "omniroute");
    assert.equal(proposal.ai.model, "workbook-test-model");
    assert.equal(proposal.ai.usage.totalTokens, 200);
    assert.equal(proposal.activities.length, 2);
    await page.waitForFunction(() => document.querySelector("#proposal-list")?.textContent.includes("PENDING"));
    assert.match(await page.locator("#proposal-list").innerText(), /provider usage 200/);
    let library = await (await fetch(`${base}/api/projects/${projectId}/workbooks/library`)).json();
    assert.equal(library.activities.length, 4, "Pending AI proposal must not auto-persist into the activity library.");

    const approveResponse = page.waitForResponse((r) => /workbooks\/ai\/proposals\/[^/]+\/approve$/.test(r.url()) && r.request().method() === "POST");
    await page.locator("[data-approve-proposal]").first().click();
    assert.equal((await approveResponse).ok(), true);
    await page.waitForFunction(() => document.querySelector("#proposal-list")?.textContent.includes("APPROVED"));
    library = await (await fetch(`${base}/api/projects/${projectId}/workbooks/library`)).json();
    assert.equal(library.activities.length, 6, "Approved AI proposal must persist its exact activities.");

    await page.locator('[data-show="edition"]').click();
    await page.locator('#edition-form [name="title"]').fill("Grade 4 Mixed Skills Workbook");
    await page.locator('#edition-form [name="activityCount"]').fill("6");
    await page.locator('#edition-form [name="seed"]').fill("browser-stable-seed");
    await page.locator('#edition-form [name="learningObjectives"]').fill("Practice grade 4 math, literacy, and science skills.");
    const editionResponse = page.waitForResponse((r) => r.url().endsWith("/workbooks/editions") && r.request().method() === "POST");
    await page.locator('#edition-form button[type="submit"]').click();
    const workbook = await responseJson(editionResponse, "Educational Workbook edition generation");
    assert.equal(workbook.activities.length, 6);
    assert.equal(new Set(workbook.sourceActivityIds).size, 6);
    assert.equal(workbook.answerKey.length, 6);

    await page.locator('[data-show="production"]').click();
    await page.locator('#production-form [name="author"]').fill("Acceptance Educator");
    const renderResponse = page.waitForResponse((r) => r.url().endsWith("/workbooks/render") && r.request().method() === "POST");
    await page.locator('#production-form button[type="submit"]').click();
    const rendered = await responseJson(renderResponse, "Educational Workbook PDF render");
    assert.equal(rendered.artifact.format, "pdf");
    assert.equal(Buffer.from(rendered.artifact.contentBase64, "base64").subarray(0, 5).toString(), "%PDF-");
    assert.equal(rendered.layout.activityPages, 6);
    assert.equal(rendered.layout.answerKeyIncluded, true);
    await page.waitForSelector("#download-pdf");

    const info = await (await fetch(`${base}/api/projects/${projectId}`)).json();
    assert.equal(info.activityCount, 6);
    assert.equal(info.workbookCount, 1);
    assert.equal(info.pendingAiProposalCount, 0);
    assert.ok(info.memoryCount >= 1, "Workbook edition must be recorded in Project Brain production memory.");
    assert.equal(info.ai.resources[0].provider, "omniroute");
    assert.ok(info.ai.routing.some((entry) => entry.provider === "omniroute" && entry.totalTokens === 200));

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const phone = await mobile.newPage();
    await phone.goto(`${base}/?project=${projectId}`, { waitUntil: "networkidle" });
    await phone.waitForFunction(() => document.querySelector("#project-status")?.textContent.includes("Educational Workbook Acceptance"));
    const dimensions = await phone.evaluate(() => ({ viewport: document.documentElement.clientWidth, body: document.body.scrollWidth, doc: document.documentElement.scrollWidth }));
    assert.ok(dimensions.body <= dimensions.viewport + 1, `Educational Workbook mobile body overflow: ${JSON.stringify(dimensions)}`);
    assert.ok(dimensions.doc <= dimensions.viewport + 1, `Educational Workbook mobile document overflow: ${JSON.stringify(dimensions)}`);
    const nav = phone.locator('[data-show="ai"]');
    const navBox = await nav.boundingBox();
    assert.ok(navBox && navBox.height >= 40, `Educational Workbook mobile AI nav target too small: ${JSON.stringify(navBox)}`);
    await nav.tap();
    await phone.waitForFunction(() => document.querySelector("#proposal-list")?.textContent.includes("APPROVED"));
    await phone.close();
    await context.close();

    console.log("EDUCATIONAL WORKBOOK BROWSER ACCEPTANCE PASSED: durable library + Project Brain AI proposal/approval + provider usage telemetry + deterministic edition + answer key + real PDF + Android touch/fit.");
  } finally {
    if (browser) await browser.close().catch(() => {});
    app.kill("SIGTERM");
    aiServer.close();
    await rm(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
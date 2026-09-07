#!/usr/bin/env node
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const net = require("node:net");
const { chromium } = require("@playwright/test");

const HOST = "127.0.0.1";
const PROJECT_ID = `journal-journey-browser-${Date.now()}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, HOST, () => {
      const address = server.address();
      const port = address && typeof address === "object" ? address.port : 0;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForHttp(url, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([new Promise((resolve) => child.once("exit", resolve)), sleep(3000)]);
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
}

async function main() {
  const dataDir = await mkdtemp(join(tmpdir(), "forge-journal-journey-browser-"));
  const port = await reservePort();
  const base = `http://${HOST}:${port}`;
  const app = spawn(process.execPath, ["dist/guided-journal-server.js"], {
    env: {
      ...process.env,
      HOST,
      JOURNAL_PORT: String(port),
      FORGE_DATA_DIR: dataDir,
      OMNIROUTE_BASE_URL: "",
      ROUTER9_BASE_URL: "",
      KINGS_AI_RESPONSES_URL: "",
      KINGS_AI_ENDPOINT: "",
      OPENAI_API_KEY: "",
      OLLAMA_BASE_URL: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  app.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  let browser;
  try {
    await waitForHttp(`${base}/api/health`).catch((error) => { throw new Error(`${error.message}\n${stderr}`); });
    let response = await fetch(`${base}/api/projects`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: PROJECT_ID, title: "Guided Journey Acceptance" }),
    });
    assert.equal(response.ok, true, await response.text());

    const prompts = [
      { id: "remember-1", category: "remember", text: "What memory still makes you grateful?", tags: ["gratitude", "depth:gentle"], enabled: true },
      { id: "discover-1", category: "discover", text: "What are you learning about yourself?", tags: ["self-discovery", "depth:deep"], enabled: true },
      { id: "challenge-1", category: "challenge", text: "What challenge proved your resilience?", tags: ["resilience", "depth:deep"], enabled: true },
      { id: "create-1", category: "create", text: "What would you create if fear disappeared?", tags: ["creativity"], enabled: true },
      { id: "become-1", category: "become", text: "Who are you becoming through your habits?", tags: ["habits", "confidence"], enabled: true },
      { id: "hope-1", category: "hope", text: "What future are you willing to work toward?", tags: ["purpose", "planning"], enabled: true },
    ];
    response = await fetch(`${base}/api/projects/${PROJECT_ID}/journal/library/import`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompts }),
    });
    assert.equal(response.ok, true, await response.text());

    browser = await chromium.launch({ executablePath: process.env.FORGE_BROWSER_EXECUTABLE || chromium.executablePath(), headless: true, args: ["--no-sandbox", "--disable-gpu"] });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
    const page = await context.newPage();
    await page.goto(`${base}/?project=${encodeURIComponent(PROJECT_ID)}`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-panel="journeys"]');
    await page.locator('[data-panel="journeys"]').click();
    await page.waitForSelector("#journey-pack-form");

    await page.locator('#journey-pack-form [name="id"]').fill("journey-pack-1");
    await page.locator('#journey-pack-form [name="title"]').fill("Six Question Reflection");
    await page.locator('#journey-pack-form [name="mode"]').selectOption("deterministic-shuffle");
    await page.locator('#journey-pack-form [name="promptIds"]').fill(prompts.map((prompt) => prompt.id).join("\n"));
    const packResponse = page.waitForResponse((r) => r.url().endsWith("/journal/journey-packs") && r.request().method() === "POST");
    await page.locator('#journey-pack-form button[type="submit"]').click();
    assert.equal((await packResponse).ok(), true);
    await page.waitForFunction(() => document.querySelector("#journey-pack-list")?.textContent.includes("Six Question Reflection"));

    await page.locator('#journey-start-form [name="id"]').fill("journey-1");
    await page.locator('#journey-start-form [name="packId"]').selectOption("journey-pack-1");
    await page.locator('#journey-start-form [name="seed"]').fill("browser-seed");
    const startResponse = page.waitForResponse((r) => r.url().endsWith("/journal/journeys") && r.request().method() === "POST");
    await page.locator('#journey-start-form button[type="submit"]').click();
    assert.equal((await startResponse).ok(), true);
    await page.waitForFunction(() => document.querySelector("#journey-current")?.textContent.includes("NEXT QUESTION"));

    const completeButton = page.locator('#journey-current [data-journey-action="complete"]').first();
    const completeResponse = page.waitForResponse((r) => r.url().includes("/journal/journeys/journey-1/complete"));
    await completeButton.click();
    assert.equal((await completeResponse).ok(), true);
    await page.waitForFunction(() => document.querySelector("#journey-current")?.textContent.includes("1/6"));

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector('[data-panel="journeys"]');
    await page.locator('[data-panel="journeys"]').click();
    await page.waitForFunction(() => document.querySelector("#journey-list")?.textContent.includes("journey-1"));
    await page.locator('[data-open-journey="journey-1"]').click();
    await page.waitForFunction(() => document.querySelector("#journey-current")?.textContent.includes("1/6"));

    await page.locator('#journey-personal-form [name="journeyId"]').fill("personalized-1");
    await page.locator('#journey-personal-form [name="packId"]').fill("personalized-pack-1");
    await page.locator('#journey-personal-form [name="title"]').fill("Resilience Reflection");
    await page.locator('#journey-personal-form [name="goal"]').selectOption("resilience");
    await page.locator('#journey-personal-form [name="reflectionDepth"]').selectOption("deep");
    await page.locator('#journey-personal-form [name="promptCount"]').fill("3");
    await page.locator('#journey-personal-form [name="seed"]').fill("personalized-browser-seed");
    const personalizedResponse = page.waitForResponse((r) => r.url().endsWith("/journal/journeys/personalized") && r.request().method() === "POST");
    await page.locator('#journey-personal-form button[type="submit"]').click();
    const personalized = await personalizedResponse;
    assert.equal(personalized.ok(), true, await personalized.text());
    await page.waitForFunction(() => document.querySelector("#journey-list")?.textContent.includes("personalized-1"));

    const persisted = await (await fetch(`${base}/api/projects/${PROJECT_ID}/journal/journeys`)).json();
    assert.equal(persisted.length, 2);
    assert.equal(persisted.find((item) => item.id === "journey-1")?.completedPromptIds.length, 1);
    assert.equal(persisted.find((item) => item.id === "personalized-1")?.promptOrder.length, 3);

    await context.close();
    console.log("GUIDED JOURNAL JOURNEY BROWSER ACCEPTANCE PASSED: frozen prompt packs, persisted progress, resume-after-reload, and questionnaire-personalized journeys are live in the Forge UI.");
  } finally {
    if (browser) await browser.close().catch(() => {});
    await stop(app).catch(() => {});
    await rm(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });

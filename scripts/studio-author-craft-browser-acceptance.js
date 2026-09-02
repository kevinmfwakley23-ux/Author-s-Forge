#!/usr/bin/env node
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtemp, readFile, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { chromium } = require("@playwright/test");

const HOST = "127.0.0.1";
const PORT = 5660 + Math.floor(Math.random() * 160);

async function waitForHttp(url, timeoutMs = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function main() {
  const dataDir = await mkdtemp(join(tmpdir(), "forge-author-craft-"));
  const server = spawn(process.execPath, ["dist/studio-server.js"], {
    env: {
      ...process.env,
      HOST,
      PORT: String(PORT),
      FORGE_DATA_DIR: dataDir,
      OPENAI_API_KEY: "",
      OPENAI_MODEL: "",
      OLLAMA_BASE_URL: "",
      OLLAMA_MODEL: "",
      KINGS_AI_ENDPOINT: "",
      OMNIROUTE_BASE_URL: "",
      ROUTER9_BASE_URL: "",
      GROQ_API_KEY: "",
      MISTRAL_API_KEY: "",
      GEMINI_API_KEY: "",
      ANTHROPIC_API_KEY: "",
      OPENROUTER_API_KEY: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let browser;
  try {
    const base = `http://${HOST}:${PORT}`;
    await waitForHttp(`${base}/api/health`);
    browser = await chromium.launch({ executablePath: process.env.FORGE_BROWSER_EXECUTABLE || chromium.executablePath(), headless: true, args: ["--no-sandbox", "--disable-gpu"] });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await page.goto(`${base}/author-craft.html?project=forge-studio`, { waitUntil: "networkidle" });

    await page.waitForSelector("#ai-control-card");
    assert.equal(await page.locator("#ai-spend-policy").inputValue(), "no-paid-tokens", "No Paid Tokens must be the real default");
    assert.match(await page.locator("#ai-policy-explanation").innerText(), /metered, unknown, and gateway-managed resources are blocked/i);

    const saveBox = await page.locator("#ai-control-form button[type=submit]").boundingBox();
    assert.ok(saveBox && saveBox.height >= 40, `AI control save target is too small for touch: ${JSON.stringify(saveBox)}`);
    await page.locator("#ai-routing-mode").selectOption("quality");
    await page.locator("#ai-control-form button[type=submit]").tap();
    await page.waitForFunction(() => document.querySelector("#craft-status")?.textContent.includes("Paid-token fallback is blocked"));

    const persisted = JSON.parse(await readFile(join(dataDir, "ai-runtime-control.json"), "utf8"));
    assert.equal(persisted.spendPolicy, "no-paid-tokens");
    assert.equal(persisted.routingMode, "quality");

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("#ai-control-card");
    assert.equal(await page.locator("#ai-routing-mode").inputValue(), "quality", "AI owner control must survive reload");

    await page.waitForSelector("[data-training-answer]");
    const questionCount = await page.locator("[data-training-answer]").count();
    assert.ok(questionCount >= 14, `expected comprehensive Author Training questions, got ${questionCount}`);
    assert.match(await page.locator("#training-progress").innerText(), new RegExp(`0 of ${questionCount} questions answered`));

    const verse = [
      "A tiger padded through the night,",
      "Beneath the moon so warm and bright,",
      "He heard a friend beside the tree,",
      "Who laughed and shared a cup of tea.",
    ].join("\n");
    await page.locator("#rhyme-text").fill(verse);
    await page.locator("#rhyme-analyze").tap();
    await page.waitForFunction(() => document.querySelector("#rhyme-findings")?.textContent.includes("Detected scheme"));
    assert.match(await page.locator("#rhyme-findings").innerText(), /Protect story meaning|meaning, character voice|natural near-rhyme/i);
    assert.equal(await page.locator("#rhyme-text").inputValue(), verse, "analysis must not rewrite source verse");

    const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, body: document.body.scrollWidth, document: document.documentElement.scrollWidth }));
    assert.ok(dimensions.body <= dimensions.viewport + 1, `Author Craft introduced horizontal body overflow: ${JSON.stringify(dimensions)}`);
    assert.ok(dimensions.document <= dimensions.viewport + 1, `Author Craft introduced horizontal document overflow: ${JSON.stringify(dimensions)}`);

    console.log("AUTHOR CRAFT BROWSER ACCEPTANCE PASSED: No Paid Tokens default + durable owner control + comprehensive voice questions + rhyme analysis + Android-sized touch/overflow.");
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill("SIGTERM");
    await new Promise((resolve) => server.exitCode !== null ? resolve() : server.once("exit", resolve));
    await rm(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });

#!/usr/bin/env node
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { chromium } = require("@playwright/test");

const HOST = "127.0.0.1";
const PORT = 5480 + Math.floor(Math.random() * 180);

async function waitForHttp(url, timeoutMs = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function main() {
  const dataDir = await mkdtemp(join(tmpdir(), "forge-children-topics-"));
  const server = spawn(process.execPath, ["dist/studio-server.js"], {
    env: { ...process.env, HOST, PORT: String(PORT), FORGE_DATA_DIR: dataDir, OPENAI_API_KEY: "", OPENAI_MODEL: "", OLLAMA_BASE_URL: "", OLLAMA_MODEL: "", KINGS_AI_ENDPOINT: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let browser;
  try {
    const base = `http://${HOST}:${PORT}`;
    await waitForHttp(`${base}/api/health`);
    browser = await chromium.launch({ executablePath: process.env.FORGE_BROWSER_EXECUTABLE || chromium.executablePath(), headless: true, args: ["--no-sandbox", "--disable-gpu"] });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await page.goto(base, { waitUntil: "networkidle" });
    await page.waitForFunction(() => Boolean(window.forgeChildrenStoryTopics));

    const runButton = page.locator("#dashboard-command-run");
    const box = await runButton.boundingBox();
    assert.ok(box && box.height >= 40, `topic command target is too small for touch: ${JSON.stringify(box)}`);
    await page.locator("#dashboard-command").fill("Compile a list of up to 100 common children's issues and struggles for my Heartwood Jungle story series, including friendship and feeling safe.");
    await runButton.tap();
    await page.waitForFunction(() => document.querySelector("#fcc-result")?.textContent.includes("Heartwood Jungle story-topic list (100)"));
    const fullText = await page.locator("#fcc-result").innerText();
    const numbered = fullText.split("\n").filter((line) => /^\d+\.\s/.test(line));
    assert.equal(numbered.length, 100, `expected 100 story topics, got ${numbered.length}`);
    assert.match(fullText, /Making a new friend/);
    assert.match(fullText, /Wanting to feel safe at home or school/);
    assert.match(fullText, /Heartwood framing:/);
    assert.match(fullText, /CDC/);
    assert.doesNotMatch(fullText, /provider.*not configured|OPENAI_API_KEY|OLLAMA/i);

    await page.locator("#fcc-command").fill("Give me 7 children's story challenges about friendship and belonging.");
    await page.locator("#fcc-run").tap();
    await page.waitForFunction(() => document.querySelector("#fcc-result")?.textContent.includes("Children's story-topic list (7)"));
    const shortText = await page.locator("#fcc-result").innerText();
    assert.equal(shortText.split("\n").filter((line) => /^\d+\.\s/.test(line)).length, 7);

    const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, body: document.body.scrollWidth, document: document.documentElement.scrollWidth }));
    assert.ok(dimensions.body <= dimensions.viewport + 1, `children topics introduced horizontal body overflow: ${JSON.stringify(dimensions)}`);
    assert.ok(dimensions.document <= dimensions.viewport + 1, `children topics introduced horizontal document overflow: ${JSON.stringify(dimensions)}`);

    console.log("CHILDREN'S STORY TOPICS BROWSER ACCEPTANCE PASSED: 100-topic Heartwood command + bounded count + no-provider path + Android-sized touch/overflow.");
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill("SIGTERM");
    await new Promise((resolve) => server.exitCode !== null ? resolve() : server.once("exit", resolve));
    await rm(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });

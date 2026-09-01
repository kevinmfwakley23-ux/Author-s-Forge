#!/usr/bin/env node
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const { homedir, tmpdir } = require("node:os");
const { join } = require("node:path");
const { existsSync, readdirSync } = require("node:fs");
const { chromium } = require("@playwright/test");
const { calculateKdpCoverLayout } = require("../dist/domain/book-cover-studio.js");

const HOST = "127.0.0.1";
const PORT = 6100 + Math.floor(Math.random() * 300);
const projectId = `kdp-ui-${Date.now()}`;

function findBrowser() {
  if (process.env.FORGE_BROWSER_EXECUTABLE) {
    if (!existsSync(process.env.FORGE_BROWSER_EXECUTABLE)) throw new Error(`FORGE_BROWSER_EXECUTABLE does not exist: ${process.env.FORGE_BROWSER_EXECUTABLE}`);
    return process.env.FORGE_BROWSER_EXECUTABLE;
  }
  const system = ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/chrome"].find(existsSync);
  if (system) return system;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH === "0" ? join(process.cwd(), "node_modules", "playwright-core") : process.env.PLAYWRIGHT_BROWSERS_PATH || join(homedir(), ".cache", "ms-playwright");
  if (!existsSync(root)) return null;
  const candidates = [];
  const walk = (directory, depth = 0) => {
    if (depth > 5) return;
    let entries = [];
    try { entries = readdirSync(directory, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isFile() && entry.name === "chrome") candidates.push(path);
      else if (entry.isDirectory()) walk(path, depth + 1);
    }
  };
  walk(root);
  return candidates.find((candidate) => /chromium|chrome/i.test(candidate)) || candidates[0] || null;
}

async function waitForHttp(url, timeoutMs = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function main() {
  const executablePath = findBrowser();
  if (!executablePath) throw new Error("KDP PREFLIGHT BROWSER ACCEPTANCE BLOCKED: no Chrome/Chromium executable found.");
  const dataDir = await mkdtemp(join(tmpdir(), "authors-forge-kdp-ui-"));
  const server = spawn(process.execPath, ["dist/studio-server.js"], {
    env: { ...process.env, PORT: String(PORT), HOST, FORGE_DATA_DIR: dataDir, OPENAI_API_KEY: "", OPENAI_MODEL: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let browser;
  try {
    const baseUrl = `http://${HOST}:${PORT}`;
    await waitForHttp(`${baseUrl}/api/health`);
    const created = await fetch(`${baseUrl}/api/projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: projectId, title: "KDP UI Acceptance" }) });
    assert.equal(created.ok, true, await created.text());

    const publishing = { platform: "kdp", binding: "paperback", interiorType: "black-white", paperType: "white", trimWidthInches: 6, trimHeightInches: 9, pageCount: 120, bleedInches: 0.125, readingDirection: "ltr" };
    const layout = calculateKdpCoverLayout(publishing);

    browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-gpu"] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`${baseUrl}/?project=${encodeURIComponent(projectId)}#publishing`, { waitUntil: "networkidle" });
    await page.waitForSelector("#kdp-preflight-form");
    await page.locator("#kdp-cover-width").fill(String(layout.dimensions.widthInches));
    await page.locator("#kdp-cover-height").fill(String(layout.dimensions.heightInches));
    await page.locator("#kdp-preflight-form").evaluate((form) => form.requestSubmit());
    await page.waitForFunction(() => document.querySelector("#kdp-preflight-summary")?.textContent.startsWith("READY"));
    await page.waitForFunction(() => document.querySelector("#kdp-preflight-history")?.textContent.includes("READY"));
    assert.match(await page.locator("#kdp-preflight-summary").innerText(), /0 errors/);
    assert.match(await page.locator("#kdp-preflight-history").innerText(), /READY/);

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("#kdp-preflight-form");
    await page.waitForFunction(() => document.querySelector("#kdp-preflight-history")?.textContent.includes("READY"));
    assert.match(await page.locator("#kdp-preflight-summary").innerText(), /READY/);

    await page.locator("#kdp-cover-width").fill(String(layout.dimensions.widthInches + 0.5));
    await page.locator("#kdp-cover-height").fill(String(layout.dimensions.heightInches));
    await page.locator("#kdp-preflight-form").evaluate((form) => form.requestSubmit());
    await page.waitForFunction(() => document.querySelector("#kdp-preflight-summary")?.textContent.startsWith("BLOCKED"));
    assert.match(await page.locator("#kdp-preflight-findings").innerText(), /COVER_DIMENSIONS/);
    await page.waitForFunction(() => document.querySelectorAll("#kdp-preflight-history [data-kdp-report]").length === 2);

    const apiHistory = await (await fetch(`${baseUrl}/api/projects/${projectId}/production/kdp-preflight`)).json();
    assert.equal(apiHistory.reports.length, 2);
    assert.equal(apiHistory.latest.status, "blocked");
    console.log("KDP PREFLIGHT BROWSER ACCEPTANCE PASSED: Studio surface renders, ready audit persists, reload restores history, and invalid cover geometry blocks production.");
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill("SIGTERM");
    await new Promise((resolve) => server.exitCode !== null ? resolve() : server.once("exit", resolve));
    await rm(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });

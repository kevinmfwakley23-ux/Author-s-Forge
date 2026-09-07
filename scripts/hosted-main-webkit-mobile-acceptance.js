#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const net = require("node:net");
const { webkit } = require("@playwright/test");

const HOST = "127.0.0.1";
const ACCESS_TOKEN = "forge-main-webkit-acceptance-token-123456789";
const PROJECT_ID = `forge-main-webkit-${Date.now()}`;
const IOS_SAFARI_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1";
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

async function waitForJson(url, timeoutMs = 20000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
      lastError = new Error(`HTTP ${response.status} from ${url}`);
    } catch (error) { lastError = error; }
    await sleep(100);
  }
  throw lastError || new Error(`Timed out waiting for ${url}`);
}

async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([new Promise((resolve) => child.once("exit", resolve)), sleep(5000)]);
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
}

async function noHorizontalOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, body: document.body.scrollWidth, doc: document.documentElement.scrollWidth }));
  assert.ok(dimensions.body <= dimensions.viewport + 1 && dimensions.doc <= dimensions.viewport + 1, `${label} overflows iPhone-sized WebKit viewport: ${JSON.stringify(dimensions)}`);
}

async function main() {
  const dataDir = await mkdtemp(join(tmpdir(), "authors-forge-main-webkit-"));
  const port = await reservePort();
  const base = `http://${HOST}:${port}`;
  const launcher = spawn(process.execPath, ["scripts/start-forge-web.js"], {
    env: {
      ...process.env,
      FORGE_DATA_DIR: dataDir,
      FORGE_WEB_HOST: HOST,
      FORGE_WEB_PORT: String(port),
      FORGE_ACCESS_TOKEN: ACCESS_TOKEN,
      FORGE_REQUIRE_HTTPS: "0",
      FORGE_SECURE_COOKIE: "0",
      FORGE_ENABLE_OPTIONAL_OFFICES: "0",
      OPENAI_API_KEY: "",
      OLLAMA_BASE_URL: "",
      OMNIROUTE_BASE_URL: "",
      ROUTER9_BASE_URL: "",
      KINGS_AI_RESPONSES_URL: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stderr = "";
  launcher.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  let browser;
  try {
    const health = await waitForJson(`${base}/healthz`).catch((error) => {
      throw new Error(`${error.message}\nHosted gateway stderr:\n${stderr}`);
    });
    assert.equal(health.mode, "main-studio");
    assert.deepEqual(health.services, ["studio"]);

    browser = await webkit.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      userAgent: IOS_SAFARI_UA,
      serviceWorkers: "block",
    });
    const page = await context.newPage();

    const denied = await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });
    assert.equal(denied?.status(), 401, "Hosted main Studio must require authentication on WebKit.");
    await page.locator("#token").fill(ACCESS_TOKEN);
    await Promise.all([page.waitForNavigation({ waitUntil: "networkidle" }), page.locator('button[type="submit"]').tap()]);

    const cookies = await context.cookies(base);
    const accessCookie = cookies.find((cookie) => cookie.name === "forge_access");
    assert.ok(accessCookie?.value);
    assert.equal(accessCookie.httpOnly, true);
    assert.equal(accessCookie.sameSite, "Strict");

    const created = await context.request.post(`${base}/api/projects`, {
      data: { id: PROJECT_ID, title: "Main Studio mobile acceptance" },
      headers: { accept: "application/json" },
    });
    assert.equal(created.ok(), true, `Project creation failed: ${created.status()} ${await created.text()}`);

    const studio = await page.goto(`${base}/?project=${encodeURIComponent(PROJECT_ID)}#dashboard`, { waitUntil: "networkidle" });
    assert.ok(studio?.ok());
    await page.waitForSelector("#forge-office-launcher");
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains("forge-hosted")), true);
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains("forge-console")), false);
    await noHorizontalOverflow(page, "Hosted main Studio");

    const loaded = await page.evaluate(async (id) => {
      const response = await fetch(`/api/projects/${encodeURIComponent(id)}`, { headers: { accept: "application/json" } });
      return { ok: response.ok, status: response.status, payload: response.ok ? await response.json() : null };
    }, PROJECT_ID);
    assert.equal(loaded.ok, true);
    assert.equal(loaded.payload?.metadata?.id, PROJECT_ID);

    const optional = await context.request.get(`${base}/specialized/?project=${encodeURIComponent(PROJECT_ID)}`);
    assert.equal(optional.status(), 404);
    const mainHealth = await context.request.get(`${base}/api/health`);
    assert.equal(mainHealth.ok(), true, "Optional-office isolation must not interrupt the main Studio on WebKit.");

    const controls = page.locator("button, a, input, select, textarea");
    const count = Math.min(await controls.count(), 40);
    let usableTargets = 0;
    for (let index = 0; index < count; index += 1) {
      const element = controls.nth(index);
      if (!(await element.isVisible()).catch(() => false)) continue;
      const box = await element.boundingBox();
      if (box && box.width >= 40 && box.height >= 40) usableTargets += 1;
    }
    assert.ok(usableTargets >= 3, "Main Studio must expose touch-usable controls on iPhone-sized WebKit.");

    await context.close();
    console.log("HOSTED MAIN WEBKIT ACCEPTANCE PASSED: authenticated iPhone-sized Studio, durable project API, touch usability, no horizontal overflow, and optional-office isolation.");
  } finally {
    if (browser) await browser.close().catch(() => {});
    await stop(launcher).catch(() => {});
    await rm(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});

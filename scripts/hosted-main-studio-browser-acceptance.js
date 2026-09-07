#!/usr/bin/env node
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const net = require("node:net");
const { chromium } = require("@playwright/test");

const HOST = "127.0.0.1";
const ACCESS_TOKEN = "forge-main-studio-acceptance-token-123456789";
const PROJECT_ID = `forge-main-hosted-${Date.now()}`;
const PLAYSTATION_WEBKIT_UA = "Mozilla/5.0 (PlayStation; PlayStation 5/12.00) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
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

async function main() {
  const dataDir = await mkdtemp(join(tmpdir(), "authors-forge-main-hosted-"));
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
    assert.equal(health.ok, true);
    assert.equal(health.mode, "main-studio");
    assert.deepEqual(health.services, ["studio"]);

    browser = await chromium.launch({
      executablePath: process.env.FORGE_BROWSER_EXECUTABLE || chromium.executablePath(),
      headless: true,
      args: ["--no-sandbox", "--disable-gpu"],
    });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, userAgent: PLAYSTATION_WEBKIT_UA, serviceWorkers: "block" });
    const page = await context.newPage();

    const denied = await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });
    assert.equal(denied?.status(), 401, "Hosted main Studio must require owner authentication.");
    await page.locator("#token").fill(ACCESS_TOKEN);
    await Promise.all([page.waitForURL(`${base}/`), page.locator('button[type="submit"]').click()]);

    const created = await page.evaluate(async (id) => {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, title: "Main Studio hosted acceptance" }),
      });
      return { ok: response.ok, status: response.status, body: await response.text() };
    }, PROJECT_ID);
    assert.equal(created.ok, true, `Hosted project creation failed (${created.status}): ${created.body}`);

    const studio = await page.goto(`${base}/?project=${encodeURIComponent(PROJECT_ID)}#dashboard`, { waitUntil: "networkidle" });
    assert.ok(studio?.ok());
    await page.waitForSelector("#forge-office-launcher");
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains("forge-hosted")), true);
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains("forge-console")), true);

    const loaded = await page.evaluate(async (id) => {
      const response = await fetch(`/api/projects/${encodeURIComponent(id)}`, { headers: { accept: "application/json" } });
      return { ok: response.ok, status: response.status, payload: response.ok ? await response.json() : null };
    }, PROJECT_ID);
    assert.equal(loaded.ok, true);
    assert.equal(loaded.payload?.metadata?.id, PROJECT_ID);

    const optional = await context.request.get(`${base}/journal/?project=${encodeURIComponent(PROJECT_ID)}`);
    assert.equal(optional.status(), 404, "An isolated optional office must not be silently launched by main Studio mode.");
    const afterOptional = await context.request.get(`${base}/api/projects/${encodeURIComponent(PROJECT_ID)}`);
    assert.equal(afterOptional.ok(), true, "Requesting an isolated optional office must not take the main Studio down.");

    const overflow = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, body: document.body.scrollWidth, doc: document.documentElement.scrollWidth }));
    assert.ok(overflow.body <= overflow.viewport + 1 && overflow.doc <= overflow.viewport + 1, `Hosted main Studio overflows viewport: ${JSON.stringify(overflow)}`);

    await context.close();
    console.log("HOSTED MAIN STUDIO ACCEPTANCE PASSED: authenticated single-service gateway, durable project API, restricted-console layout, and optional-office isolation without taking Studio down.");
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

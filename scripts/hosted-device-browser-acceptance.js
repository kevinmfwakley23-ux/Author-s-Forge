#!/usr/bin/env node
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const net = require("node:net");
const { chromium } = require("@playwright/test");

const HOST = "127.0.0.1";
const ACCESS_TOKEN = "forge-hosted-device-acceptance-token-123456789";
const PROJECT_ID = `forge-hosted-device-${Date.now()}`;
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

async function waitForHttp(url, timeoutMs = 20000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status} from ${url}`);
    } catch (error) {
      lastError = error;
    }
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

async function assertOffice(page, base, path, titlePattern, themeSelector) {
  const response = await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
  assert.ok(response?.ok(), `${path} must load through the hosted gateway.`);
  assert.equal(new URL(page.url()).origin, base, `${path} must remain on the public Forge origin.`);
  assert.equal(new URL(page.url()).searchParams.get("project"), PROJECT_ID, `${path} must retain the active project id.`);
  assert.match(await page.locator("body").innerText(), titlePattern);
  await page.waitForSelector(themeSelector);
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains("forge-hosted")), true, `${path} must run in hosted mode.`);
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains("forge-console")), true, `${path} must apply restricted-console navigation hardening for the PlayStation UA.`);
  const apiHealth = await page.evaluate(async () => {
    const response = await fetch("/api/health", { headers: { accept: "application/json" } });
    return { ok: response.ok, status: response.status, url: response.url };
  });
  assert.equal(apiHealth.ok, true, `${path} must remap its root-relative API calls to the correct hosted office.`);
  assert.equal(new URL(apiHealth.url).origin, base);
}

async function main() {
  const dataDir = await mkdtemp(join(tmpdir(), "authors-forge-hosted-device-"));
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
      OPENAI_API_KEY: "",
      OLLAMA_BASE_URL: "",
      OMNIROUTE_BASE_URL: "",
      ROUTER9_BASE_URL: "",
      KINGS_AI_ENDPOINT: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stderr = "";
  launcher.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  let browser;
  try {
    await waitForHttp(`${base}/healthz`).catch((error) => {
      throw new Error(`${error.message}\nHosted gateway stderr:\n${stderr}`);
    });

    browser = await chromium.launch({
      executablePath: process.env.FORGE_BROWSER_EXECUTABLE || chromium.executablePath(),
      headless: true,
      args: ["--no-sandbox", "--disable-gpu"],
    });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: PLAYSTATION_WEBKIT_UA,
      serviceWorkers: "block",
    });
    const page = await context.newPage();

    const denied = await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });
    assert.equal(denied?.status(), 401, "Hosted Forge must not expose owner surfaces before authentication.");
    await page.locator("#token").fill(ACCESS_TOKEN);
    await Promise.all([
      page.waitForURL(`${base}/`),
      page.locator('button[type="submit"]').click(),
    ]);

    const created = await page.evaluate(async ({ id }) => {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, title: "Hosted device integration acceptance" }),
      });
      return { ok: response.ok, status: response.status, body: await response.text() };
    }, { id: PROJECT_ID });
    assert.equal(created.ok, true, `Project creation through hosted Studio failed (${created.status}): ${created.body}`);

    await page.goto(`${base}/?project=${encodeURIComponent(PROJECT_ID)}#dashboard`, { waitUntil: "networkidle" });
    await page.waitForSelector("#forge-office-launcher");
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains("forge-hosted")), true);
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains("forge-console")), true);
    assert.equal(await page.locator("#forge-console-notice").innerText(), "Author's Forge console browser mode");

    const overflow = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      body: document.body.scrollWidth,
      doc: document.documentElement.scrollWidth,
    }));
    assert.ok(overflow.body <= overflow.viewport + 1 && overflow.doc <= overflow.viewport + 1, `Hosted console surface overflows viewport: ${JSON.stringify(overflow)}`);

    const officeLinks = [
      ["#open-guided-journal-office", `/journal/?project=${encodeURIComponent(PROJECT_ID)}`],
      ["#open-workbook-office", `/workbooks/?project=${encodeURIComponent(PROJECT_ID)}`],
      ["#open-specialized-office", `/specialized/?project=${encodeURIComponent(PROJECT_ID)}`],
      ["#open-nft-office", `/nft/?project=${encodeURIComponent(PROJECT_ID)}`],
    ];
    for (const [selector, expectedPath] of officeLinks) {
      const link = page.locator(selector);
      await link.waitFor();
      const href = new URL(await link.getAttribute("href"), base);
      assert.equal(href.origin, base, `${selector} must use the hosted single origin.`);
      assert.equal(`${href.pathname}${href.search}`, expectedPath, `${selector} must preserve the active project.`);
      assert.equal(await link.getAttribute("target"), null, `${selector} must not require a popup/new-tab window in restricted console mode.`);
    }

    await assertOffice(page, base, `/journal/?project=${encodeURIComponent(PROJECT_ID)}`, /Guided Journal/i, "#forge-office-theme");
    await assertOffice(page, base, `/workbooks/?project=${encodeURIComponent(PROJECT_ID)}`, /Educational Workbook/i, "#forge-office-theme");
    await assertOffice(page, base, `/specialized/?project=${encodeURIComponent(PROJECT_ID)}`, /Specialized Creation/i, "#sc-royal-theme");
    await assertOffice(page, base, `/nft/?project=${encodeURIComponent(PROJECT_ID)}`, /NFT Creation Office|Digital Collectibles Atelier/i, "#forge-office-theme");

    const studioResponse = await page.goto(`${base}/?project=${encodeURIComponent(PROJECT_ID)}#dashboard`, { waitUntil: "networkidle" });
    assert.ok(studioResponse?.ok());
    const loadedProject = await page.evaluate(async (id) => {
      const response = await fetch(`/api/projects/${encodeURIComponent(id)}`, { headers: { accept: "application/json" } });
      return { ok: response.ok, status: response.status, payload: response.ok ? await response.json() : null };
    }, PROJECT_ID);
    assert.equal(loadedProject.ok, true, `Hosted Studio must reload the project after cross-office navigation (HTTP ${loadedProject.status}).`);
    assert.equal(loadedProject.payload?.metadata?.id, PROJECT_ID);

    await context.close();
    console.log("HOSTED DEVICE BROWSER ACCEPTANCE PASSED: authenticated single-origin Studio + Journal + Workbooks + Specialized + NFT, one durable project, office API remapping, restricted-console no-popup navigation, and no service-worker dependency.");
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

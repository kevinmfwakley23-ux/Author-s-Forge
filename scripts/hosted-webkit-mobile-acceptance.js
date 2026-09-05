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
const ACCESS_TOKEN = "forge-hosted-webkit-acceptance-token-123456789";
const PROJECT_ID = `forge-hosted-webkit-${Date.now()}`;
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

async function assertNoHorizontalOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    body: document.body.scrollWidth,
    doc: document.documentElement.scrollWidth,
  }));
  assert.ok(dimensions.body <= dimensions.viewport + 1 && dimensions.doc <= dimensions.viewport + 1, `${label} overflows iPhone-sized WebKit viewport: ${JSON.stringify(dimensions)}`);
}

async function assertHostedOffice(page, base, path, titlePattern) {
  const response = await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
  assert.ok(response?.ok(), `${path} must load through the hosted gateway in WebKit.`);
  const current = new URL(page.url());
  assert.equal(current.origin, base, `${path} must remain on the public Forge origin.`);
  assert.equal(current.searchParams.get("project"), PROJECT_ID, `${path} must retain the active project id.`);
  assert.match(await page.locator("body").innerText(), titlePattern);
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains("forge-hosted")), true, `${path} must run in hosted mode.`);
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains("forge-console")), false, `${path} must not misclassify Mobile Safari as PlayStation console mode.`);
  const health = await page.evaluate(async () => {
    const response = await fetch("/api/health", { headers: { accept: "application/json" } });
    return { ok: response.ok, status: response.status, url: response.url };
  });
  assert.equal(health.ok, true, `${path} must remap its root-relative API calls through the hosted office prefix (HTTP ${health.status}).`);
  assert.equal(new URL(health.url).origin, base);
  await assertNoHorizontalOverflow(page, path);
}

async function main() {
  const dataDir = await mkdtemp(join(tmpdir(), "authors-forge-hosted-webkit-"));
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
    assert.equal(denied?.status(), 401, "Hosted Forge must require authentication in WebKit too.");
    await page.locator("#token").fill(ACCESS_TOKEN);
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle" }),
      page.locator('button[type="submit"]').tap(),
    ]);
    assert.equal(page.url(), `${base}/`, "Hosted WebKit login must return to the authenticated Forge root.");

    const cookies = await context.cookies(base);
    const accessCookie = cookies.find((cookie) => cookie.name === "forge_access");
    assert.ok(accessCookie?.value, "Hosted WebKit login must establish the forge_access browser-session cookie.");
    assert.equal(accessCookie.httpOnly, true, "Hosted WebKit access cookie must remain HttpOnly.");
    assert.equal(accessCookie.sameSite, "Strict", "Hosted WebKit access cookie must remain SameSite=Strict.");

    // BrowserContext.request shares the authenticated browser context's cookies. Use it for
    // deterministic project setup immediately after the 303 login redirect, then prove normal
    // in-page fetch behavior on every hosted office below after WebKit has settled the document.
    const createdResponse = await context.request.post(`${base}/api/projects`, {
      data: { id: PROJECT_ID, title: "Hosted WebKit mobile acceptance" },
      headers: { accept: "application/json" },
    });
    const createdBody = await createdResponse.text();
    assert.equal(createdResponse.ok(), true, `Project creation through authenticated hosted WebKit context failed (${createdResponse.status()}): ${createdBody}`);

    await page.goto(`${base}/?project=${encodeURIComponent(PROJECT_ID)}#dashboard`, { waitUntil: "networkidle" });
    await page.waitForSelector("#forge-office-launcher");
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains("forge-hosted")), true);
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains("forge-console")), false);
    await assertNoHorizontalOverflow(page, "Hosted Studio");

    const studioHealth = await page.evaluate(async () => {
      const response = await fetch("/api/health", { headers: { accept: "application/json" } });
      return { ok: response.ok, status: response.status, url: response.url };
    });
    assert.equal(studioHealth.ok, true, `Hosted Studio in-page WebKit fetch must work after login (HTTP ${studioHealth.status}).`);
    assert.equal(new URL(studioHealth.url).origin, base);

    const projectTitle = page.locator("#project-title");
    await projectTitle.waitFor();
    assert.match(await projectTitle.innerText(), /Hosted WebKit mobile acceptance/i);

    const officeLinks = [
      ["#open-guided-journal-office", "/journal/"],
      ["#open-workbook-office", "/workbooks/"],
      ["#open-specialized-office", "/specialized/"],
      ["#open-nft-office", "/nft/"],
    ];
    for (const [selector, pathname] of officeLinks) {
      const link = page.locator(selector);
      await link.waitFor();
      const href = new URL(await link.getAttribute("href"), base);
      assert.equal(href.origin, base, `${selector} must use the hosted single origin in WebKit.`);
      assert.equal(href.pathname, pathname);
      assert.equal(href.searchParams.get("project"), PROJECT_ID);
      const box = await link.boundingBox();
      assert.ok(box && box.width >= 44 && box.height >= 44, `${selector} must remain touch-usable in the iPhone-sized WebKit layout.`);
    }

    await assertHostedOffice(page, base, `/journal/?project=${encodeURIComponent(PROJECT_ID)}`, /Guided Journal/i);
    await assertHostedOffice(page, base, `/workbooks/?project=${encodeURIComponent(PROJECT_ID)}`, /Educational Workbook/i);
    await assertHostedOffice(page, base, `/specialized/?project=${encodeURIComponent(PROJECT_ID)}`, /Specialized Creation/i);
    await assertHostedOffice(page, base, `/nft/?project=${encodeURIComponent(PROJECT_ID)}`, /NFT Creation Office|Digital Collectibles Atelier/i);

    const studio = await page.goto(`${base}/?project=${encodeURIComponent(PROJECT_ID)}#dashboard`, { waitUntil: "networkidle" });
    assert.ok(studio?.ok());
    const loadedProject = await page.evaluate(async (id) => {
      const response = await fetch(`/api/projects/${encodeURIComponent(id)}`, { headers: { accept: "application/json" } });
      return { ok: response.ok, status: response.status, payload: response.ok ? await response.json() : null };
    }, PROJECT_ID);
    assert.equal(loadedProject.ok, true, `Hosted WebKit Studio must reload the project after cross-office navigation (HTTP ${loadedProject.status}).`);
    assert.equal(loadedProject.payload?.metadata?.id, PROJECT_ID);
    await assertNoHorizontalOverflow(page, "Reloaded hosted Studio");

    await context.close();
    console.log("HOSTED WEBKIT MOBILE ACCEPTANCE PASSED: authenticated iPhone-sized WebKit + durable project + Studio/Journal/Workbooks/Specialized/NFT single-origin routing + touch targets + in-page API remapping + no horizontal overflow.");
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

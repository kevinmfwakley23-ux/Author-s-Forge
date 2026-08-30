#!/usr/bin/env node

/**
 * Mobile/browser acceptance for Author's Forge.
 *
 * This verifies the real Studio at a phone-sized viewport rather than relying
 * on CSS/source assertions. It focuses on touch-sized interaction, navigation,
 * absence of horizontal overflow, and durable state after reload.
 */
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { chromium } = require("@playwright/test");

const HOST = "127.0.0.1";
const APP_PORT = 5000 + Math.floor(Math.random() * 200);
const projectId = `mobile-acceptance-${Date.now()}`;

async function waitForHttp(url, timeoutMs = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function main() {
  const dataDir = await mkdtemp(join(tmpdir(), "authors-forge-mobile-"));
  const server = spawn(process.execPath, ["dist/studio-server.js"], {
    env: {
      ...process.env,
      PORT: String(APP_PORT),
      HOST,
      FORGE_DATA_DIR: dataDir,
      OPENAI_API_KEY: "",
      OPENAI_MODEL: "",
      OLLAMA_BASE_URL: "",
      OLLAMA_MODEL: "",
      KINGS_AI_ENDPOINT: "",
      KINGS_AI_MODEL: "",
      OMNIROUTE_BASE_URL: "",
      OMNIROUTE_MODEL: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let browser;
  try {
    const baseUrl = `http://${HOST}:${APP_PORT}`;
    await waitForHttp(`${baseUrl}/api/health`);

    const created = await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: projectId, title: "Mobile Acceptance", kind: "novel" }),
    });
    assert.equal(created.ok, true, await created.text());

    browser = await chromium.launch({
      executablePath: process.env.FORGE_BROWSER_EXECUTABLE || chromium.executablePath(),
      headless: true,
      args: ["--no-sandbox", "--disable-gpu"],
    });

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent: "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/150 Mobile Safari/537.36",
    });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/?project=${encodeURIComponent(projectId)}`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.readyState === "complete" && document.querySelector("#project-title")?.textContent !== "Loading…");

    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
    }));
    assert.ok(dimensions.bodyScrollWidth <= dimensions.viewport + 1, `horizontal overflow: ${JSON.stringify(dimensions)}`);
    assert.ok(dimensions.documentScrollWidth <= dimensions.viewport + 1, `document overflow: ${JSON.stringify(dimensions)}`);

    const routes = await page.locator("nav a[data-route]").evaluateAll((elements) => elements.map((el) => el.dataset.route));
    assert.ok(routes.length >= 18, `expected the complete Studio navigation, got ${routes.length}`);

    const nav = page.locator('nav a[data-route="manuscript"]');
    const navBox = await nav.boundingBox();
    assert.ok(navBox && navBox.height >= 40, `navigation target is too small for touch: ${JSON.stringify(navBox)}`);
    await nav.tap();
    await page.waitForFunction(() => location.hash === "#manuscript" && document.querySelector("#manuscript")?.hidden === false);

    await page.locator("#book-form [name=title]").fill("Mobile Book");
    await page.locator("#book-form [name=description]").fill("Created through a phone-sized Studio viewport.");
    await page.locator("#book-form").evaluate((form) => form.requestSubmit());
    await page.waitForFunction(() => document.querySelector("#book-tree")?.textContent.includes("Mobile Book"));

    await page.locator("#chapter-form [name=number]").fill("1");
    await page.locator("#chapter-form [name=title]").fill("Mobile Opening");
    await page.locator("#chapter-form [name=synopsis]").fill("Phone acceptance chapter.");
    await page.locator("#chapter-form").evaluate((form) => form.requestSubmit());
    await page.waitForFunction(() => document.querySelector("#scene-chapter option"));

    await page.locator("#scene-form [name=number]").fill("1");
    await page.locator("#scene-form [name=title]").fill("Mobile Scene");
    await page.locator("#scene-form [name=synopsis]").fill("Phone acceptance scene.");
    await page.locator("#scene-form").evaluate((form) => form.requestSubmit());
    await page.waitForFunction(() => document.querySelector("#editor-scene option"));

    await page.locator('nav a[data-route="writing"]').tap();
    await page.locator("#editor-content").fill("Mobile-authoring acceptance content.");
    await page.locator("#save-scene").tap();
    await page.waitForFunction(() => document.querySelector("#success-banner")?.textContent.includes("Scene saved."));

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelector("#project-title")?.textContent !== "Loading…");
    await page.locator('nav a[data-route="writing"]').tap();
    await page.waitForFunction(() => document.querySelector("#editor-content")?.value === "Mobile-authoring acceptance content.");

    const finalDimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
    }));
    assert.ok(finalDimensions.bodyScrollWidth <= finalDimensions.viewport + 1, `post-write horizontal overflow: ${JSON.stringify(finalDimensions)}`);
    assert.ok(finalDimensions.documentScrollWidth <= finalDimensions.viewport + 1, `post-write document overflow: ${JSON.stringify(finalDimensions)}`);

    console.log(`MOBILE BROWSER ACCEPTANCE PASSED: ${routes.length} routes + touch navigation + phone viewport + durable manuscript reload + overflow guard.`);
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill("SIGTERM");
    await new Promise((resolve) => server.exitCode !== null ? resolve() : server.once("exit", resolve));
    await rm(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});

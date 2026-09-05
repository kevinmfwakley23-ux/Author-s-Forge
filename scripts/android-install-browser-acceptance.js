#!/usr/bin/env node

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { chromium } = require("@playwright/test");

const HOST = "127.0.0.1";
const PORT = 5600 + Math.floor(Math.random() * 200);
const PROJECT_ID = `android-launcher-${Date.now()}`;

async function waitForHttp(url, timeoutMs = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function main() {
  const dataDir = await mkdtemp(join(tmpdir(), "authors-forge-android-launcher-"));
  const server = spawn(process.execPath, ["dist/studio-server.js"], {
    env: { ...process.env, PORT: String(PORT), HOST, FORGE_DATA_DIR: dataDir },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let browser;
  try {
    const baseUrl = `http://${HOST}:${PORT}`;
    await waitForHttp(`${baseUrl}/api/health`);
    const created = await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: PROJECT_ID, title: "Android Launcher Acceptance", kind: "novel" }),
    });
    assert.equal(created.ok, true, await created.text());

    browser = await chromium.launch({
      executablePath: process.env.FORGE_BROWSER_EXECUTABLE || chromium.executablePath(),
      headless: true,
      args: ["--no-sandbox", "--disable-gpu"],
    });
    const context = await browser.newContext({
      viewport: { width: 412, height: 915 },
      deviceScaleFactor: 2.625,
      isMobile: true,
      hasTouch: true,
      userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 Chrome/150 Mobile Safari/537.36",
    });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/?project=${encodeURIComponent(PROJECT_ID)}`, { waitUntil: "networkidle" });

    const launcher = page.locator("#forge-android-install-fab");
    await launcher.waitFor({ state: "visible" });
    const box = await launcher.boundingBox();
    assert.ok(box && box.width >= 64 && box.height >= 64, `Android launcher must be a real touch target: ${JSON.stringify(box)}`);

    const launcherContract = await launcher.evaluate((element) => {
      const style = getComputedStyle(element);
      const image = element.querySelector("img");
      return {
        ariaLabel: element.getAttribute("aria-label") || "",
        borderRadius: Number.parseFloat(style.borderRadius),
        imagePath: image ? new URL(image.src).pathname : "",
        visibleFlag: element.dataset.visible,
      };
    });
    assert.match(launcherContract.ariaLabel, /Install Author's Forge/i);
    assert.ok(launcherContract.borderRadius >= 32, `launcher must render as a circle: ${JSON.stringify(launcherContract)}`);
    assert.equal(launcherContract.imagePath, "/icon-192.svg");
    assert.equal(launcherContract.visibleFlag, "true");

    const manifest = await (await fetch(`${baseUrl}/manifest.webmanifest`)).json();
    assert.equal(manifest.id, "/");
    assert.equal(manifest.display, "standalone");
    assert.equal(manifest.prefer_related_applications, false);
    assert.ok(Array.isArray(manifest.shortcuts) && manifest.shortcuts.length >= 4, "installed Forge must expose Android launcher shortcuts");

    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scrollWidth: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth),
    }));
    assert.ok(dimensions.scrollWidth <= dimensions.viewport + 1, `launcher must not create horizontal overflow: ${JSON.stringify(dimensions)}`);

    console.log("Android install launcher acceptance: PASS");
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill("SIGTERM");
    await rm(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error("Android install launcher acceptance: FAILED");
  console.error(error);
  process.exitCode = 1;
});

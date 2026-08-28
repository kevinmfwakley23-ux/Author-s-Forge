#!/usr/bin/env node

/**
 * Author's Forge real-browser acceptance harness.
 *
 * This deliberately runs outside the normal Node test suite. It launches a
 * real Chrome/Chromium executable through Playwright and drives the actual
 * Studio DOM. If no browser is available, it fails loudly.
 */

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const { homedir, tmpdir } = require("node:os");
const { join } = require("node:path");
const { existsSync } = require("node:fs");
const { chromium } = require("@playwright/test");

const HOST = "127.0.0.1";
const APP_PORT = 4800 + Math.floor(Math.random() * 200);
const bootstrapProjectId = "forge-studio";
const projectId = `browser-acceptance-${Date.now()}`;

function findBrowser() {
  if (process.env.FORGE_BROWSER_EXECUTABLE) {
    if (!existsSync(process.env.FORGE_BROWSER_EXECUTABLE)) {
      throw new Error(`FORGE_BROWSER_EXECUTABLE does not exist: ${process.env.FORGE_BROWSER_EXECUTABLE}`);
    }
    return process.env.FORGE_BROWSER_EXECUTABLE;
  }

  const systemBrowser = [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/chrome",
  ].find(existsSync);

  if (systemBrowser) return systemBrowser;

  const playwrightRoot = process.env.PLAYWRIGHT_BROWSERS_PATH === "0"
    ? join(process.cwd(), "node_modules", "playwright-core")
    : process.env.PLAYWRIGHT_BROWSERS_PATH || join(homedir(), ".cache", "ms-playwright");

  if (!existsSync(playwrightRoot)) return null;

  const candidates = [];
  function walk(directory, depth) {
    if (depth > 5) return;
    let entries;
    try {
      entries = require("node:fs").readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = join(directory, entry.name);
      if (entry.isFile() && entry.name === "chrome") candidates.push(fullPath);
      else if (entry.isDirectory()) walk(fullPath, depth + 1);
    }
  }
  walk(playwrightRoot, 0);
  return candidates.find((candidate) => /chromium|chrome/i.test(candidate)) ?? candidates[0] ?? null;
}

async function waitForHttp(url, timeoutMs = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function ensureBootstrapProject(baseUrl) {
  const existing = await fetch(`${baseUrl}/api/projects/${encodeURIComponent(bootstrapProjectId)}`);
  if (existing.ok) return;
  if (existing.status !== 404) {
    throw new Error(`Unable to inspect bootstrap project: HTTP ${existing.status}`);
  }

  const created = await fetch(`${baseUrl}/api/projects`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: bootstrapProjectId, title: "Forge Browser Bootstrap" }),
  });
  if (!created.ok) {
    const detail = await created.text();
    throw new Error(`Unable to create bootstrap project: HTTP ${created.status}: ${detail}`);
  }
}

async function main() {
  const executablePath = findBrowser();
  if (!executablePath) {
    throw new Error(
      "REAL BROWSER ACCEPTANCE BLOCKED: no Chrome/Chromium executable was found. " +
      "Install/use a supported browser or set FORGE_BROWSER_EXECUTABLE=/path/to/chrome. " +
      "This command intentionally fails instead of claiming browser verification passed."
    );
  }

  console.log(`Browser acceptance executable: ${executablePath}`);
  const dataDir = await mkdtemp(join(tmpdir(), "authors-forge-browser-"));
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
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let browser;
  try {
    const serverUrl = `http://${HOST}:${APP_PORT}`;
    await waitForHttp(`${serverUrl}/api/health`);
    await ensureBootstrapProject(serverUrl);

    browser = await chromium.launch({
      executablePath,
      headless: true,
      args: ["--no-sandbox", "--disable-gpu"],
    });
    const context = await browser.newContext();
    const page = await context.newPage();
    const baseUrl = `${serverUrl}/?project=${encodeURIComponent(bootstrapProjectId)}`;

    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.waitForFunction(() => {
      const title = document.querySelector("#project-title");
      return document.readyState === "complete" && title && title.textContent !== "Loading…";
    });

    const routes = await page.locator("nav a[data-route]").evaluateAll((elements) => elements.map((el) => el.dataset.route));
    assert.deepEqual(routes, ["dashboard", "manuscript", "writing", "architecture", "characters", "world", "research", "editing", "voice", "art", "cover", "marketing", "publishing", "genome", "health", "versions", "settings", "governance"]);

    for (const route of routes) {
      await page.locator(`nav a[data-route="${route}"]`).click();
      await page.waitForFunction((expectedRoute) => location.hash === `#${expectedRoute}` && document.querySelector(`#${expectedRoute}`)?.hidden === false, route);
    }

    await page.locator('nav a[data-route="dashboard"]').click();
    await page.waitForFunction(() => location.hash === "#dashboard");
    await page.locator("#project-form [name=id]").fill(projectId);
    await page.locator("#project-form [name=title]").fill("Browser Acceptance Book");
    await page.locator("#project-form [name=kind]").selectOption("novel");
    await page.locator("#project-form").evaluate((form) => form.requestSubmit());
    await page.waitForFunction((id) => location.search.includes(`project=${id}`) && document.querySelector("#project-title")?.textContent === "Browser Acceptance Book", projectId);

    await page.locator('nav a[data-route="manuscript"]').click();
    await page.waitForFunction(() => location.hash === "#manuscript");
    await page.locator("#book-form [name=title]").fill("Acceptance Book");
    await page.locator("#book-form [name=kind]").selectOption("novel");
    await page.locator("#book-form [name=description]").fill("Real browser acceptance");
    await page.locator("#book-form").evaluate((form) => form.requestSubmit());
    await page.waitForFunction(() => document.querySelector("#book-tree")?.textContent.includes("Acceptance Book"));

    await page.locator("#chapter-form [name=number]").fill("1");
    await page.locator("#chapter-form [name=title]").fill("Opening");
    await page.locator("#chapter-form [name=synopsis]").fill("Acceptance opening");
    await page.locator("#chapter-form").evaluate((form) => form.requestSubmit());
    await page.waitForFunction(() => document.querySelector("#scene-chapter option"));

    await page.locator("#scene-form [name=number]").fill("1");
    await page.locator("#scene-form [name=title]").fill("First Scene");
    await page.locator("#scene-form [name=synopsis]").fill("Acceptance scene");
    await page.locator("#scene-form").evaluate((form) => form.requestSubmit());
    await page.waitForFunction(() => document.querySelector("#editor-scene option"));

    await page.locator('nav a[data-route="characters"]').click();
    await page.waitForFunction(() => location.hash === "#characters");
    const characterForm = page.locator("#character-form");
    await characterForm.locator('[name="name"]').fill("Acceptance Character");
    await characterForm.locator('[name="age"]').fill("34");
    await characterForm.locator('[name="birthDate"]').fill("1992-01-15");
    await characterForm.locator('[name="physicalAppearance"]').fill("A weathered face with a steady gaze.");
    await characterForm.locator('[name="height"]').fill("5'11");
    await characterForm.locator('[name="build"]').fill("Athletic");
    await characterForm.locator('[name="hair"]').fill("Dark brown");
    await characterForm.locator('[name="eyes"]').fill("Hazel");
    await characterForm.locator('[name="skin"]').fill("Olive");
    await characterForm.locator('[name="clothing"]').fill("Dark jacket and boots");
    await characterForm.locator('[name="voice"]').fill("Low and measured");
    await characterForm.locator('[name="personality"]').fill("Observant, loyal, guarded");
    await characterForm.locator('[name="history"]').fill("A former investigator rebuilding a life after a difficult case.");
    await characterForm.locator('[name="characterArc"]').fill("Learns to trust others without surrendering judgment.");
    await characterForm.locator('[name="currentEmotionalState"]').fill("Determined");
    await characterForm.locator('[name="currentLocation"]').fill("Ogden");
    await characterForm.evaluate((form) => form.requestSubmit());
    await page.waitForFunction(() => document.querySelector("#character-list")?.textContent.includes("Acceptance Character"));

    await page.locator('nav a[data-route="world"]').click();
    await page.waitForFunction(() => location.hash === "#world");
    const memoryForm = page.locator("#memory-form");
    await memoryForm.locator('[name="class"]').selectOption("story-canon");
    await memoryForm.locator('[name="authority"]').selectOption("authoritative");
    await memoryForm.locator('[name="summary"]').fill("The acceptance character is canonically based in Ogden.");
    await memoryForm.locator('[name="content"]').fill("This durable canon fact is established by the author for browser acceptance.");
    await memoryForm.locator('[name="reference"]').fill("browser-acceptance");
    await memoryForm.evaluate((form) => form.requestSubmit());
    await page.waitForFunction(() => document.querySelector("#memory-list")?.textContent.includes("The acceptance character is canonically based in Ogden."));

    await page.locator('nav a[data-route="writing"]').click();
    await page.waitForFunction(() => location.hash === "#writing");
    await page.locator("#editor-content").fill("A real browser-driven manuscript scene.");
    await page.locator("#save-scene").click();
    await page.waitForFunction(() => document.querySelector("#success-banner")?.textContent.includes("Scene saved."));

    await page.locator("#ai-draft").click();
    await page.waitForFunction(() => {
      const text = document.querySelector("#error-banner")?.textContent ?? "";
      return text.includes("provider") || text.includes("configured");
    });

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(() => document.readyState === "complete" && document.querySelector("#project-title")?.textContent === "Browser Acceptance Book");
    await page.locator('nav a[data-route="writing"]').click();
    await page.waitForFunction(() => document.querySelector("#editor-content")?.value === "A real browser-driven manuscript scene.");
    await page.locator('nav a[data-route="characters"]').click();
    await page.waitForFunction(() => document.querySelector("#character-list")?.textContent.includes("Acceptance Character"));
    await page.locator('nav a[data-route="world"]').click();
    await page.waitForFunction(() => document.querySelector("#memory-list")?.textContent.includes("The acceptance character is canonically based in Ogden."));
    await page.locator('nav a[data-route="health"]').click();
    await page.waitForFunction(() => document.querySelector("#health-result")?.textContent.includes("1"));

    console.log(`REAL BROWSER ACCEPTANCE PASSED: ${routes.length} routes + project + book + chapter + scene + character bible + canon memory + save/reload + honest AI failure + health.`);
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill("SIGTERM");
    await new Promise((resolve) => {
      if (server.exitCode !== null) resolve();
      else server.once("exit", resolve);
    });
    await rm(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});

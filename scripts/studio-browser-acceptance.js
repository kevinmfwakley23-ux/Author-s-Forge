#!/usr/bin/env node

/**
 * Real-browser acceptance harness for Author's Forge.
 *
 * This intentionally runs outside the normal Node test suite. It launches a
 * real Chrome/Chromium executable and drives the actual Studio DOM. If no
 * browser is available, it fails loudly instead of claiming verification.
 */
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const { homedir, tmpdir } = require("node:os");
const { join } = require("node:path");
const { existsSync, readdirSync } = require("node:fs");
const { chromium } = require("@playwright/test");

const HOST = "127.0.0.1";
const APP_PORT = 4800 + Math.floor(Math.random() * 200);
const projectId = `browser-acceptance-${Date.now()}`;

function findBrowser() {
  if (process.env.FORGE_BROWSER_EXECUTABLE) {
    if (!existsSync(process.env.FORGE_BROWSER_EXECUTABLE)) throw new Error(`FORGE_BROWSER_EXECUTABLE does not exist: ${process.env.FORGE_BROWSER_EXECUTABLE}`);
    return process.env.FORGE_BROWSER_EXECUTABLE;
  }
  const systemBrowser = ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/chrome"].find(existsSync);
  if (systemBrowser) return systemBrowser;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH === "0"
    ? join(process.cwd(), "node_modules", "playwright-core")
    : process.env.PLAYWRIGHT_BROWSERS_PATH || join(homedir(), ".cache", "ms-playwright");
  if (!existsSync(root)) return null;
  const candidates = [];
  function walk(directory, depth = 0) {
    if (depth > 5) return;
    let entries;
    try { entries = readdirSync(directory, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const fullPath = join(directory, entry.name);
      if (entry.isFile() && entry.name === "chrome") candidates.push(fullPath);
      else if (entry.isDirectory()) walk(fullPath, depth + 1);
    }
  }
  walk(root);
  return candidates.find((candidate) => /chromium|chrome/i.test(candidate)) ?? candidates[0] ?? null;
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
  if (!executablePath) throw new Error("REAL BROWSER ACCEPTANCE BLOCKED: no Chrome/Chromium executable found. Install Chromium/Chrome or set FORGE_BROWSER_EXECUTABLE.");

  const dataDir = await mkdtemp(join(tmpdir(), "authors-forge-browser-"));
  const server = spawn(process.execPath, ["dist/studio-server.js"], {
    env: { ...process.env, PORT: String(APP_PORT), HOST, FORGE_DATA_DIR: dataDir, OPENAI_API_KEY: "", OPENAI_MODEL: "", OLLAMA_BASE_URL: "", OLLAMA_MODEL: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let browser;
  try {
    const baseUrl = `http://${HOST}:${APP_PORT}`;
    await waitForHttp(`${baseUrl}/api/health`);
    const created = await fetch(`${baseUrl}/api/projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: projectId, title: "Browser Acceptance Book", kind: "novel" }) });
    assert.equal(created.ok, true, await created.text());

    browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-gpu"] });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${baseUrl}/?project=${encodeURIComponent(projectId)}`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.readyState === "complete" && document.querySelector("#project-title")?.textContent !== "Loading…");

    const routes = await page.locator("nav a[data-route]").evaluateAll((elements) => elements.map((el) => el.dataset.route));
    assert.equal(routes.length, 18);
    for (const route of routes) {
      await page.locator(`nav a[data-route="${route}"]`).click();
      await page.waitForFunction((expected) => location.hash === `#${expected}` && document.querySelector(`#${expected}`)?.hidden === false, route);
    }

    await page.locator('nav a[data-route="manuscript"]').click();
    await page.locator("#book-form [name=title]").fill("Acceptance Book");
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

    const workspaceResponse = await fetch(`${baseUrl}/api/projects/${projectId}/workspace`);
    assert.equal(workspaceResponse.ok, true);
    const workspace = await workspaceResponse.json();
    const bookId = workspace.books?.[0]?.id;
    assert.equal(typeof bookId, "string");

    const workflowBlocked = await fetch(`${baseUrl}/api/projects/${projectId}/workflow/advance`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bookId, checks: { concept: [{ id: "concept.ready", label: "Concept approved", passed: true }] } }),
    });
    assert.equal(workflowBlocked.status, 409);
    const blockedPayload = await workflowBlocked.json();
    assert.deepEqual(blockedPayload.workflow.blockers, ["AUTHOR_APPROVAL_REQUIRED"]);

    const workflowAdvanced = await fetch(`${baseUrl}/api/projects/${projectId}/workflow/advance`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bookId, checks: { concept: [{ id: "concept.ready", label: "Concept approved", passed: true }] }, authorApproved: true, now: "2026-08-30T03:00:00.000Z" }),
    });
    assert.equal(workflowAdvanced.ok, true, await workflowAdvanced.text());
    const advancedPayload = await workflowAdvanced.json();
    assert.equal(advancedPayload.workflow.toStage, "architecture");
    assert.equal(advancedPayload.project.workflowStage, "architecture");

    const persistedWorkflow = await (await fetch(`${baseUrl}/api/projects/${projectId}/workflow`)).json();
    assert.equal(persistedWorkflow.currentStage, "architecture");

    await page.locator('nav a[data-route="writing"]').click();
    await page.locator("#editor-content").fill("A real browser-driven manuscript scene.");
    await page.locator("#save-scene").click();
    await page.waitForFunction(() => document.querySelector("#success-banner")?.textContent.includes("Scene saved."));

    await page.locator('nav a[data-route="characters"]').click();
    const characterForm = page.locator("#character-form");
    for (const [name, value] of Object.entries({ name: "Acceptance Character", age: "34", birthDate: "1992-01-15", physicalAppearance: "Weathered face with steady gaze", height: "5'11", build: "Athletic", hair: "Dark brown", eyes: "Hazel", skin: "Olive", clothing: "Dark jacket", voice: "Low and measured", personality: "Observant and loyal", history: "Former investigator rebuilding a life.", characterArc: "Learns to trust others.", currentEmotionalState: "Determined", currentLocation: "Ogden" })) await characterForm.locator(`[name="${name}"]`).fill(value);
    await characterForm.evaluate((form) => form.requestSubmit());
    await page.waitForFunction(() => document.querySelector("#character-list")?.textContent.includes("Acceptance Character"));

    await page.locator('nav a[data-route="world"]').click();
    const memoryForm = page.locator("#memory-form");
    await memoryForm.locator('[name="class"]').selectOption("story-canon");
    await memoryForm.locator('[name="authority"]').selectOption("authoritative");
    await memoryForm.locator('[name="summary"]').fill("Acceptance character is canonically based in Ogden.");
    await memoryForm.locator('[name="content"]').fill("Durable author-established canon for browser acceptance.");
    await memoryForm.locator('[name="reference"]').fill("browser-acceptance");
    await memoryForm.evaluate((form) => form.requestSubmit());
    await page.waitForFunction(() => document.querySelector("#memory-list")?.textContent.includes("Acceptance character is canonically based in Ogden."));

    await page.locator('nav a[data-route="writing"]').click();
    await page.locator("#ai-draft").click();
    await page.waitForFunction(() => (document.querySelector("#error-banner")?.textContent || "").length > 0);
    await page.reload({ waitUntil: "networkidle" });
    await page.locator('nav a[data-route="writing"]').click();
    await page.waitForFunction(() => document.querySelector("#editor-content")?.value === "A real browser-driven manuscript scene.");
    await page.locator('nav a[data-route="characters"]').click();
    await page.waitForFunction(() => document.querySelector("#character-list")?.textContent.includes("Acceptance Character"));
    await page.locator('nav a[data-route="world"]').click();
    await page.waitForFunction(() => document.querySelector("#memory-list")?.textContent.includes("Acceptance character is canonically based in Ogden."));

    console.log(`REAL BROWSER ACCEPTANCE PASSED: ${routes.length} routes + durable book/chapter/scene + governed workflow advancement + manuscript save/reload + character + canon + honest AI failure.`);
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill("SIGTERM");
    await new Promise((resolve) => server.exitCode !== null ? resolve() : server.once("exit", resolve));
    await rm(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });

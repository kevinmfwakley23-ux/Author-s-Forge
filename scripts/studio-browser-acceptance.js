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
const REQUIRED_ROUTES = [
  "dashboard", "manuscript", "writing", "architecture", "characters", "world", "research", "editing", "voice", "art", "cover", "marketing", "publishing", "genome", "health", "versions", "settings", "governance",
];
const CRAFT_FIXTURE = "The door was opened by Marcus while he walked slowly into the room and looked around at the walls that had been painted years before, wondering whether the old photographs still remained where Lena had left them because nobody had touched them since the house was abandoned. Marcus looked at the clock. Lena waited.";

function findBrowser() {
  if (process.env.FORGE_BROWSER_EXECUTABLE) {
    if (!existsSync(process.env.FORGE_BROWSER_EXECUTABLE)) throw new Error(`FORGE_BROWSER_EXECUTABLE does not exist: ${process.env.FORGE_BROWSER_EXECUTABLE}`);
    return process.env.FORGE_BROWSER_EXECUTABLE;
  }
  const systemBrowser = ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/chrome"].find(existsSync);
  if (systemBrowser) return systemBrowser;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH === "0" ? join(process.cwd(), "node_modules", "playwright-core") : process.env.PLAYWRIGHT_BROWSERS_PATH || join(homedir(), ".cache", "ms-playwright");
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
    assert.equal(new Set(routes).size, routes.length, "Studio navigation contains duplicate route identifiers.");
    for (const route of REQUIRED_ROUTES) assert.equal(routes.includes(route), true, `Studio is missing required route: ${route}`);
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
    const sceneId = workspace.books?.[0]?.chapters?.[0]?.scenes?.[0]?.id;
    assert.equal(typeof bookId, "string");
    assert.equal(typeof sceneId, "string");

    const workflowBlocked = await fetch(`${baseUrl}/api/projects/${projectId}/workflow/advance`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bookId, checks: { concept: [{ id: "concept.ready", label: "Concept approved", passed: true }] } }) });
    assert.equal(workflowBlocked.status, 409);
    const blockedPayload = await workflowBlocked.json();
    assert.deepEqual(blockedPayload.workflow.blockers, ["AUTHOR_APPROVAL_REQUIRED"]);

    const workflowAdvanced = await fetch(`${baseUrl}/api/projects/${projectId}/workflow/advance`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bookId, checks: { concept: [{ id: "concept.ready", label: "Concept approved", passed: true }] }, authorApproved: true, now: "2026-08-30T03:00:00.000Z" }) });
    const advancedText = await workflowAdvanced.text();
    assert.equal(workflowAdvanced.ok, true, `Workflow advance failed (${workflowAdvanced.status}): ${advancedText}`);
    const advancedPayload = JSON.parse(advancedText);
    assert.equal(advancedPayload.workflow.toStage, "architecture");
    assert.equal(advancedPayload.project.workflowStage, "architecture");
    const persistedWorkflowResponse = await fetch(`${baseUrl}/api/projects/${projectId}/workflow`);
    const persistedWorkflowText = await persistedWorkflowResponse.text();
    assert.equal(persistedWorkflowResponse.ok, true, `Workflow read failed (${persistedWorkflowResponse.status}): ${persistedWorkflowText}`);
    const persistedWorkflow = JSON.parse(persistedWorkflowText);
    assert.equal(persistedWorkflow.currentStage, "architecture");

    await page.locator('nav a[data-route="writing"]').click();
    await page.locator("#editor-scene").selectOption(sceneId);
    await page.locator("#editor-content").fill(CRAFT_FIXTURE);
    await page.locator("#save-scene").click();
    await page.waitForFunction(() => document.querySelector("#success-banner")?.textContent.includes("Scene saved"));

    await page.locator("#craft-lens-analyze").click();
    await page.waitForFunction(() => document.querySelector("#craft-lens-status")?.textContent.includes("finding"), null, { timeout: 10000 });
    const craftFindings = await page.locator("#craft-lens-results .craft-finding").count();
    assert.ok(craftFindings > 0, "Craft Lens should surface at least one finding for the fixture.");

    await page.locator("#author-goal-target").fill("250");
    await page.locator("#author-goal-period").selectOption("session");
    await page.locator("#author-goal-save").click();
    await page.waitForFunction(() => document.querySelector("#author-goal-status")?.textContent.includes("250"));

    await page.locator('nav a[data-route="health"]').click();
    await page.waitForFunction(() => document.querySelector("#health-detail")?.textContent.includes("architecture"));

    await context.close();
  } finally {
    if (browser) await browser.close();
    server.kill("SIGTERM");
    await rm(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

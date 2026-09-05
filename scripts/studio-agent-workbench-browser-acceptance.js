#!/usr/bin/env node
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtemp, rm, stat } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { chromium } = require("@playwright/test");

const HOST = "127.0.0.1";
const PORT = 5840 + Math.floor(Math.random() * 120);
const PROJECT_ID = "agent-workbench-acceptance";
const BOOK_ID = "book-agent";
const CHAPTER_ID = "chapter-agent";
const SCENE_ID = "scene-agent";

async function waitForHttp(url, timeoutMs = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function api(base, path, method = "GET", payload) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${method} ${path} failed (${response.status}): ${body.error || JSON.stringify(body)}`);
  return body;
}

async function main() {
  const dataDir = await mkdtemp(join(tmpdir(), "forge-agent-workbench-"));
  const server = spawn(process.execPath, ["dist/studio-server.js"], {
    env: {
      ...process.env,
      HOST,
      PORT: String(PORT),
      FORGE_DATA_DIR: dataDir,
      OPENAI_API_KEY: "",
      OPENAI_MODEL: "",
      OLLAMA_BASE_URL: "",
      OLLAMA_MODEL: "",
      KINGS_AI_ENDPOINT: "",
      OMNIROUTE_BASE_URL: "",
      ROUTER9_BASE_URL: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let browser;
  try {
    const base = `http://${HOST}:${PORT}`;
    await waitForHttp(`${base}/api/health`);
    await api(base, "/api/projects", "POST", { id: PROJECT_ID, title: "Agent Workbench Acceptance" });
    await api(base, `/api/projects/${PROJECT_ID}/workspace/books`, "POST", { id: BOOK_ID, title: "The Verified Forge", kind: "novel", description: "Acceptance fixture" });
    await api(base, `/api/projects/${PROJECT_ID}/workspace/books/${BOOK_ID}/chapters`, "POST", { id: CHAPTER_ID, number: 1, title: "Proof", synopsis: "A scene proving governed creative operations." });
    await api(base, `/api/projects/${PROJECT_ID}/workspace/books/${BOOK_ID}/chapters/${CHAPTER_ID}/scenes`, "POST", { id: SCENE_ID, number: 1, title: "The Test", synopsis: "The author inspects the Forge." });
    await api(base, `/api/projects/${PROJECT_ID}/workspace/books/${BOOK_ID}/chapters/${CHAPTER_ID}/scenes/${SCENE_ID}/content`, "PUT", { content: "The author opened the Forge and checked every visible boundary. Nothing changed without a deliberate decision." });

    const registry = await api(base, `/api/projects/${PROJECT_ID}/agent/tools`);
    assert.equal(registry.formatVersion, 3);
    assert.equal(registry.authority, "discovery-only");
    assert.equal(registry.tools.length, 12);
    assert.equal(registry.tools.find((tool) => tool.id === "writing.propose")?.pathTemplate, "/api/projects/:projectId/ai/writing/generate");
    assert.equal(registry.tools.find((tool) => tool.id === "visual.image.generate")?.pathTemplate, "/api/projects/:projectId/ai/image");
    assert.equal(registry.tools.find((tool) => tool.id === "cover.direction.propose")?.pathTemplate, "/api/projects/:projectId/agent/cover-direction");
    assert.equal(registry.tools.some((tool) => tool.pathTemplate.includes("/apply") || tool.pathTemplate.includes("/content")), false);

    browser = await chromium.launch({ executablePath: process.env.FORGE_BROWSER_EXECUTABLE || chromium.executablePath(), headless: true, args: ["--no-sandbox", "--disable-gpu"] });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, acceptDownloads: true });
    const page = await context.newPage();
    await page.goto(`${base}/forge-agent.html?project=${PROJECT_ID}`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelector("#agent-status")?.textContent.includes("Project truth loaded"));

    assert.equal(await page.locator("#agent-book").inputValue(), BOOK_ID);
    assert.equal(await page.locator("#agent-chapter").inputValue(), CHAPTER_ID);
    assert.equal(await page.locator("#agent-scene").inputValue(), SCENE_ID);
    assert.match(await page.locator("#agent-snapshot").innerText(), /The Verified Forge/);
    assert.match(await page.locator("#agent-snapshot").innerText(), /Agent tools\s*12/);
    assert.equal(await page.locator("#agent-tools li").count(), 12);

    await page.locator("#agent-mode").selectOption("editor");
    await page.locator("#agent-goal").fill("Draft a stronger version of this scene while preserving the author's intent.");
    await page.locator("#agent-form button[type=submit]").tap();
    await page.waitForFunction(() => document.querySelector('[data-tool-id="writing.propose"]'));
    assert.match(await page.locator('[data-tool-id="writing.propose"]').innerText(), /configured not to draft new prose/);
    assert.equal(await page.locator('[data-tool-id="writing.propose"] button').isDisabled(), true);
    assert.equal((await api(base, `/api/projects/${PROJECT_ID}/collaboration`)).mode, "editor");

    await page.locator("#agent-mode").selectOption("autonomous");
    await page.locator("#agent-goal").fill("Draft and continuity edit this scene, grounded in the current project truth.");
    await page.locator("#agent-form button[type=submit]").tap();
    await page.waitForFunction(() => document.querySelector('[data-tool-id="project.context"]') && document.querySelector('[data-tool-id="editing.analyze"]'));
    assert.equal((await api(base, `/api/projects/${PROJECT_ID}/collaboration`)).mode, "autonomous");
    assert.match(await page.locator(".agent-group-run").innerText(), /2 safe read-only steps/);
    await page.locator(".agent-group-run").tap();
    await page.waitForFunction(() => document.querySelector('[data-tool-id="project.context"] button')?.textContent === "Completed" && document.querySelector('[data-tool-id="editing.analyze"] button')?.textContent === "Completed");
    const autonomousStatusHandle = await page.waitForFunction(() => {
      const text = document.querySelector("#agent-status")?.textContent || "";
      return /no unapproved state-changing step ran automatically/i.test(text) ? text : false;
    });
    const autonomousStatus = await autonomousStatusHandle.jsonValue();
    assert.equal(await page.locator('[data-tool-id="writing.propose"] button').isEnabled(), true, "writing should still require its own author approval");
    assert.notEqual(await page.locator('[data-tool-id="writing.propose"] button').innerText(), "Completed");
    assert.match(autonomousStatus, /completed/i, "autonomous read-only group should report completion");
    assert.match(autonomousStatus, /no unapproved state-changing step ran automatically/i, "autonomous read-only group must explicitly preserve author approval boundaries");

    await page.locator('[data-tool-id="memory.record-working"] button').tap();
    await page.waitForFunction(() => document.querySelector('[data-tool-id="memory.record-working"] button')?.textContent === "Completed");
    const projectAfterRecord = await api(base, `/api/projects/${PROJECT_ID}`);
    const runMemory = projectAfterRecord.memories.find((memory) => memory.relevanceTags?.includes("agent-workflow") && !memory.relevanceTags?.includes("agent-recipe"));
    assert.ok(runMemory, "Agent Workbench should persist explicit run evidence");
    assert.equal(runMemory.authority, "working");
    assert.equal(runMemory.class, "creative-note");

    await page.locator("#agent-recipe-name").fill("Verified Review Pass");
    await page.locator("#agent-recipe-save").tap();
    await page.waitForFunction(() => document.querySelector("#agent-recipe-status")?.textContent.includes("Saved Verified Review Pass"));
    const savedRecipes = await api(base, `/api/projects/${PROJECT_ID}/agent/recipes`);
    assert.equal(savedRecipes.recipes.length, 1);
    assert.equal(savedRecipes.recipes[0].title, "Verified Review Pass");
    assert.notEqual(await page.locator("#agent-recipe-select").inputValue(), "");
    await page.locator("#agent-recipe-compile").tap();
    await page.waitForFunction(() => document.querySelector("#agent-recipe-status")?.textContent.includes("Recipe compiled"));
    assert.equal(await page.locator('[data-tool-id="memory.record-working"]').count(), 1, "compiled Recipe must contain exactly one final workflow evidence step");
    const compiledToolIds = await page.locator(".agent-step").evaluateAll((nodes) => nodes.map((node) => node.dataset.toolId));
    assert.equal(compiledToolIds.at(-1), "memory.record-working");

    await page.locator("#agent-goal").fill("Export a PDF review copy of the current manuscript.");
    await page.locator("#agent-form button[type=submit]").tap();
    await page.waitForFunction(() => document.querySelector('[data-tool-id="production.export"]'));
    const downloadPromise = page.waitForEvent("download");
    await page.locator('[data-tool-id="production.export"] button').tap();
    const download = await downloadPromise;
    const path = await download.path();
    assert.ok(path, "Production export should create a real download");
    assert.ok((await stat(path)).size > 100, "Production export should contain real bytes");
    assert.equal(await download.suggestedFilename(), "the-verified-forge.pdf");

    await page.locator("#agent-goal").fill("Create a cover image for this book.");
    await page.locator("#agent-form button[type=submit]").tap();
    await page.waitForFunction(() => document.querySelector('[data-tool-id="visual.image.generate"]'));
    await page.locator('[data-tool-id="visual.image.generate"] button').tap();
    const imageStep = page.locator('[data-tool-id="visual.image.generate"]');
    await page.waitForFunction(() => /No real image provider is configured/i.test(document.querySelector('[data-tool-id="visual.image.generate"] .agent-result')?.textContent || ""));
    assert.match(await imageStep.locator(".agent-result").innerText(), /No real image provider is configured/i);
    assert.match(await page.locator("#agent-status").innerText(), /failed safely.*No later step was run/i);
    assert.match(await imageStep.locator("button").innerText(), /Retry approved step/i);

    const overflow = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, body: document.body.scrollWidth, doc: document.documentElement.scrollWidth }));
    assert.ok(overflow.body <= overflow.viewport + 1 && overflow.doc <= overflow.viewport + 1, `Agent Workbench mobile shell overflows: ${JSON.stringify(overflow)}`);
    const buttons = await page.locator("button").evaluateAll((nodes) => nodes.filter((node) => node.offsetParent !== null).map((node) => ({ text: node.textContent.trim(), height: node.getBoundingClientRect().height })));
    assert.ok(buttons.filter((button) => button.text).every((button) => button.height >= 40), `Agent Workbench contains undersized visible touch actions: ${JSON.stringify(buttons.filter((button) => button.height < 40))}`);

    await context.close();
    console.log("FORGE AGENT WORKBENCH BROWSER ACCEPTANCE PASSED: registry v3 + 12 governed tools + Editor enforcement + bounded Autonomous read-only group + durable workflow evidence + Forge Recipe round-trip + real PDF export + honest no-provider image failure + safety-stop status + Android fit/touch.");
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill("SIGTERM");
    await new Promise((resolve) => server.exitCode !== null ? resolve() : server.once("exit", resolve));
    await rm(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });

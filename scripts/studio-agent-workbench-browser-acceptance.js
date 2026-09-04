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
    assert.equal(registry.formatVersion, 1);
    assert.equal(registry.authority, "discovery-only");
    assert.equal(registry.tools.length, 7);
    assert.equal(registry.tools.find((tool) => tool.id === "writing.propose")?.pathTemplate, "/api/projects/:projectId/ai/writing/generate");
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
    assert.match(await page.locator("#agent-snapshot").innerText(), /The Test/);

    // Editor mode must make the drafting restriction real at the orchestration surface.
    await page.locator("#agent-mode").selectOption("editor");
    await page.locator("#agent-goal").fill("Draft a stronger version of this scene while preserving the author's intent.");
    await page.locator("#agent-form button[type=submit]").tap();
    await page.waitForFunction(() => document.querySelector('[data-step-id="writing"]'));
    assert.match(await page.locator('[data-step-id="writing"]').innerText(), /Editor mode does not permit drafting/);
    assert.equal(await page.locator('[data-step-id="writing"] button').isDisabled(), true);
    assert.equal((await api(base, `/api/projects/${PROJECT_ID}/collaboration`)).mode, "editor");

    // Partner mode can plan drafting, but context runs independently and nothing auto-runs after it.
    await page.locator("#agent-mode").selectOption("partner");
    await page.locator("#agent-goal").fill("Draft a stronger version of this scene, grounded in the current project truth.");
    await page.locator("#agent-form button[type=submit]").tap();
    await page.waitForFunction(() => document.querySelector('[data-step-id="context"]'));
    assert.equal((await api(base, `/api/projects/${PROJECT_ID}/collaboration`)).mode, "partner");
    await page.locator('[data-step-id="context"] button').tap();
    await page.waitForFunction(() => document.querySelector('[data-step-id="context"] button')?.textContent === "Completed");
    assert.equal(await page.locator('[data-step-id="writing"] button').isEnabled(), true, "writing should still require its own approval click");
    assert.match(await page.locator("#agent-status").innerText(), /No additional step ran automatically/);

    // Explicitly record completed workflow evidence as working memory, not canon.
    await page.locator('[data-step-id="record"] button').tap();
    await page.waitForFunction(() => document.querySelector('[data-step-id="record"] button')?.textContent === "Completed");
    const projectAfterRecord = await api(base, `/api/projects/${PROJECT_ID}`);
    const runMemory = projectAfterRecord.memories.find((memory) => memory.relevanceTags?.includes("agent-workflow"));
    assert.ok(runMemory, "Agent Workbench should persist explicit run evidence");
    assert.equal(runMemory.authority, "working");
    assert.equal(runMemory.class, "creative-note");

    // Production is provider-independent and must download the exact real Forge artifact.
    await page.locator("#agent-goal").fill("Export a PDF review copy of this book.");
    await page.locator("#agent-form button[type=submit]").tap();
    await page.waitForFunction(() => document.querySelector('[data-step-id="production"]'));
    const downloadPromise = page.waitForEvent("download");
    await page.locator('[data-step-id="production"] button').tap();
    const download = await downloadPromise;
    const savedPath = join(dataDir, "agent-review.pdf");
    await download.saveAs(savedPath);
    assert.match(download.suggestedFilename(), /\.pdf$/i);
    assert.ok((await stat(savedPath)).size > 100, "real PDF artifact should contain bytes");
    await page.waitForFunction(() => document.querySelector('[data-step-id="production"] button')?.textContent === "Completed");
    assert.match(await page.locator('[data-step-id="production"] .agent-result').innerText(), /sha256/i);
    assert.doesNotMatch(await page.locator('[data-step-id="production"] .agent-result').innerText(), /contentBase64"\s*:\s*"[A-Za-z0-9+/]{100}/);

    const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, body: document.body.scrollWidth, document: document.documentElement.scrollWidth }));
    assert.ok(dimensions.body <= dimensions.viewport + 1, `Agent Workbench introduced horizontal body overflow: ${JSON.stringify(dimensions)}`);
    assert.ok(dimensions.document <= dimensions.viewport + 1, `Agent Workbench introduced horizontal document overflow: ${JSON.stringify(dimensions)}`);
    const approveBox = await page.locator('[data-step-id="production"] button').boundingBox();
    assert.ok(approveBox && approveBox.height >= 40, `Agent step control is too small for touch: ${JSON.stringify(approveBox)}`);

    console.log("FORGE AGENT WORKBENCH BROWSER ACCEPTANCE PASSED: live tool registry + real target loading + mode enforcement + explicit context execution + durable working-memory evidence + real PDF download + Android-sized layout.");
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill("SIGTERM");
    await new Promise((resolve) => server.exitCode !== null ? resolve() : server.once("exit", resolve));
    await rm(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });

#!/usr/bin/env node
"use strict";

/**
 * Production-browser proof for the main Author's Forge AI Writing Studio.
 *
 * This drives the actual Writing Desk UI against a real Studio process and a
 * loopback Ollama-compatible HTTP transport. It proves the author-facing path
 * is connected end to end: Project Brain context -> routed model request ->
 * pending durable proposal -> author approval -> explicit apply -> restart-safe
 * manuscript state. No provider function is injected into the Studio process.
 */
const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const { existsSync, readdirSync } = require("node:fs");
const { homedir, tmpdir } = require("node:os");
const { join } = require("node:path");
const { chromium } = require("@playwright/test");

const HOST = "127.0.0.1";
const GENERATED = [
  "Rain whispered across the windows while Mara held the brass compass against her palm.",
  "She stopped at the red cellar door and remembered the rule she had written into every plan: she would never open it alone.",
  "When Elias reached the landing, she met his eyes, waited for his nod, and only then reached toward the latch.",
].join(" ");

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

async function reservePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, HOST, resolve);
  });
  const address = server.address();
  const port = address && typeof address === "object" ? address.port : 0;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (!port) throw new Error("Could not reserve browser-acceptance port.");
  return port;
}

async function listen(server, port) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, HOST, resolve);
  });
}

async function close(server) {
  if (!server.listening) return;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
}

async function waitForHttp(url, child, stderr, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Studio exited before startup (${child.exitCode}).\n${stderr()}`);
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}.\n${stderr()}`);
}

async function jsonRequest(base, path, options = {}, expectedStatus) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
  });
  const text = await response.text();
  let payload;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  if (expectedStatus !== undefined) assert.equal(response.status, expectedStatus, `${options.method || "GET"} ${path}: ${text}`);
  else assert.equal(response.ok, true, `${options.method || "GET"} ${path}: ${text}`);
  return payload;
}

function providerEnv(baseEnv, ollamaUrl) {
  return {
    ...baseEnv,
    OLLAMA_BASE_URL: ollamaUrl,
    OLLAMA_MODEL: "forge-browser-operational",
    OLLAMA_MODELS: "",
    AI_PROVIDER_ORDER: "ollama",
    AI_SPEND_POLICY: "no-paid-tokens",
    AI_ROUTING_MODE: "quality",
    AI_PINNED_PROVIDER: "",
    AI_PINNED_MODEL: "",
    AI_MODEL_RESOURCES_JSON: "",
    OPENAI_API_KEY: "",
    OPENAI_MODEL: "",
    OPENAI_MODELS: "",
    OMNIROUTE_BASE_URL: "",
    OMNIROUTE_API_KEY: "",
    ROUTER9_BASE_URL: "",
    ROUTER9_API_KEY: "",
    KINGS_AI_RESPONSES_URL: "",
    KINGS_AI_ENDPOINT: "",
    KINGS_AI_API_KEY: "",
    GROQ_API_KEY: "",
    MISTRAL_API_KEY: "",
    GEMINI_API_KEY: "",
    ANTHROPIC_API_KEY: "",
    OPENROUTER_API_KEY: "",
    AI_GATEWAYS_JSON: "",
  };
}

async function main() {
  const executablePath = findBrowser();
  if (!executablePath) throw new Error("MAIN AI WRITING BROWSER ACCEPTANCE BLOCKED: no Chrome/Chromium executable found. Run npm run browser:install or set FORGE_BROWSER_EXECUTABLE.");

  const dataDir = await mkdtemp(join(tmpdir(), "forge-ai-writing-browser-"));
  const studioPort = await reservePort();
  const ollamaPort = await reservePort();
  const base = `http://${HOST}:${studioPort}`;
  const projectId = `ai-writing-browser-${Date.now()}`;
  const bookId = "browser-book";
  const chapterId = "browser-chapter";
  const sceneId = "browser-scene";
  const original = "Mara stood at the cellar landing with the brass compass in her palm.";
  const providerRequests = [];

  const ollama = createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/api/chat") {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
      return;
    }
    let raw = "";
    for await (const chunk of req) raw += String(chunk);
    const payload = JSON.parse(raw);
    providerRequests.push(payload);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      model: "forge-browser-operational",
      message: { role: "assistant", content: GENERATED },
      prompt_eval_count: 260,
      eval_count: 86,
      done: true,
    }));
  });
  await listen(ollama, ollamaPort);

  let stderr = "";
  const studio = spawn(process.execPath, ["dist/studio-server.js"], {
    env: {
      ...providerEnv(process.env, `http://${HOST}:${ollamaPort}`),
      HOST,
      PORT: String(studioPort),
      FORGE_DATA_DIR: dataDir,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  studio.stderr.on("data", (chunk) => { stderr += String(chunk); });

  let browser;
  try {
    await waitForHttp(`${base}/api/health`, studio, () => stderr);

    await jsonRequest(base, "/api/projects", {
      method: "POST",
      body: JSON.stringify({ id: projectId, title: "Browser AI Writing Proof" }),
    }, 201);
    await jsonRequest(base, `/api/projects/${projectId}/workspace/books`, {
      method: "POST",
      body: JSON.stringify({ id: bookId, title: "Browser Book", kind: "novel" }),
    }, 201);
    await jsonRequest(base, `/api/projects/${projectId}/workspace/books/${bookId}/chapters`, {
      method: "POST",
      body: JSON.stringify({ id: chapterId, number: 1, title: "The Cellar" }),
    }, 201);
    await jsonRequest(base, `/api/projects/${projectId}/workspace/books/${bookId}/chapters/${chapterId}/scenes`, {
      method: "POST",
      body: JSON.stringify({ id: sceneId, number: 1, title: "At the Door" }),
    }, 201);
    await jsonRequest(base, `/api/projects/${projectId}/workspace/books/${bookId}/chapters/${chapterId}/scenes/${sceneId}/content`, {
      method: "PUT",
      body: JSON.stringify({ content: original }),
    }, 200);
    await jsonRequest(base, `/api/projects/${projectId}/memory`, {
      method: "POST",
      body: JSON.stringify({
        id: "browser-canon-cellar-rule",
        class: "story-canon",
        authority: "authoritative",
        summary: "Cellar rule",
        content: "Mara never opens the red cellar door alone; Elias must be with her.",
        reference: "author-approved-browser-proof",
      }),
    }, 201);

    browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-gpu"] });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${base}/?project=${encodeURIComponent(projectId)}`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.readyState === "complete" && document.querySelector("#project-title")?.textContent !== "Loading…");

    assert.equal(await page.evaluate(() => Boolean(document.querySelector('script[data-forge-extension="royal-ui"]'))), true, "The operational Writing Desk must be running inside the main white-marble Studio shell.");
    await page.locator('nav a[data-route="writing"]').click();
    await page.waitForFunction(() => location.hash === "#writing" && document.querySelector("#writing")?.hidden === false);
    await page.waitForFunction((expected) => document.querySelector("#editor-content")?.value === expected, original);
    assert.equal(await page.locator("#editor-book").inputValue(), bookId);
    assert.equal(await page.locator("#editor-chapter").inputValue(), chapterId);
    assert.equal(await page.locator("#editor-scene").inputValue(), sceneId);

    await page.locator("#ai-instruction").fill("Continue this scene while preserving the established cellar rule and Mara's brass compass.");
    await page.locator("#ai-task").selectOption("continue");
    await page.locator("#ai-draft").click();

    await page.waitForFunction((expected) => document.querySelector("#ai-result")?.value === expected, GENERATED);
    await page.waitForSelector("#ai-proposals [data-proposal]");
    assert.equal(providerRequests.length, 1, "AI Draft must make exactly one real routed provider request.");
    const providerPrompt = providerRequests[0].messages.map((message) => message.content).join("\n\n");
    assert.match(providerPrompt, /AUTHOR'S FORGE QUALITY CONTRACT/);
    assert.match(providerPrompt, /GOVERNED PROJECT CONTEXT/);
    assert.match(providerPrompt, /Mara never opens the red cellar door alone/);
    assert.match(providerPrompt, /brass compass/);

    const beforeApproval = await jsonRequest(base, `/api/projects/${projectId}/workspace`);
    assert.equal(beforeApproval.books[0].chapters[0].scenes[0].content, original, "AI Draft must remain proposal-only before author approval.");

    await page.locator("#ai-proposals [data-proposal-accept]").click();
    await page.waitForSelector("#ai-proposals [data-proposal-apply]");
    assert.match(await page.locator("#success-banner").innerText(), /Proposal approved/);

    const afterApproval = await jsonRequest(base, `/api/projects/${projectId}/workspace`);
    assert.equal(afterApproval.books[0].chapters[0].scenes[0].content, original, "Approve must still not mutate manuscript state.");

    await page.locator("#ai-proposals [data-proposal-apply]").click();
    await page.waitForFunction((expected) => document.querySelector("#editor-content")?.value === expected, GENERATED);
    assert.match(await page.locator("#success-banner").innerText(), /applied/i);

    await page.reload({ waitUntil: "networkidle" });
    await page.locator('nav a[data-route="writing"]').click();
    await page.waitForFunction((expected) => document.querySelector("#editor-content")?.value === expected, GENERATED);
    const persisted = await jsonRequest(base, `/api/projects/${projectId}/workspace`);
    assert.equal(persisted.books[0].chapters[0].scenes[0].content, GENERATED);

    const proposals = await jsonRequest(base, `/api/projects/${projectId}/ai/proposals`);
    assert.equal(proposals.length, 1);
    assert.equal(proposals[0].status, "accepted");
    assert.ok(proposals[0].sourceMemoryIds.includes("browser-canon-cellar-rule"));

    await context.close();
    console.log("MAIN AI WRITING BROWSER ACCEPTANCE PASSED: white-marble Writing Desk -> Project Brain context -> real routed provider -> pending proposal -> author Approve -> explicit Apply -> durable reload.");
  } finally {
    if (browser) await browser.close().catch(() => {});
    await stop(studio).catch(() => {});
    await close(ollama).catch(() => {});
    await rm(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});

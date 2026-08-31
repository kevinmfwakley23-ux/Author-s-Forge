#!/usr/bin/env node

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const { homedir, tmpdir } = require("node:os");
const { join } = require("node:path");
const { existsSync, readdirSync } = require("node:fs");
const { chromium } = require("@playwright/test");

const HOST = "127.0.0.1";
const PORT = 5100 + Math.floor(Math.random() * 200);
const projectId = `context-acceptance-${Date.now()}`;

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

async function post(url, body) {
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  assert.equal(response.ok, true, await response.text());
  return response.json();
}

function characterProfile() {
  return {
    name: "Mara Voss", age: 34, birthDate: "1992-01-15", physicalAppearance: "Weathered face with a steady gaze", height: "5'8", build: "Athletic", hair: "Dark brown", eyes: "Hazel", skin: "Olive", clothing: "Dark field jacket", voice: "Low and measured", speechPatterns: ["brief answers"], personality: "Observant and loyal", values: ["truth"], fears: ["losing the witness"], secrets: [], goals: ["find the witness"], motivations: ["protect the case"], relationships: [], history: "Former investigator rebuilding her life.", knowledge: ["Ogden streets"], skills: ["investigation"], weaknesses: ["insomnia"], characterArc: "Learns to trust others.", importantObjects: ["case notebook"], currentEmotionalState: "Determined", currentLocation: "Ogden", currentInjuries: []
  };
}

async function seed(baseUrl) {
  await post(`${baseUrl}/api/projects`, { id: projectId, title: "Context Acceptance Book" });
  await post(`${baseUrl}/api/projects/${projectId}/workspace/books`, { id: "book-1", title: "Acceptance Book", kind: "novel", description: "Context transparency test" });
  await post(`${baseUrl}/api/projects/${projectId}/workspace/books/book-1/chapters`, { id: "chapter-1", number: 1, title: "Opening", synopsis: "Mara follows the witness clue through Ogden." });
  await post(`${baseUrl}/api/projects/${projectId}/workspace/books/book-1/chapters/chapter-1/scenes`, { id: "scene-1", number: 1, title: "Reservoir Road", synopsis: "Mara searches for a missing witness." });
  await post(`${baseUrl}/api/projects/${projectId}/characters`, { id: "mara-1", profile: characterProfile() });
  await post(`${baseUrl}/api/projects/${projectId}/memory`, { id: "canon-1", class: "story-canon", authority: "authoritative", summary: "The missing witness last called from Ogden.", content: "Mara cannot move the witness sighting outside Ogden without an author override.", reference: "context-acceptance", relevanceTags: ["witness", "ogden"] });
  await post(`${baseUrl}/api/projects/${projectId}/memory`, { id: "timeline-1", class: "timeline-memory", authority: "verified", summary: "Witness call at 9:12 PM.", content: "The call happens before Mara reaches Reservoir Road.", reference: "context-acceptance", relevanceTags: ["witness", "reservoir"] });
  await post(`${baseUrl}/api/projects/${projectId}/memory`, { id: "research-1", class: "research-memory", authority: "working", summary: "Reservoir Road research note.", content: "Working location research for scene atmosphere.", reference: "context-acceptance", relevanceTags: ["reservoir"] });
}

async function verifyViewport(browser, baseUrl, viewport, label) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/?project=${encodeURIComponent(projectId)}#writing`, { waitUntil: "networkidle" });
  await page.waitForSelector("#ai-context-preview");
  await page.locator("#ai-instruction").fill("Continue Mara's search for the missing witness on Reservoir Road in Ogden.");
  assert.equal(await page.locator("#ai-context-depth").inputValue(), "6", `${label}: balanced context must be the default`);
  await page.locator("[data-context-preview]").click();
  await page.waitForFunction(() => document.querySelector("#ai-context-preview-body")?.textContent.includes("Why Forge selected this"));
  const preview = await page.locator("#ai-context-preview-body").innerText();
  assert.match(preview, /Mara Voss/, `${label}: salient character context must be visible`);
  assert.match(preview, /missing witness last called from Ogden/i, `${label}: authoritative canon must be visible`);
  assert.match(preview, /author-locked \/ authoritative/i, `${label}: selection evidence must be human-readable`);
  assert.match(preview, /Witness call at 9:12 PM/i, `${label}: timeline memory must be visible while enabled`);

  await page.locator('[data-context-section="timeline"]').uncheck();
  await page.waitForFunction(() => document.querySelector("#ai-context-preview-body")?.textContent.includes("Context settings changed"));
  await page.locator("#ai-context-depth").selectOption("3");
  await page.locator("[data-context-preview]").click();
  await page.waitForFunction(() => document.querySelector("#ai-context-preview-body")?.textContent.includes("Why Forge selected this"));
  const focused = await page.locator("#ai-context-preview-body").innerText();
  assert.doesNotMatch(focused, /Witness call at 9:12 PM/i, `${label}: disabled timeline must not be supplied`);
  assert.equal(await page.locator("#ai-context-depth").inputValue(), "3", `${label}: focused depth must remain selected`);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 1, `${label}: context controls must not introduce horizontal overflow (${overflow}px)`);
  await context.close();
}

async function main() {
  const executablePath = findBrowser();
  if (!executablePath) throw new Error("REAL CONTEXT BROWSER ACCEPTANCE BLOCKED: no Chrome/Chromium executable found.");
  const dataDir = await mkdtemp(join(tmpdir(), "authors-forge-context-browser-"));
  const server = spawn(process.execPath, ["dist/studio-server.js"], { env: { ...process.env, PORT: String(PORT), HOST, FORGE_DATA_DIR: dataDir, OPENAI_API_KEY: "", OPENAI_MODEL: "", OLLAMA_BASE_URL: "", OLLAMA_MODEL: "" }, stdio: ["ignore", "pipe", "pipe"] });
  let browser;
  try {
    const baseUrl = `http://${HOST}:${PORT}`;
    await waitForHttp(`${baseUrl}/api/health`);
    await seed(baseUrl);
    browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-gpu"] });
    await verifyViewport(browser, baseUrl, { width: 1365, height: 900 }, "desktop");
    await verifyViewport(browser, baseUrl, { width: 390, height: 844 }, "mobile");
    console.log("REAL CONTEXT BROWSER ACCEPTANCE PASSED: governed preview + human-readable provenance + author section controls + focused retrieval + desktop/mobile fit.");
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill("SIGTERM");
    await new Promise((resolve) => server.exitCode !== null ? resolve() : server.once("exit", resolve));
    await rm(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
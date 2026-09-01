#!/usr/bin/env node

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { existsSync, readdirSync } = require("node:fs");
const { mkdtemp, rm } = require("node:fs/promises");
const { homedir, tmpdir } = require("node:os");
const { join } = require("node:path");
const { chromium } = require("@playwright/test");

const HOST = "127.0.0.1";
const PORT = 5250 + Math.floor(Math.random() * 200);
const projectId = `recovery-browser-${Date.now()}`;

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

async function jsonRequest(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
  });
  const text = await response.text();
  let payload;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  assert.equal(response.ok, true, `${options.method || "GET"} ${path} failed (${response.status}): ${text}`);
  return payload;
}

async function readDownloadJson(download) {
  const stream = await download.createReadStream();
  assert.ok(stream, "rollback download must provide a readable stream");
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function memoryIds(project) {
  return (project.memories || []).map((memory) => memory.id).sort();
}

async function approveNextRestore(page) {
  page.once("dialog", async (dialog) => {
    assert.equal(dialog.type(), "confirm");
    assert.match(dialog.message(), /replaces the current durable project state/i);
    await dialog.accept();
  });
}

async function performUiRestore(page, baseUrl, pkg, filename) {
  await page.locator("#restore-project-file").setInputFiles({
    name: filename,
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(pkg), "utf8"),
  });
  await page.waitForFunction(() => document.querySelector("#restore-project-status")?.textContent.includes("Selected"));
  await page.locator("#restore-project-confirm").check();
  await approveNextRestore(page);
  const downloadPromise = page.waitForEvent("download");
  const responsePromise = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === `/api/projects/${projectId}/package/restore`);
  await page.locator("#restore-project").click();
  const response = await responsePromise;
  const body = await response.text();
  assert.equal(response.ok(), true, `live recovery route failed (${response.status()}): ${body}`);
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /forge-rollback/i);
  const rollback = await readDownloadJson(download);
  await page.waitForFunction(() => document.querySelector("#success-banner")?.textContent.includes("Project restored from the validated package"));
  return rollback;
}

async function main() {
  const executablePath = findBrowser();
  if (!executablePath) throw new Error("RECOVERY BROWSER ACCEPTANCE BLOCKED: no Chrome/Chromium executable found.");
  const dataDir = await mkdtemp(join(tmpdir(), "authors-forge-recovery-browser-"));
  const server = spawn(process.execPath, ["dist/studio-server.js"], {
    env: { ...process.env, PORT: String(PORT), HOST, FORGE_DATA_DIR: dataDir, OPENAI_API_KEY: "", OPENAI_MODEL: "", OLLAMA_BASE_URL: "", OLLAMA_MODEL: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let browser;
  try {
    const baseUrl = `http://${HOST}:${PORT}`;
    await waitForHttp(`${baseUrl}/api/health`);
    await jsonRequest(baseUrl, "/api/projects", { method: "POST", body: JSON.stringify({ id: projectId, title: "Recovery Browser Acceptance" }) });
    await jsonRequest(baseUrl, `/api/projects/${projectId}/memory`, {
      method: "POST",
      body: JSON.stringify({ id: "recovery-baseline", class: "creative-note", authority: "working", summary: "Baseline", content: "Baseline package state.", reference: "recovery-browser-acceptance" }),
    });
    const baselinePackage = await jsonRequest(baseUrl, `/api/projects/${projectId}/package`);
    await jsonRequest(baseUrl, `/api/projects/${projectId}/memory`, {
      method: "POST",
      body: JSON.stringify({ id: "recovery-later", class: "creative-note", authority: "working", summary: "Later state", content: "State that must be captured by rollback.", reference: "recovery-browser-acceptance" }),
    });

    browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-gpu"] });
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/?project=${encodeURIComponent(projectId)}#versions`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelector("#project-title")?.textContent !== "Loading…" && document.querySelector("#project-recovery-card"));
    await page.locator('nav a[data-route="versions"]').click();
    await page.waitForFunction(() => location.hash === "#versions" && document.querySelector("#versions")?.hidden === false);

    await page.locator("#restore-project-file").setInputFiles({ name: "baseline.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(baselinePackage), "utf8") });
    await page.locator("#restore-project").click();
    await page.waitForFunction(() => document.querySelector("#error-banner")?.textContent.includes("Acknowledge the recovery warning"));
    let durable = await jsonRequest(baseUrl, `/api/projects/${projectId}`);
    assert.deepEqual(memoryIds(durable), ["recovery-baseline", "recovery-later"], "unacknowledged UI restore must not mutate durable state");

    const rollbackPackage = await performUiRestore(page, baseUrl, baselinePackage, "baseline.json");
    assert.equal(rollbackPackage.manifest.projectId, projectId);
    const rollbackState = rollbackPackage.projectState?.project || rollbackPackage.projectState;
    assert.deepEqual(memoryIds(rollbackState), ["recovery-baseline", "recovery-later"], "downloaded rollback package must preserve pre-restore state");
    durable = await jsonRequest(baseUrl, `/api/projects/${projectId}`);
    assert.deepEqual(memoryIds(durable), ["recovery-baseline"], "approved UI restore must persist selected package state");

    await performUiRestore(page, baseUrl, rollbackPackage, "rollback.json");
    durable = await jsonRequest(baseUrl, `/api/projects/${projectId}`);
    assert.deepEqual(memoryIds(durable), ["recovery-baseline", "recovery-later"], "downloaded rollback package must be usable through the same UI recovery path");

    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/150 Mobile Safari/537.36" });
    const mobile = await mobileContext.newPage();
    await mobile.goto(`${baseUrl}/?project=${encodeURIComponent(projectId)}#versions`, { waitUntil: "networkidle" });
    await mobile.waitForFunction(() => document.querySelector("#project-recovery-card"));
    await mobile.locator('nav a[data-route="versions"]').tap();
    const restoreBox = await mobile.locator("#restore-project").boundingBox();
    assert.ok(restoreBox && restoreBox.height >= 40, `recovery restore target is too small for Android touch: ${JSON.stringify(restoreBox)}`);
    const dimensions = await mobile.evaluate(() => ({ viewport: document.documentElement.clientWidth, body: document.body.scrollWidth, document: document.documentElement.scrollWidth }));
    assert.ok(dimensions.body <= dimensions.viewport + 1, `recovery UI body overflows Android viewport: ${JSON.stringify(dimensions)}`);
    assert.ok(dimensions.document <= dimensions.viewport + 1, `recovery UI document overflows Android viewport: ${JSON.stringify(dimensions)}`);
    await mobileContext.close();

    console.log("RECOVERY BROWSER ACCEPTANCE PASSED: author acknowledgement + real file selection + governed live restore + automatic rollback download + rollback reuse + Android touch/overflow.");
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill("SIGTERM");
    await new Promise((resolve) => server.exitCode !== null ? resolve() : server.once("exit", resolve));
    await rm(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });

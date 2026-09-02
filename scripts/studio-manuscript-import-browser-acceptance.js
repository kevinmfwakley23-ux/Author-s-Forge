#!/usr/bin/env node
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { createServer } = require("node:net");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { chromium } = require("@playwright/test");

const HOST = "127.0.0.1";
const projectId = `manuscript-import-browser-${Date.now()}`;
const SOURCE = `# Chapter One — Arrival\n\nMara reached the station before dawn.\n\n***\n\nThe platform lights went dark.\n\n# Chapter Two — The Call\n\nHer phone rang once.`;

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, HOST, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function request(base, path, method = "GET", payload) {
  const response = await fetch(base + path, { method, headers: { "content-type": "application/json" }, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) });
  const text = await response.text();
  assert.equal(response.ok, true, `${method} ${path} failed (${response.status}): ${text}`);
  return text ? JSON.parse(text) : {};
}

async function waitForHttp(url, timeout = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 2000)),
  ]);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await new Promise((resolve) => child.once("exit", resolve));
  }
}

async function main() {
  const dataDir = await mkdtemp(join(tmpdir(), "forge-manuscript-import-browser-"));
  const port = await freePort();
  const app = spawn(process.execPath, ["dist/studio-server.js"], {
    env: { ...process.env, HOST, PORT: String(port), FORGE_DATA_DIR: dataDir, OPENAI_API_KEY: "", OLLAMA_BASE_URL: "", KINGS_AI_ENDPOINT: "", OMNIROUTE_BASE_URL: "", ROUTER9_BASE_URL: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  app.stderr.on("data", (chunk) => { stderr += String(chunk); });
  let browser;
  try {
    const base = `http://${HOST}:${port}`;
    try { await waitForHttp(`${base}/api/health`); }
    catch (error) { throw new Error(`${error.message}\nStudio stderr:\n${stderr}`); }
    await request(base, "/api/projects", "POST", { id: projectId, title: "Manuscript Import Browser Acceptance" });

    browser = await chromium.launch({ executablePath: process.env.FORGE_BROWSER_EXECUTABLE || chromium.executablePath(), headless: true, args: ["--no-sandbox", "--disable-gpu"] });
    const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await desktop.newPage();
    await page.goto(`${base}/?project=${projectId}#manuscript`, { waitUntil: "networkidle" });
    await page.locator("#manuscript-import-card").waitFor();

    let workspace = await request(base, `/api/projects/${projectId}/workspace`);
    assert.equal(workspace.books.length, 0, "Preview fixture must begin with an empty workspace.");

    await page.locator("#manuscript-import-file").setInputFiles({ name: "Winter Gate.md", mimeType: "text/markdown", buffer: Buffer.from(SOURCE, "utf8") });
    await page.locator("#manuscript-import-title").fill("Winter Gate Imported");
    const previewResponse = page.waitForResponse((response) => response.url().endsWith(`/api/projects/${projectId}/manuscript-import/preview`) && response.request().method() === "POST");
    await page.locator("#manuscript-import-preview").click();
    assert.equal((await previewResponse).status(), 200);
    await page.waitForFunction(() => document.querySelector("#manuscript-import-status")?.textContent.includes("2 chapter(s), 3 scene(s)"));
    const previewText = await page.locator("#manuscript-import-summary").innerText();
    assert.match(previewText, /Chapter One — Arrival/);
    assert.match(previewText, /Chapter Two — The Call/);
    assert.match(previewText, /SHA-256 [a-f0-9]{64}/);
    assert.equal(await page.locator("#manuscript-import-apply").isEnabled(), true);

    workspace = await request(base, `/api/projects/${projectId}/workspace`);
    assert.equal(workspace.books.length, 0, "Preview must not mutate durable manuscript state.");

    const applyResponse = page.waitForResponse((response) => response.url().endsWith(`/api/projects/${projectId}/manuscript-import/apply`) && response.request().method() === "POST");
    await page.locator("#manuscript-import-apply").click();
    assert.equal((await applyResponse).status(), 201);
    await page.waitForFunction(() => document.querySelector("#manuscript-import-status")?.textContent.includes("Imported 2 chapter(s), 3 scene(s)"));

    workspace = await request(base, `/api/projects/${projectId}/workspace`);
    assert.equal(workspace.books.length, 1);
    assert.equal(workspace.books[0].title, "Winter Gate Imported");
    assert.equal(workspace.books[0].chapters.length, 2);
    assert.equal(workspace.books[0].chapters[0].scenes.length, 2);
    assert.equal(workspace.books[0].chapters[0].scenes[0].content, "Mara reached the station before dawn.");
    assert.equal(workspace.books[0].chapters[0].scenes[1].content, "The platform lights went dark.");
    assert.equal(workspace.books[0].chapters[1].scenes[0].content, "Her phone rang once.");
    assert.match(workspace.books[0].description, /Imported from Winter Gate\.md/);
    assert.match(workspace.books[0].description, /source SHA-256 [a-f0-9]{64}/);

    await page.reload({ waitUntil: "networkidle" });
    await page.locator("#manuscript-import-card").waitFor();
    await page.waitForFunction(() => document.querySelector("#book-tree")?.textContent.includes("Winter Gate Imported"));
    assert.match(await page.locator("#book-tree").innerText(), /Winter Gate Imported/, "Imported book must survive Studio reload.");
    await desktop.close();

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const phone = await mobile.newPage();
    await phone.goto(`${base}/?project=${projectId}#manuscript`, { waitUntil: "networkidle" });
    await phone.locator("#manuscript-import-card").waitFor();
    const dimensions = await phone.evaluate(() => ({ viewport: document.documentElement.clientWidth, body: document.body.scrollWidth, doc: document.documentElement.scrollWidth }));
    assert.ok(dimensions.body <= dimensions.viewport + 1, `Manuscript import mobile body overflow: ${JSON.stringify(dimensions)}`);
    assert.ok(dimensions.doc <= dimensions.viewport + 1, `Manuscript import mobile document overflow: ${JSON.stringify(dimensions)}`);
    const previewBox = await phone.locator("#manuscript-import-preview").boundingBox();
    const applyBox = await phone.locator("#manuscript-import-apply").boundingBox();
    assert.ok(previewBox && previewBox.height >= 40, `Manuscript preview touch target too small: ${JSON.stringify(previewBox)}`);
    assert.ok(applyBox && applyBox.height >= 40, `Manuscript apply touch target too small: ${JSON.stringify(applyBox)}`);
    await mobile.close();

    console.log("MANUSCRIPT IMPORT BROWSER ACCEPTANCE PASSED: preview-before-mutation + Markdown chapter/scene detection + durable new-book apply + provenance + reload + Android fit/touch.");
  } finally {
    if (browser) await browser.close().catch(() => {});
    await stopChild(app);
    await rm(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });

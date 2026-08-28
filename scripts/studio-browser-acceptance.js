#!/usr/bin/env node

/**
 * Author's Forge real-browser acceptance harness.
 *
 * This deliberately runs outside the normal Node test suite. It launches a
 * real Chrome/Chromium executable and drives the actual Studio DOM through
 * Chrome DevTools Protocol. If no browser is available, it fails loudly.
 */

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtemp, readdir, rm } = require("node:fs/promises");
const { existsSync } = require("node:fs");
const { homedir, tmpdir } = require("node:os");
const { join } = require("node:path");
const { request } = require("node:http");

const HOST = "127.0.0.1";
const APP_PORT = 4800 + Math.floor(Math.random() * 200);
const CDP_PORT = 5300 + Math.floor(Math.random() * 200);
const projectId = `browser-acceptance-${Date.now()}`;

async function findPlaywrightBrowser(root) {
  if (!root || !existsSync(root)) return null;

  const candidates = [];
  async function walk(directory, depth) {
    if (depth > 4) return;
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(directory, entry.name);
      if (entry.isFile() && entry.name === "chrome" && existsSync(fullPath)) {
        candidates.push(fullPath);
      } else if (entry.isDirectory()) {
        await walk(fullPath, depth + 1);
      }
    }
  }

  await walk(root, 0);
  return candidates.find((candidate) => /chromium|chrome/i.test(candidate)) ?? candidates[0] ?? null;
}

async function findBrowser() {
  if (process.env.FORGE_BROWSER_EXECUTABLE) return process.env.FORGE_BROWSER_EXECUTABLE;

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
  return findPlaywrightBrowser(playwrightRoot);
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

function cdpRequest(path) {
  return new Promise((resolve, reject) => {
    const req = request({ host: HOST, port: CDP_PORT, path, method: "GET" }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        if (res.statusCode !== 200) return reject(new Error(`CDP ${path} returned ${res.statusCode}: ${body}`));
        try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

class CdpPage {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve);
      this.ws.addEventListener("error", (event) => reject(new Error(`CDP WebSocket error: ${event.message ?? "unknown"}`)));
    });
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
  }

  async connect() {
    await this.ready;
    await this.send("Page.enable");
    await this.send("Runtime.enable");
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? "Browser evaluation failed.");
    return result.result?.value;
  }

  async waitFor(expression, timeoutMs = 10000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (await this.evaluate(expression)) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Timed out waiting for browser condition: ${expression}`);
  }

  async close() {
    try { this.ws.close(); } catch {}
  }
}

async function main() {
  const browser = await findBrowser();
  if (!browser) {
    throw new Error(
      "REAL BROWSER ACCEPTANCE BLOCKED: no Chrome/Chromium executable was found. " +
      "Install/use a supported browser or set FORGE_BROWSER_EXECUTABLE=/path/to/chrome. " +
      "This command intentionally fails instead of claiming browser verification passed."
    );
  }

  console.log(`Browser acceptance executable: ${browser}`);
  const dataDir = await mkdtemp(join(tmpdir(), "authors-forge-browser-"));
  const browserDataDir = await mkdtemp(join(tmpdir(), "authors-forge-chrome-"));
  const server = spawn(process.execPath, ["dist/studio-server.js"], {
    env: { ...process.env, PORT: String(APP_PORT), HOST, FORGE_DATA_DIR: dataDir, OPENAI_API_KEY: "", OPENAI_MODEL: "", OLLAMA_BASE_URL: "", OLLAMA_MODEL: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const browserProcess = spawn(browser, [
    "--headless=new", "--disable-gpu", "--no-sandbox",
    `--user-data-dir=${browserDataDir}`,
    `--remote-debugging-port=${CDP_PORT}`,
    `http://${HOST}:${APP_PORT}/?project=${encodeURIComponent(projectId)}`,
  ], { stdio: ["ignore", "pipe", "pipe"] });

  let page;
  try {
    await waitForHttp(`http://${HOST}:${APP_PORT}/api/health`);
    await waitForHttp(`http://${HOST}:${CDP_PORT}/json/version`);
    const version = await cdpRequest("/json/version");
    page = new CdpPage(version.webSocketDebuggerUrl);
    await page.connect();
    await page.waitFor("document.readyState === 'complete' && document.querySelector('#project-title') && document.querySelector('#project-title').textContent !== 'Loading…'");

    const routes = await page.evaluate("[...document.querySelectorAll('a[data-route]')].map((el) => el.dataset.route)");
    assert.deepEqual(routes, ["dashboard", "manuscript", "writing", "architecture", "characters", "world", "research", "editing", "voice", "art", "cover", "marketing", "publishing", "genome", "health", "versions", "settings", "governance"]);

    for (const route of routes) {
      await page.evaluate(`document.querySelector('a[data-route="${route}"]').click()`);
      await page.waitFor(`location.hash === '#${route}' && document.querySelector('#${route}').hidden === false`);
    }

    await page.evaluate("document.querySelector('a[data-route=dashboard]').click()");
    await page.waitFor("location.hash === '#dashboard'");
    await page.evaluate(`(() => { const f=document.querySelector('#project-form'); f.querySelector('[name=id]').value='${projectId}'; f.querySelector('[name=title]').value='Browser Acceptance Book'; f.querySelector('[name=kind]').value='novel'; f.requestSubmit(); })()`);
    await page.waitFor(`location.search.includes('project=${projectId}') && document.querySelector('#project-title').textContent === 'Browser Acceptance Book'`);

    await page.evaluate("document.querySelector('a[data-route=manuscript]').click()");
    await page.waitFor("location.hash === '#manuscript'");
    await page.evaluate("(() => { const f=document.querySelector('#book-form'); f.querySelector('[name=title]').value='Acceptance Book'; f.querySelector('[name=kind]').value='novel'; f.querySelector('[name=description]').value='Real browser acceptance'; f.requestSubmit(); })()");
    await page.waitFor("document.querySelector('#book-tree').textContent.includes('Acceptance Book')");
    await page.evaluate("(() => { const f=document.querySelector('#chapter-form'); f.querySelector('[name=number]').value='1'; f.querySelector('[name=title]').value='Opening'; f.querySelector('[name=synopsis]').value='Acceptance opening'; f.requestSubmit(); })()");
    await page.waitFor("document.querySelector('#scene-chapter option')");
    await page.evaluate("(() => { const f=document.querySelector('#scene-form'); f.querySelector('[name=number]').value='1'; f.querySelector('[name=title]').value='First Scene'; f.querySelector('[name=synopsis]').value='Acceptance scene'; f.requestSubmit(); })()");
    await page.waitFor("document.querySelector('#editor-scene option')");

    await page.evaluate("document.querySelector('a[data-route=writing]').click()");
    await page.waitFor("location.hash === '#writing'");
    await page.evaluate("document.querySelector('#editor-content').value='A real browser-driven manuscript scene.'");
    await page.evaluate("document.querySelector('#save-scene').click()");
    await page.waitFor("document.querySelector('#success-banner').textContent.includes('Scene saved.')");

    await page.evaluate("document.querySelector('#ai-draft').click()");
    await page.waitFor("document.querySelector('#error-banner').textContent.includes('provider') || document.querySelector('#error-banner').textContent.includes('configured')");

    await page.evaluate("location.reload()");
    await page.waitFor("document.readyState === 'complete' && document.querySelector('#project-title').textContent === 'Browser Acceptance Book'");
    await page.evaluate("document.querySelector('a[data-route=writing]').click()");
    await page.waitFor("document.querySelector('#editor-content').value === 'A real browser-driven manuscript scene.'");
    await page.evaluate("document.querySelector('a[data-route=health]').click()");
    await page.waitFor("document.querySelector('#health-result').textContent.includes('1')");

    console.log(`REAL BROWSER ACCEPTANCE PASSED: ${routes.length} routes + project + book + chapter + scene + save/reload + honest AI failure + health.`);
  } finally {
    if (page) await page.close();
    browserProcess.kill("SIGTERM");
    server.kill("SIGTERM");
    await Promise.allSettled([
      new Promise((resolve) => browserProcess.once("exit", resolve)),
      new Promise((resolve) => server.once("exit", resolve)),
    ]);
    await rm(browserDataDir, { recursive: true, force: true });
    await rm(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});

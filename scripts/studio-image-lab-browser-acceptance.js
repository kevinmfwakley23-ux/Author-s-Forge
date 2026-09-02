#!/usr/bin/env node
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { chromium } = require("@playwright/test");
const { FileProjectStore } = require("../dist/infrastructure/file-project-store.js");
const { createProject, withProjectStudioWorkspace, withProjectIllustrationAssetLibrary } = require("../dist/domain/project.js");
const { createStudioWorkspace, createWorkspaceBook, addWorkspaceBook, addWorkspaceChapter, addWorkspaceScene } = require("../dist/domain/studio-workspace.js");
const { createIllustrationAsset } = require("../dist/domain/illustration-asset-library.js");

const HOST = "127.0.0.1";
const PORT = 6700 + Math.floor(Math.random() * 100);
const projectId = `image-lab-browser-${Date.now()}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitForHttp(url, timeout = 12000) { const start = Date.now(); while (Date.now() - start < timeout) { try { if ((await fetch(url)).ok) return; } catch {} await sleep(100); } throw new Error(`Timed out waiting for ${url}`); }
async function stop(server) { if (!server || server.exitCode !== null) return; server.kill("SIGTERM"); await Promise.race([new Promise((resolve) => server.once("exit", resolve)), sleep(2500)]); if (server.exitCode === null) server.kill("SIGKILL"); }

async function seed(dataDir) {
  const store = new FileProjectStore(dataDir);
  let workspace = createStudioWorkspace();
  workspace = addWorkspaceBook(workspace, createWorkspaceBook({ id: "book-1", title: "Image Lab Book", kind: "childrens-book", now: "2026-09-01T20:00:00.000Z" }));
  workspace = addWorkspaceChapter(workspace, "book-1", { id: "chapter-1", number: 1, title: "Opening", now: "2026-09-01T20:01:00.000Z" });
  workspace = addWorkspaceScene(workspace, "book-1", "chapter-1", { id: "scene-1", number: 1, title: "Forest", now: "2026-09-01T20:02:00.000Z" });
  let project = withProjectStudioWorkspace(createProject({ id: projectId, title: "Image Lab Browser Acceptance", now: "2026-09-01T20:00:00.000Z" }), workspace, "2026-09-01T20:02:00.000Z");
  const pending = createIllustrationAsset({ id: "pending-art", projectId, bookId: "book-1", chapterId: "chapter-1", sceneId: "scene-1", characterId: "unassigned-character", locationId: "unassigned-location", prompt: "Seeded pending forest artwork", references: [], style: "watercolor", generationSettings: { provider: "test-fixture" }, approvalStatus: "pending", assetUri: "data:image/png;base64,QUJDRA==", now: "2026-09-01T20:03:00.000Z" });
  project = withProjectIllustrationAssetLibrary(project, { formatVersion: 1, projectId, assets: [pending], characterDesignLocks: [] }, "2026-09-01T20:03:00.000Z");
  await store.create(project);
}

async function main() {
  const dataDir = await mkdtemp(join(tmpdir(), "authors-forge-image-lab-browser-"));
  let server, browser;
  try {
    await seed(dataDir);
    server = spawn(process.execPath, ["dist/studio-server.js"], { env: { ...process.env, HOST, PORT: String(PORT), FORGE_DATA_DIR: dataDir, OPENAI_API_KEY: "", OPENAI_IMAGE_MODEL: "" }, stdio: ["ignore", "pipe", "pipe"] });
    const base = `http://${HOST}:${PORT}`;
    await waitForHttp(`${base}/api/health`);
    browser = await chromium.launch({ executablePath: process.env.FORGE_BROWSER_EXECUTABLE || chromium.executablePath(), headless: true, args: ["--no-sandbox", "--disable-gpu"] });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await page.addInitScript(() => {
      class TestSpeechRecognition {
        start() { this.onstart?.(); setTimeout(() => { const result = [{ transcript: "open writing" }]; result.isFinal = true; const results = [result]; this.onresult?.({ resultIndex: 0, results }); this.onend?.(); }, 10); }
        stop() { this.onend?.(); }
      }
      Object.defineProperty(window, "SpeechRecognition", { configurable: true, writable: true, value: TestSpeechRecognition });
      Object.defineProperty(window, "webkitSpeechRecognition", { configurable: true, writable: true, value: TestSpeechRecognition });
    });
    await page.goto(`${base}/?project=${encodeURIComponent(projectId)}#art`, { waitUntil: "networkidle" });
    await page.waitForSelector("#forge-image-lab #forge-image-history [data-image-asset='pending-art']");
    assert.match(await page.locator("#forge-image-history").innerText(), /Seeded pending forest artwork/);
    assert.match(await page.locator("#forge-image-history").innerText(), /Rights\/provenance: not yet declared/);

    const overflow = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, body: document.body.scrollWidth, doc: document.documentElement.scrollWidth }));
    assert.ok(overflow.body <= overflow.viewport + 1 && overflow.doc <= overflow.viewport + 1, `Image Lab mobile shell overflows: ${JSON.stringify(overflow)}`);
    const generateBox = await page.locator("#forge-image-generate").boundingBox();
    assert.ok(generateBox && generateBox.height >= 40, "Image generation action must remain touch-usable on Android-sized viewports.");

    const reviewResponse = page.waitForResponse((response) => response.url().endsWith("/ai/images/pending-art/review") && response.request().method() === "POST");
    await page.locator("[data-image-review='approved'][data-asset-id='pending-art']").tap();
    assert.equal((await reviewResponse).ok(), true);
    await page.waitForFunction(() => document.querySelector("#forge-image-history")?.textContent.includes("approved"));
    let history = await (await fetch(`${base}/api/projects/${projectId}/ai/images`)).json();
    assert.equal(history.assets.find((asset) => asset.id === "pending-art").approvalStatus, "approved");
    assert.equal(history.rightsRecords.length, 0, "creative approval must not fabricate rights clearance");

    await page.locator("[data-image-source='pending-art']").tap();
    await page.locator("#forge-image-prompt").fill("Preserve the composition and character; change only the sky to sunrise.");
    await page.locator("#forge-image-generate").tap();
    await page.waitForFunction(() => /Explicit per-request consent is required/i.test(document.querySelector("#forge-image-status")?.textContent || ""));
    history = await (await fetch(`${base}/api/projects/${projectId}/ai/images`)).json();
    assert.equal(history.rightsRecords.length, 0, "blocked transmission must not invent a consent event");

    await page.locator("#forge-image-rights-basis").selectOption("author-owned");
    await page.locator("#forge-image-publication-cleared").check();
    await page.locator("#forge-image-source-reference").fill("Author original forest artwork");
    await page.locator("#forge-image-rights-terms").fill("Author controls this source for the intended book use.");
    await page.locator("#forge-image-processing-consent").check();
    const generationResponse = page.waitForResponse((response) => response.url().endsWith("/ai/image") && response.request().method() === "POST");
    await page.locator("#forge-image-generate").tap();
    const failed = await generationResponse;
    assert.equal(failed.ok(), false, "Image generation without configured credentials must fail honestly after consent is recorded.");
    await page.waitForFunction(() => /No real image provider is configured/i.test(document.querySelector("#forge-image-status")?.textContent || ""));
    await page.waitForFunction(() => /Rights: author-owned/i.test(document.querySelector("#forge-image-history")?.textContent || ""));
    history = await (await fetch(`${base}/api/projects/${projectId}/ai/images`)).json();
    assert.equal(history.assets.length, 1, "failed provider must not fabricate a derivative asset");
    const sourceRecords = history.rightsRecords.filter((record) => record.artifactId === "pending-art");
    assert.equal(sourceRecords.some((record) => record.eventType === "source-declaration" && record.publicationClearance === "author-declared-cleared"), true);
    assert.equal(sourceRecords.some((record) => record.eventType === "external-processing-consent" && record.provenance.consentStatus === "granted" && record.provider === "openai"), true);
    assert.equal(sourceRecords.some((record) => record.eventType === "generation"), false, "provider failure must not fabricate AI generation provenance");
    assert.match(await page.locator("#forge-image-history").innerText(), /explicit external-processing consent event/i);

    await page.locator("#open-command-center").tap();
    await page.locator("#fcc-mic").tap();
    await page.waitForFunction(() => document.querySelector("#fcc-command")?.value.includes("open writing"));
    assert.match(await page.locator("#fcc-command").inputValue(), /open writing/);

    await context.close();
    console.log("STUDIO IMAGE LAB BROWSER ACCEPTANCE PASSED: separate creative approval + rights declaration + explicit external-processing consent + durable failed-provider audit + Android fit + live voice transcript capture.");
  } finally {
    if (browser) await browser.close().catch(() => {});
    await stop(server).catch(() => {});
    await rm(dataDir, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });

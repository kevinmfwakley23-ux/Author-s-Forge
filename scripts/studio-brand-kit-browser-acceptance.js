#!/usr/bin/env node
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtemp, readFile, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { chromium } = require("@playwright/test");

const HOST = "127.0.0.1";
const PORT = 6380 + Math.floor(Math.random() * 140);
const PROJECT_ID = `brand-studio-${Date.now()}`;

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
  const dataDir = await mkdtemp(join(tmpdir(), "forge-brand-studio-"));
  const app = spawn(process.execPath, ["dist/studio-server.js"], {
    env: { ...process.env, HOST, PORT: String(PORT), FORGE_DATA_DIR: dataDir, OPENAI_API_KEY: "", OLLAMA_BASE_URL: "", KINGS_AI_ENDPOINT: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let browser;
  try {
    const base = `http://${HOST}:${PORT}`;
    await waitForHttp(`${base}/api/health`);
    await api(base, "/api/projects", "POST", { id: PROJECT_ID, title: "Shared Brand System Acceptance" });

    browser = await chromium.launch({ executablePath: process.env.FORGE_BROWSER_EXECUTABLE || chromium.executablePath(), headless: true, args: ["--no-sandbox", "--disable-gpu"] });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    page.on("dialog", (dialog) => dialog.accept());
    await page.goto(`${base}/?project=${PROJECT_ID}#dashboard`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelector('[data-route="brand"]') && document.querySelector("#brand-kit-form"));
    await page.locator('[data-route="brand"]').click();
    await page.waitForFunction(() => document.querySelector("#brand")?.getAttribute("aria-hidden") === "false" || !document.querySelector("#brand")?.hidden);

    await page.locator("#brand-name").fill("Heartwood Royal Identity");
    await page.locator("#brand-description").fill("Shared series identity for books, covers, promotion, journals, and specialized creative assets.");
    await page.locator("#brand-colors").fill("Royal Gold | #b58a3c | primary\nMarble White | #f4f1e8 | background\nInk Black | #151515 | text\nForest Green | #315b46 | secondary");
    await page.locator("#brand-fonts").fill("Display Serif | Georgia | display | 400,700\nBody Sans | Arial | body | 400,700");
    await page.locator("#brand-assets").fill("heartwood-tree-mark | primary-logo | Heartwood Tree mark");
    await page.locator("#brand-voice-traits").fill("warm\nhopeful\nlyrical");
    await page.locator("#brand-preferred").fill("In Heartwood Jungle…\nstrongest hearts help others too");
    await page.locator("#brand-avoided").fill("clinical narration\ncorporate jargon");
    await page.locator("#brand-locked").fill("brand\nlegal");
    await page.locator("#brand-guidelines").fill("Preserve the white-marble, black, and gold royal identity across promotion.\nKeep the Heartwood Tree mark intact and locked when used as a brand element.");

    const createResponsePromise = page.waitForResponse((response) => response.url().endsWith(`/api/projects/${PROJECT_ID}/brand-kits`) && response.request().method() === "POST");
    await page.locator("#brand-save").click();
    const createResponse = await createResponsePromise;
    assert.equal(createResponse.ok(), true);
    const kit = await createResponse.json();
    assert.equal(kit.name, "Heartwood Royal Identity");
    assert.equal(kit.colors.length, 4);
    assert.equal(kit.fonts.length, 2);
    assert.equal(kit.assets.length, 1);
    assert.equal(kit.restrictions.enforceColors, true);
    assert.equal(kit.restrictions.requireApprovedBrandAssets, true);
    await page.waitForFunction((id) => document.querySelector(`[data-brand-id="${id}"]`), kit.id);

    const setActiveResponsePromise = page.waitForResponse((response) => response.url().endsWith(`/api/projects/${PROJECT_ID}/brand-kits/active`) && response.request().method() === "POST");
    await page.locator("#brand-set-active").click();
    const setActiveResponse = await setActiveResponsePromise;
    assert.equal(setActiveResponse.ok(), true);
    const active = await setActiveResponse.json();
    assert.equal(active.activeBrandKitId, kit.id);
    assert.match(active.guidance, /ACTIVE PROJECT BRAND KIT: Heartwood Royal Identity/);
    assert.match(active.guidance, /Royal Gold/);
    assert.match(active.guidance, /Voice traits: warm; hopeful; lyrical/);
    await page.waitForFunction((id) => window.forgeActiveBrandKit?.id === id, kit.id);
    assert.match(await page.locator("#brand-studio-active").innerText(), /Active: Heartwood Royal Identity/);

    const project = await api(base, `/api/projects/${PROJECT_ID}`);
    const selection = project.memories.filter((memory) => memory.stateKey === "brand.active-kit").at(-1);
    assert.ok(selection, "Active Brand Kit must be recorded in durable Project Memory.");
    assert.equal(selection.class, "visual-identity");
    assert.equal(selection.authority, "authoritative");
    assert.equal(selection.stateValue, kit.id);
    assert.ok(selection.provenance.some((item) => item.kind === "author" && item.reference === "studio-brand-kit"));

    const sharedStore = JSON.parse(await readFile(join(dataDir, "brand-kits.json"), "utf8"));
    assert.ok(sharedStore.kits.some((item) => item.id === kit.id && item.forgeProjectId === PROJECT_ID), "Main Studio must persist into the same brand-kits.json source used by Specialized Creation.");

    await page.locator("#brand-guidelines").fill(`${await page.locator("#brand-guidelines").inputValue()}\nUse the same primary gold in approved flyer and cover proposals.`);
    const updateResponsePromise = page.waitForResponse((response) => response.url().endsWith(`/api/projects/${PROJECT_ID}/brand-kits/${kit.id}`) && response.request().method() === "PUT");
    await page.locator("#brand-save").click();
    const updateResponse = await updateResponsePromise;
    assert.equal(updateResponse.ok(), true);
    const updated = await updateResponse.json();
    assert.ok(updated.guidelines.some((item) => /same primary gold/i.test(item)));

    const activeAfterUpdate = await api(base, `/api/projects/${PROJECT_ID}/brand-kits/active`);
    assert.equal(activeAfterUpdate.activeBrandKitId, kit.id);
    assert.ok(activeAfterUpdate.brandKit.guidelines.some((item) => /same primary gold/i.test(item)), "Active brand selection must resolve the current shared Brand Kit definition rather than a stale copy.");

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction((id) => window.forgeActiveBrandKit?.id === id && document.querySelector('[data-route="brand"]'), kit.id);
    await page.locator('[data-route="brand"]').click();
    assert.match(await page.locator("#brand-studio-active").innerText(), /Heartwood Royal Identity/);
    assert.match(await page.locator("#brand-guidelines").inputValue(), /same primary gold/i);
    await context.close();

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const mobilePage = await mobile.newPage();
    await mobilePage.goto(`${base}/?project=${PROJECT_ID}#brand`, { waitUntil: "networkidle" });
    await mobilePage.waitForFunction(() => document.querySelector("#brand-kit-form"));
    const selectKit = mobilePage.locator(`[data-brand-id="${kit.id}"]`);
    const kitBox = await selectKit.boundingBox();
    assert.ok(kitBox && kitBox.height >= 40, "Brand Kit selection must remain touch-usable on Android-sized viewports.");
    const saveBox = await mobilePage.locator("#brand-save").boundingBox();
    assert.ok(saveBox && saveBox.height >= 40, "Brand Studio save action must remain touch-usable on Android-sized viewports.");
    const overflow = await mobilePage.evaluate(() => ({ viewport: document.documentElement.clientWidth, body: document.body.scrollWidth, doc: document.documentElement.scrollWidth }));
    assert.ok(overflow.body <= overflow.viewport + 1 && overflow.doc <= overflow.viewport + 1, `Brand Studio mobile shell overflows: ${JSON.stringify(overflow)}`);
    await mobile.close();

    console.log("PROJECT BRAND STUDIO BROWSER ACCEPTANCE PASSED: shared Brand Kit store + colors/fonts/assets/voice/guidelines + authoritative active Project Memory + live browser contract + update/restart persistence + Android fit/touch.");
  } finally {
    if (browser) await browser.close().catch(() => {});
    app.kill("SIGTERM");
    await new Promise((resolve) => app.exitCode !== null ? resolve() : app.once("exit", resolve));
    await rm(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
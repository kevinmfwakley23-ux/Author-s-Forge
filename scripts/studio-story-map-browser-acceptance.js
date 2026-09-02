#!/usr/bin/env node
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { chromium } = require("@playwright/test");

const HOST = "127.0.0.1";
const PORT = 7180 + Math.floor(Math.random() * 100);
const projectId = `story-map-browser-${Date.now()}`;

function characterProfile(name) {
  return {
    name, age: 30, birthDate: "1996-01-01", physicalAppearance: "Distinctive", height: "average", build: "average", hair: "brown", eyes: "brown", skin: "natural", clothing: "practical", voice: "clear", speechPatterns: ["plain"], personality: "determined", values: ["truth"], fears: ["failure"], secrets: ["none known"], goals: ["finish"], motivations: ["purpose"], relationships: [], history: "Established", knowledge: ["trade"], skills: ["craft"], weaknesses: ["stubborn"], characterArc: "Learns trust", importantObjects: ["notebook"], currentEmotionalState: "focused", currentLocation: "city", currentInjuries: ["none"],
  };
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
async function openStoryMap(page, base) {
  await page.goto(`${base}/?project=${projectId}`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-route="story-map"]');
  await page.locator('[data-route="story-map"]').click();
  await page.waitForFunction(() => location.hash === "#story-map" && document.querySelector("#story-map")?.hidden === false);
  await page.waitForFunction(() => document.querySelector("#story-map-summary")?.textContent.includes("2") && document.querySelectorAll("#story-map-books .story-map-scene-wrap").length === 2);
}

async function main() {
  const dataDir = await mkdtemp(join(tmpdir(), "forge-story-map-browser-"));
  const app = spawn(process.execPath, ["dist/studio-server.js"], { env: { ...process.env, HOST, PORT: String(PORT), FORGE_DATA_DIR: dataDir, OPENAI_API_KEY: "", OLLAMA_BASE_URL: "", KINGS_AI_ENDPOINT: "", OMNIROUTE_BASE_URL: "", ROUTER9_BASE_URL: "" }, stdio: ["ignore", "pipe", "pipe"] });
  let browser;
  try {
    const base = `http://${HOST}:${PORT}`;
    await waitForHttp(`${base}/api/health`);
    await request(base, "/api/projects", "POST", { id: projectId, title: "Story Map Browser Acceptance" });
    await request(base, `/api/projects/${projectId}/workspace/books`, "POST", { id: "book-1", title: "Mapped Novel", kind: "novel", description: "Visual planning acceptance." });
    await request(base, `/api/projects/${projectId}/workspace/books/book-1/chapters`, "POST", { id: "chapter-1", number: 1, title: "Opening", synopsis: "Mara arrives." });
    await request(base, `/api/projects/${projectId}/workspace/books/book-1/chapters/chapter-1/scenes`, "POST", { id: "scene-1", number: 1, title: "Arrival", synopsis: "Mara reaches the station." });
    await request(base, `/api/projects/${projectId}/workspace/books/book-1/chapters/chapter-1/scenes/scene-1/content`, "PUT", { content: "Mara stepped beneath the station clock and checked the folded letter." });
    await request(base, `/api/projects/${projectId}/workspace/books/book-1/chapters/chapter-1/scenes`, "POST", { id: "scene-2", number: 2, title: "Decision", synopsis: "Mara chooses whether to stay." });
    await request(base, `/api/projects/${projectId}/workspace/books/book-1/chapters/chapter-1/scenes/scene-2/content`, "PUT", { content: "She watched the train doors close and stayed on the platform." });
    await request(base, `/api/projects/${projectId}/characters`, "POST", { id: "mara", profile: characterProfile("Mara") });

    browser = await chromium.launch({ executablePath: process.env.FORGE_BROWSER_EXECUTABLE || chromium.executablePath(), headless: true, args: ["--no-sandbox", "--disable-gpu"] });
    const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await desktop.newPage();
    await openStoryMap(page, base);

    await page.locator("details.story-map-plotline-panel summary").click();
    await page.locator("#story-map-plotline-name").fill("Mara Learns Trust");
    await page.locator("#story-map-plotline-kind").selectOption("character-arc");
    await page.locator("#story-map-plotline-character").selectOption("mara");
    await page.locator("#story-map-plotline-description").fill("Track Mara from guarded independence to earned trust.");
    const plotlineResponse = page.waitForResponse((response) => response.url().endsWith("/story-map/plotlines") && response.request().method() === "POST");
    await page.locator("#story-map-plotline-form button[type=submit]").click();
    assert.equal((await plotlineResponse).status(), 201);
    await page.waitForFunction(() => document.querySelector("#story-map-plotline-list")?.textContent.includes("Mara Learns Trust"));

    await page.locator('[data-plan-scene="book-1|chapter-1|scene-1"]').click();
    await page.locator("#story-plan-location").fill("Union Station");
    await page.locator("#story-plan-time").fill("1895-11-03 21:15");
    await page.locator("#story-plan-goal").fill("Reach the platform unseen.");
    await page.locator("#story-plan-conflict").fill("The inspector blocks the gate.");
    await page.locator("#story-plan-outcome").fill("Mara loses the ticket.");
    await page.locator("#story-plan-emotion").fill("Confidence turns to dread.");
    await page.locator("#story-plan-tags").fill("arrival, clue, night");
    await page.locator('input[name="story-plan-pov"][value="mara"]').check();
    await page.locator('input[name="story-plan-plotline"]').first().check();
    const planResponse = page.waitForResponse((response) => response.url().includes("/story-map/scenes/book-1/chapter-1/scene-1/planning") && response.request().method() === "PUT");
    await page.locator("#story-map-scene-form button[type=submit]").click();
    assert.equal((await planResponse).status(), 200);
    await page.waitForFunction(() => document.querySelector('[data-scene-id="scene-1"]')?.textContent.includes("Union Station"));
    assert.match(await page.locator('[data-scene-id="scene-1"]').innerText(), /POV: Mara/);
    assert.match(await page.locator('[data-scene-id="scene-1"]').innerText(), /Mara Learns Trust/);

    const saved = await request(base, `/api/projects/${projectId}/story-map/planning`);
    assert.equal(saved.planning.sceneAttributes["scene-1"].location, "Union Station");
    assert.equal(saved.planning.plotlines.length, 1);
    assert.deepEqual(saved.planning.plotlines[0].sceneIds, ["scene-1"]);
    const project = await request(base, `/api/projects/${projectId}`);
    assert.equal(project.storyMapPlanning.sceneAttributes["scene-1"].goal, "Reach the platform unseen.");
    const workspace = await request(base, `/api/projects/${projectId}/workspace`);
    assert.deepEqual(workspace.books[0].chapters[0].scenes.map((scene) => scene.id), ["scene-1", "scene-2"], "Planning must not duplicate or reorder manuscript scenes.");
    assert.match(workspace.books[0].chapters[0].scenes[0].content, /station clock/, "Planning must not rewrite manuscript prose.");

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector('[data-route="story-map"]');
    await page.locator('[data-route="story-map"]').click();
    await page.waitForFunction(() => document.querySelector("#story-map")?.hidden === false && document.querySelector('[data-scene-id="scene-1"]')?.textContent.includes("Union Station"));
    await page.locator("#story-map-filter-plotline").selectOption({ label: /Mara Learns Trust/ });
    await page.waitForFunction(() => document.querySelector('[data-scene-id="scene-1"]')?.hidden === false && document.querySelector('[data-scene-id="scene-2"]')?.hidden === true);
    await page.locator("#story-map-clear-filters").click();
    await page.waitForFunction(() => document.querySelector('[data-scene-id="scene-2"]')?.hidden === false);
    await page.locator("#story-map-filter-pov").selectOption("mara");
    await page.waitForFunction(() => document.querySelector('[data-scene-id="scene-2"]')?.hidden === true);
    await page.locator("#story-map-clear-filters").click();
    await page.locator("#story-map-filter-location").selectOption("Union Station");
    await page.waitForFunction(() => document.querySelector('[data-scene-id="scene-1"]')?.hidden === false && document.querySelector('[data-scene-id="scene-2"]')?.hidden === true);

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const phone = await mobile.newPage();
    await openStoryMap(phone, base);
    const dims = await phone.evaluate(() => ({ viewport: document.documentElement.clientWidth, body: document.body.scrollWidth, doc: document.documentElement.scrollWidth }));
    assert.ok(dims.body <= dims.viewport + 1, `Story Map mobile body overflow: ${JSON.stringify(dims)}`);
    assert.ok(dims.doc <= dims.viewport + 1, `Story Map mobile document overflow: ${JSON.stringify(dims)}`);
    const planBox = await phone.locator('[data-plan-scene="book-1|chapter-1|scene-1"]').boundingBox();
    assert.ok(planBox && planBox.height >= 40, `Story Map Plan touch target too small: ${JSON.stringify(planBox)}`);
    await mobile.close();
    await desktop.close();

    console.log("STORY MAP PLANNING BROWSER ACCEPTANCE PASSED: visible Studio navigation + durable scene attributes + POV + plotlines/character arcs + cross-scene filters + no manuscript rewrite/reorder + reload + Android fit/touch.");
  } finally {
    if (browser) await browser.close().catch(() => {});
    app.kill("SIGTERM");
    await rm(dataDir, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });

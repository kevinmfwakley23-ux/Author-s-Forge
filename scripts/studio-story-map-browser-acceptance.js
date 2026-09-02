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
  await page.waitForSelector('[data-plan-chapter="book-1|chapter-1"]');
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

    await page.locator('[data-plan-chapter="book-1|chapter-1"]').click();
    await page.locator("#chapter-card-location").fill("Union Station");
    await page.locator("#chapter-card-time").fill("1895-11-03 21:00–23:00");
    await page.locator("#chapter-card-emotional").fill("Move Mara from confidence to controlled dread.");
    await page.locator("#chapter-card-plot").fill("Get Mara onto the platform while establishing the altered archive log.");
    await page.locator("#chapter-card-atmosphere").fill("Cold iron, coal smoke, institutional scrutiny.");
    await page.locator("#chapter-card-hook").fill("The missing key turns up in Mara's coat pocket.");
    await page.locator("#chapter-card-words").fill("2800");
    await page.locator("#chapter-card-events").fill("Mara reaches the station\nThe inspector confronts her");
    await page.locator("#chapter-card-clues").fill("The archive log has fresh ink");
    await page.locator("#chapter-card-reveals").fill("Someone expected Mara to arrive");
    await page.locator("#chapter-card-continuity").fill("Mara still carries the folded letter from Scene 1");
    await page.locator("#chapter-card-forbidden").fill("Do not identify who altered the log\nMara cannot know Elias is watching");
    await page.locator('input[name="chapter-card-pov"][value="mara"]').check();
    await page.locator('input[name="chapter-card-character"][value="mara"]').check();
    const cardResponse = page.waitForResponse((response) => response.url().includes("/story-map/chapters/book-1/chapter-1/card") && response.request().method() === "PUT");
    await page.locator("#chapter-card-form button[type=submit]").click();
    assert.equal((await cardResponse).status(), 200);
    await page.waitForFunction(() => document.querySelector('[data-plan-chapter="book-1|chapter-1"]')?.textContent.includes("Edit Chapter Card"));
    assert.match(await page.locator(".chapter-card-summary").innerText(), /2800 words/);

    const saved = await request(base, `/api/projects/${projectId}/story-map/planning`);
    assert.equal(saved.planning.sceneAttributes["scene-1"].location, "Union Station");
    assert.equal(saved.planning.plotlines.length, 1);
    assert.deepEqual(saved.planning.plotlines[0].sceneIds, ["scene-1"]);
    assert.equal(saved.planning.chapterCards["chapter-1"].plotObjective, "Get Mara onto the platform while establishing the altered archive log.");
    assert.equal(saved.planning.chapterCards["chapter-1"].approximateWordCount, 2800);
    assert.deepEqual(saved.planning.chapterCards["chapter-1"].forbiddenDeviations, ["Do not identify who altered the log", "Mara cannot know Elias is watching"]);
    const project = await request(base, `/api/projects/${projectId}`);
    assert.equal(project.storyMapPlanning.sceneAttributes["scene-1"].goal, "Reach the platform unseen.");
    assert.equal(project.storyMapPlanning.chapterCards["chapter-1"].endingHook, "The missing key turns up in Mara's coat pocket.");
    const workspace = await request(base, `/api/projects/${projectId}/workspace`);
    assert.equal(workspace.books[0].chapters[0].title, "Opening", "Chapter Card planning must not replace manuscript-owned chapter identity.");
    assert.deepEqual(workspace.books[0].chapters[0].scenes.map((scene) => scene.id), ["scene-1", "scene-2"], "Planning must not duplicate or reorder manuscript scenes.");
    assert.match(workspace.books[0].chapters[0].scenes[0].content, /station clock/, "Planning must not rewrite manuscript prose.");

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector('[data-route="story-map"]');
    await page.locator('[data-route="story-map"]').click();
    await page.waitForFunction(() => document.querySelector("#story-map")?.hidden === false && document.querySelector('[data-scene-id="scene-1"]')?.textContent.includes("Union Station"));
    await page.waitForFunction(() => document.querySelector('[data-plan-chapter="book-1|chapter-1"]')?.textContent.includes("Edit Chapter Card"));
    await page.locator('[data-plan-chapter="book-1|chapter-1"]').click();
    assert.equal(await page.locator("#chapter-card-plot").inputValue(), "Get Mara onto the platform while establishing the altered archive log.");
    assert.match(await page.locator("#chapter-card-forbidden").inputValue(), /Mara cannot know Elias is watching/);
    await page.locator("#chapter-card-close").click();

    const plotlineValue = await page.locator("#story-map-filter-plotline option").filter({ hasText: "Mara Learns Trust" }).getAttribute("value");
    assert.ok(plotlineValue, "Story Map plotline filter option must expose a durable plotline id.");
    await page.locator("#story-map-filter-plotline").selectOption(plotlineValue);
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
    const chapterBox = await phone.locator('[data-plan-chapter="book-1|chapter-1"]').boundingBox();
    assert.ok(chapterBox && chapterBox.height >= 44, `Chapter Card touch target too small: ${JSON.stringify(chapterBox)}`);
    await phone.locator('[data-plan-chapter="book-1|chapter-1"]').tap();
    await phone.waitForFunction(() => document.querySelector("#story-map-chapter-editor")?.hidden === false);
    const mobileEditorDims = await phone.evaluate(() => ({ viewport: document.documentElement.clientWidth, body: document.body.scrollWidth, doc: document.documentElement.scrollWidth }));
    assert.ok(mobileEditorDims.body <= mobileEditorDims.viewport + 1, `Chapter Card mobile body overflow: ${JSON.stringify(mobileEditorDims)}`);
    assert.ok(mobileEditorDims.doc <= mobileEditorDims.viewport + 1, `Chapter Card mobile document overflow: ${JSON.stringify(mobileEditorDims)}`);
    assert.equal(await phone.locator("#chapter-card-words").inputValue(), "2800");
    await mobile.close();
    await desktop.close();

    console.log("STORY MAP PLANNING BROWSER ACCEPTANCE PASSED: visible Studio navigation + durable scene attributes + first-class Chapter Cards + POV + plotlines/character arcs + forbidden deviations + cross-scene filters + no manuscript rewrite/reorder + reload + Android fit/touch.");
  } finally {
    if (browser) await browser.close().catch(() => {});
    app.kill("SIGTERM");
    await rm(dataDir, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });

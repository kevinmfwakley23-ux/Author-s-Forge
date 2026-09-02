#!/usr/bin/env node
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { createServer } = require("node:net");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { chromium } = require("@playwright/test");

const HOST = "127.0.0.1";
const projectId = `scene-card-browser-${Date.now()}`;

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
  const response = await fetch(base + path, {
    method,
    headers: { "content-type": "application/json" },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
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

async function openScenePlan(page, base) {
  await page.goto(`${base}/?project=${projectId}`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-route="story-map"]');
  await page.locator('[data-route="story-map"]').click();
  await page.waitForFunction(() => location.hash === "#story-map" && document.querySelector("#story-map")?.hidden === false);
  await page.waitForSelector('[data-plan-scene="book-1|chapter-1|scene-1"]');
  await page.locator('[data-plan-scene="book-1|chapter-1|scene-1"]').click();
  await page.waitForFunction(() => document.querySelector("#story-map-scene-editor")?.hidden === false);
  await page.locator("#scene-card-workflow").waitFor();
  await page.waitForFunction(() => document.querySelector("#scene-card-source")?.textContent.includes("Scene 1: Night Entrance"));
}

async function main() {
  const dataDir = await mkdtemp(join(tmpdir(), "forge-scene-card-browser-"));
  const port = await freePort();
  const app = spawn(process.execPath, ["dist/studio-server.js"], {
    env: {
      ...process.env,
      HOST,
      PORT: String(port),
      FORGE_DATA_DIR: dataDir,
      OPENAI_API_KEY: "",
      OLLAMA_BASE_URL: "",
      KINGS_AI_ENDPOINT: "",
      OMNIROUTE_BASE_URL: "",
      ROUTER9_BASE_URL: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  app.stderr.on("data", (chunk) => { stderr += String(chunk); });
  let browser;
  try {
    const base = `http://${HOST}:${port}`;
    try { await waitForHttp(`${base}/api/health`); }
    catch (error) { throw new Error(`${error.message}\nStudio stderr:\n${stderr}`); }

    await request(base, "/api/projects", "POST", { id: projectId, title: "Scene Card Browser Acceptance" });
    await request(base, `/api/projects/${projectId}/workspace/books`, "POST", { id: "book-1", title: "The Night Archive", kind: "novel", description: "Scene Card acceptance book." });
    await request(base, `/api/projects/${projectId}/workspace/books/book-1/chapters`, "POST", { id: "chapter-1", number: 1, title: "The Archive", synopsis: "Mara reaches the archive." });
    await request(base, `/api/projects/${projectId}/workspace/books/book-1/chapters/chapter-1/scenes`, "POST", { id: "scene-1", number: 1, title: "Night Entrance", synopsis: "Mara tries the service door." });

    browser = await chromium.launch({ executablePath: process.env.FORGE_BROWSER_EXECUTABLE || chromium.executablePath(), headless: true, args: ["--no-sandbox", "--disable-gpu"] });
    const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await desktop.newPage();
    await openScenePlan(page, base);

    await page.locator("#story-plan-location").fill("Municipal Archive");
    await page.locator("#story-plan-time").fill("11:40 PM");
    await page.locator("#story-plan-goal").fill("Enter without waking the night clerk.");
    await page.locator("#story-plan-conflict").fill("The service door is chained from inside.");
    await page.locator("#story-plan-outcome").fill("Mara slips into the records corridor.");
    await page.locator("#story-plan-emotion").fill("Confidence tightens into dread.");
    await page.locator("#story-plan-tags").fill("infiltration, clue");
    const planningResponse = page.waitForResponse((response) => response.url().includes("/story-map/scenes/book-1/chapter-1/scene-1/planning") && response.request().method() === "PUT");
    await page.locator("#story-map-scene-form button[type=submit]").click();
    assert.equal((await planningResponse).status(), 200);
    await page.waitForFunction(() => document.querySelector("#scene-card-source")?.textContent.includes("Enter without waking the night clerk."));

    await page.locator("#scene-card-purpose").fill("Move Mara into the restricted archive while planting the missing-key clue.");
    await page.locator("#scene-card-opening").fill("Mara is alone in the alley behind the archive.");
    await page.locator("#scene-card-closing").fill("She is inside and hears a lock turn deeper in the building.");
    await page.locator("#scene-card-events").fill("Mara tests the chained service door.\nShe notices a fresh scrape beneath the lock.");
    await page.locator("#scene-card-clues").fill("A brass key was recently removed.");
    await page.locator("#scene-card-continuity").fill("Mara lost her public entrance ticket earlier.");
    await page.locator("#scene-card-atmosphere").fill("Cold stone, damp alley, restrained menace.");
    await page.locator("#scene-card-word-count").fill("1800");
    await page.locator("#scene-card-forbidden").fill("Do not reveal who removed the key.");
    await page.locator("#scene-card-notes").fill("Keep the scene close and restrained.");
    const saveResponse = page.waitForResponse((response) => response.url().endsWith(`/api/projects/${projectId}/scene-cards/book-1/chapter-1/scene-1`) && response.request().method() === "PUT");
    await page.locator("#scene-card-form button[type=submit]").click();
    assert.equal((await saveResponse).status(), 200);
    await page.waitForFunction(() => document.querySelector("#scene-card-status")?.textContent.includes("Not approved"));

    let workspace = await request(base, `/api/projects/${projectId}/workspace`);
    assert.equal(workspace.books[0].chapters[0].scenes[0].content, "", "Saving a Scene Card must never create manuscript prose.");
    let cards = await request(base, `/api/projects/${projectId}/scene-cards`);
    assert.equal(cards.cards.length, 1);
    assert.equal(cards.cards[0].details.purpose, "Move Mara into the restricted archive while planting the missing-key clue.");
    assert.equal(cards.cards[0].details.approximateWordCount, 1800);
    assert.equal(cards.cards[0].approved, false);

    const approveResponse = page.waitForResponse((response) => response.url().endsWith(`/api/projects/${projectId}/scene-cards/book-1/chapter-1/scene-1/approve`) && response.request().method() === "POST");
    await page.locator("#scene-card-approve").click();
    assert.equal((await approveResponse).status(), 200);
    await page.waitForFunction(() => document.querySelector("#scene-card-status")?.textContent.includes("Approved"));
    assert.equal(await page.locator("#scene-card-draft").isEnabled(), true, "Approved empty scene should permit card-driven proposal drafting.");

    const brief = await request(base, `/api/projects/${projectId}/scene-cards/book-1/chapter-1/scene-1/draft-brief`, "POST", {});
    assert.equal(brief.task, "draft");
    assert.equal(brief.manuscriptChanged, false);
    assert.match(brief.cardSha256, /^[a-f0-9]{64}$/);
    assert.match(brief.instruction, /Move Mara into the restricted archive while planting the missing-key clue/);
    assert.match(brief.instruction, /Enter without waking the night clerk/);
    assert.match(brief.instruction, /Do not reveal who removed the key/);
    workspace = await request(base, `/api/projects/${projectId}/workspace`);
    assert.equal(workspace.books[0].chapters[0].scenes[0].content, "", "Draft brief generation must remain read-only.");

    await page.locator("#story-plan-goal").fill("Enter without waking the clerk or triggering the new alarm.");
    const changedPlanningResponse = page.waitForResponse((response) => response.url().includes("/story-map/scenes/book-1/chapter-1/scene-1/planning") && response.request().method() === "PUT");
    await page.locator("#story-map-scene-form button[type=submit]").click();
    assert.equal((await changedPlanningResponse).status(), 200);
    await page.waitForFunction(() => document.querySelector("#scene-card-status")?.textContent.includes("Approval stale"));
    assert.equal(await page.locator("#scene-card-draft").isEnabled(), false, "Changing live planning must invalidate the old card approval.");
    cards = await request(base, `/api/projects/${projectId}/scene-cards`);
    assert.equal(cards.cards[0].approved, false);
    assert.equal(cards.cards[0].approvalStale, true);

    const staleResponse = await fetch(`${base}/api/projects/${projectId}/scene-cards/book-1/chapter-1/scene-1/draft-brief`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    assert.equal(staleResponse.ok, false, "Stale Scene Card approval must fail closed at the server boundary.");
    assert.match(await staleResponse.text(), /not currently author-approved/);

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector('[data-route="story-map"]');
    await page.locator('[data-route="story-map"]').click();
    await page.waitForSelector('[data-plan-scene="book-1|chapter-1|scene-1"]');
    await page.locator('[data-plan-scene="book-1|chapter-1|scene-1"]').click();
    await page.locator("#scene-card-workflow").waitFor();
    await page.waitForFunction(() => document.querySelector("#scene-card-purpose")?.value.includes("Move Mara into the restricted archive"));
    assert.equal(await page.locator("#scene-card-word-count").inputValue(), "1800");
    assert.match(await page.locator("#scene-card-status").innerText(), /Approval stale/);
    await desktop.close();

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const phone = await mobile.newPage();
    await openScenePlan(phone, base);
    const dimensions = await phone.evaluate(() => ({ viewport: document.documentElement.clientWidth, body: document.body.scrollWidth, doc: document.documentElement.scrollWidth }));
    assert.ok(dimensions.body <= dimensions.viewport + 1, `Scene Card mobile body overflow: ${JSON.stringify(dimensions)}`);
    assert.ok(dimensions.doc <= dimensions.viewport + 1, `Scene Card mobile document overflow: ${JSON.stringify(dimensions)}`);
    for (const selector of ["#scene-card-form button[type=submit]", "#scene-card-approve", "#scene-card-revoke", "#scene-card-draft", "#scene-card-refresh"]) {
      const box = await phone.locator(selector).boundingBox();
      assert.ok(box && box.height >= 40, `Scene Card mobile touch target too small for ${selector}: ${JSON.stringify(box)}`);
    }
    assert.equal(await phone.locator("#scene-card-purpose").inputValue(), "Move Mara into the restricted archive while planting the missing-key clue.");
    assert.match(await phone.locator("#scene-card-status").innerText(), /Approval stale/);
    await mobile.close();

    console.log("SCENE CARD BROWSER ACCEPTANCE PASSED: live-scene binding + durable card details + explicit author approval + stale-plan invalidation + read-only draft brief + reload + Android fit/touch.");
  } finally {
    if (browser) await browser.close().catch(() => {});
    await stopChild(app);
    await rm(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });

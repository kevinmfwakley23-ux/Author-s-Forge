#!/usr/bin/env node

/**
 * Mobile/browser acceptance for Author's Forge.
 *
 * This verifies the real Studio at a phone-sized viewport rather than relying
 * on CSS/source assertions. It focuses on touch-sized interaction, navigation,
 * absence of horizontal overflow, durable state, Author Goals, Craft Lens,
 * and the live PWA lifecycle without treating cached API data as durable state.
 */
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { chromium } = require("@playwright/test");

const HOST = "127.0.0.1";
const APP_PORT = 5000 + Math.floor(Math.random() * 200);
const projectId = `mobile-acceptance-${Date.now()}`;
const CRAFT_FIXTURE = "The door was opened by Marcus while he walked slowly into the room and looked around at the walls that had been painted years before, wondering whether the old photographs still remained where Lena had left them because nobody had touched them since the house was abandoned. Marcus looked at the clock. Lena waited.";

async function waitForHttp(url, timeoutMs = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function waitForRoute(page, route) {
  await page.waitForFunction((expected) => location.hash === `#${expected}` && document.querySelector(`#${expected}`)?.hidden === false, route);
}

async function tapAndRequireApi(page, locator, predicate, description) {
  const responsePromise = page.waitForResponse((response) => predicate(response));
  await locator.tap();
  const response = await responsePromise;
  const responseBody = await response.text();
  assert.equal(response.ok(), true, `${description} failed (${response.status()}): ${responseBody}`);
  return responseBody;
}

async function main() {
  const dataDir = await mkdtemp(join(tmpdir(), "authors-forge-mobile-"));
  const server = spawn(process.execPath, ["dist/studio-server.js"], {
    env: {
      ...process.env,
      PORT: String(APP_PORT), HOST, FORGE_DATA_DIR: dataDir,
      OPENAI_API_KEY: "", OPENAI_MODEL: "", OLLAMA_BASE_URL: "", OLLAMA_MODEL: "",
      KINGS_AI_ENDPOINT: "", KINGS_AI_MODEL: "", OMNIROUTE_BASE_URL: "", OMNIROUTE_MODEL: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let browser;
  try {
    const baseUrl = `http://${HOST}:${APP_PORT}`;
    await waitForHttp(`${baseUrl}/api/health`);
    const created = await fetch(`${baseUrl}/api/projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: projectId, title: "Mobile Acceptance", kind: "novel" }) });
    assert.equal(created.ok, true, await created.text());

    const manifestResponse = await fetch(`${baseUrl}/manifest.webmanifest`);
    assert.equal(manifestResponse.ok, true, "PWA manifest must be served by the live Studio");
    const manifest = await manifestResponse.json();
    assert.equal(manifest.display, "standalone", "PWA must use standalone display mode");
    assert.ok(typeof manifest.start_url === "string" && manifest.start_url.length > 0, "PWA must define a start_url");
    assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2, "PWA must expose multiple install icons");
    assert.ok(manifest.icons.some((icon) => icon.sizes === "192x192"), "PWA must expose a 192x192 icon");
    assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512"), "PWA must expose a 512x512 icon");

    browser = await chromium.launch({ executablePath: process.env.FORGE_BROWSER_EXECUTABLE || chromium.executablePath(), headless: true, args: ["--no-sandbox", "--disable-gpu"] });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/150 Mobile Safari/537.36" });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/?project=${encodeURIComponent(projectId)}`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.readyState === "complete" && document.querySelector("#project-title")?.textContent !== "Loading…");

    await page.waitForFunction(() => navigator.serviceWorker?.controller || navigator.serviceWorker?.ready);
    const pwaRuntime = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      const cacheNames = "caches" in window ? await caches.keys() : [];
      const cachedApiUrls = [];
      for (const name of cacheNames) {
        const cache = await caches.open(name);
        const requests = await cache.keys();
        cachedApiUrls.push(...requests.map((request) => new URL(request.url).pathname).filter((pathname) => pathname.startsWith("/api/")));
      }
      return { serviceWorkerRegistered: Boolean(registration), controlled: Boolean(navigator.serviceWorker.controller), cacheNames, cachedApiUrls };
    });
    assert.equal(pwaRuntime.serviceWorkerRegistered, true, "PWA service worker must register in the live Studio");
    assert.equal(pwaRuntime.controlled, true, "PWA service worker must control the Studio after startup");
    assert.deepEqual(pwaRuntime.cachedApiUrls, [], "PWA shell cache must never contain project API data");

    const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, bodyScrollWidth: document.body.scrollWidth, documentScrollWidth: document.documentElement.scrollWidth }));
    assert.ok(dimensions.bodyScrollWidth <= dimensions.viewport + 1, `horizontal overflow: ${JSON.stringify(dimensions)}`);
    assert.ok(dimensions.documentScrollWidth <= dimensions.viewport + 1, `document overflow: ${JSON.stringify(dimensions)}`);

    const routes = await page.locator("nav a[data-route]").evaluateAll((elements) => elements.map((el) => el.dataset.route));
    assert.ok(routes.length >= 18, `expected the complete Studio navigation, got ${routes.length}`);
    const nav = page.locator('nav a[data-route="manuscript"]');
    const navBox = await nav.boundingBox();
    assert.ok(navBox && navBox.height >= 40, `navigation target is too small for touch: ${JSON.stringify(navBox)}`);
    await nav.tap();
    await waitForRoute(page, "manuscript");

    await page.locator("#book-form [name=title]").fill("Mobile Book");
    await page.locator("#book-form [name=description]").fill("Created through a phone-sized Studio viewport.");
    await page.locator("#book-form").evaluate((form) => form.requestSubmit());
    await page.waitForFunction(() => document.querySelector("#book-tree")?.textContent.includes("Mobile Book"));
    await page.locator("#chapter-form [name=number]").fill("1");
    await page.locator("#chapter-form [name=title]").fill("Mobile Opening");
    await page.locator("#chapter-form [name=synopsis]").fill("Phone acceptance chapter.");
    await page.locator("#chapter-form").evaluate((form) => form.requestSubmit());
    await page.waitForFunction(() => document.querySelector("#scene-chapter option"));
    await page.locator("#scene-form [name=number]").fill("1");
    await page.locator("#scene-form [name=title]").fill("Mobile Scene");
    await page.locator("#scene-form [name=synopsis]").fill("Phone acceptance scene.");
    await page.locator("#scene-form").evaluate((form) => form.requestSubmit());
    await page.waitForFunction(() => document.querySelector("#editor-scene option"));

    await page.locator('nav a[data-route="writing"]').tap();
    await waitForRoute(page, "writing");
    await page.locator("#editor-content").fill("Mobile authoring saves durable words");
    const saveButton = page.locator("#save-scene");
    const saveBox = await saveButton.boundingBox();
    assert.ok(saveBox && saveBox.height >= 40, `save target is too small for touch: ${JSON.stringify(saveBox)}`);
    await tapAndRequireApi(page, saveButton, (response) => response.request().method() === "PUT" && response.url().includes(`/api/projects/${projectId}/workspace/`) && response.url().endsWith("/content"), "mobile scene save");
    await page.waitForFunction(() => document.querySelector("#success-banner")?.textContent.includes("Scene saved.") || document.querySelector("#error-banner")?.textContent.trim());
    const saveFeedback = await page.evaluate(() => ({ success: document.querySelector("#success-banner")?.textContent || "", error: document.querySelector("#error-banner")?.textContent || "" }));
    assert.equal(saveFeedback.error.trim(), "", `mobile scene save reported UI error: ${saveFeedback.error}`);
    assert.match(saveFeedback.success, /Scene saved\./, "mobile scene save must provide affirmative UI feedback");

    await page.locator('nav a[data-route="dashboard"]').tap();
    await waitForRoute(page, "dashboard");
    await page.waitForSelector("#author-goals-card");
    const goalForm = page.locator("#author-goal-form");
    await goalForm.locator('[name="label"]').fill("Mobile ten-word target");
    await goalForm.locator('[name="metric"]').selectOption("words");
    await goalForm.locator('[name="target"]').fill("10");
    await goalForm.locator('[name="period"]').selectOption("project");
    const goalSave = goalForm.locator('button[type="submit"]');
    const goalSaveBox = await goalSave.boundingBox();
    assert.ok(goalSaveBox && goalSaveBox.height >= 40, `Author Goal save target is too small for touch: ${JSON.stringify(goalSaveBox)}`);
    await tapAndRequireApi(page, goalSave, (response) => response.request().method() === "POST" && new URL(response.url()).pathname === `/api/projects/${projectId}/goals`, "mobile Author Goal create");
    await page.waitForFunction(() => document.querySelector("#author-goals-list")?.textContent.includes("Mobile ten-word target") && document.querySelector("#author-goals-list")?.textContent.includes("5 / 10"));

    await page.locator('nav a[data-route="writing"]').tap();
    await waitForRoute(page, "writing");
    await page.locator("#editor-content").fill("Mobile authoring saves durable words across every tested Android device");
    await tapAndRequireApi(page, page.locator("#save-scene"), (response) => response.request().method() === "PUT" && response.url().includes(`/api/projects/${projectId}/workspace/`) && response.url().endsWith("/content"), "mobile scene save for goal completion");
    await page.locator('nav a[data-route="dashboard"]').tap();
    await waitForRoute(page, "dashboard");
    await page.waitForFunction(() => document.querySelector("#author-goals-list")?.textContent.includes("10 / 10") && document.querySelector("#author-goals-list")?.textContent.includes("complete"));

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelector("#project-title")?.textContent !== "Loading…");
    await page.locator('nav a[data-route="writing"]').tap();
    await waitForRoute(page, "writing");
    await page.waitForFunction(() => document.querySelector("#editor-content")?.value === "Mobile authoring saves durable words across every tested Android device");
    await page.locator('nav a[data-route="dashboard"]').tap();
    await waitForRoute(page, "dashboard");
    await page.waitForFunction(() => document.querySelector("#author-goals-list")?.textContent.includes("Mobile ten-word target") && document.querySelector("#author-goals-list")?.textContent.includes("10 / 10"));
    const deleteGoal = page.locator("[data-delete-goal]");
    const deleteGoalBox = await deleteGoal.boundingBox();
    assert.ok(deleteGoalBox && deleteGoalBox.height >= 40, `Author Goal remove target is too small for touch: ${JSON.stringify(deleteGoalBox)}`);
    await tapAndRequireApi(page, deleteGoal, (response) => response.request().method() === "DELETE" && new URL(response.url()).pathname.startsWith(`/api/projects/${projectId}/goals/`), "mobile Author Goal removal");
    await page.waitForFunction(() => !document.querySelector("#author-goals-list")?.textContent.includes("Mobile ten-word target"));

    // Android acceptance for the rendered Craft Lens: touch analysis, evidence,
    // touch-sized strategy, truthful provider failure, and no manuscript mutation.
    await page.locator('nav a[data-route="writing"]').tap();
    await waitForRoute(page, "writing");
    await page.locator("#editor-content").fill(CRAFT_FIXTURE);
    await tapAndRequireApi(page, page.locator("#save-scene"), (response) => response.request().method() === "PUT" && response.url().endsWith("/content"), "mobile Craft Lens fixture save");
    await page.locator('nav a[data-route="editing"]').tap();
    await waitForRoute(page, "editing");
    await page.waitForSelector("#craft-lens-run");
    const lensButton = page.locator("#craft-lens-run");
    const lensButtonBox = await lensButton.boundingBox();
    assert.ok(lensButtonBox && lensButtonBox.height >= 40, `Craft Lens run target is too small for touch: ${JSON.stringify(lensButtonBox)}`);
    await lensButton.tap();
    await page.waitForFunction(() => document.querySelector('[data-craft-finding="clarity-long-sentences"]') && document.querySelector("#craft-lens-summary")?.textContent.includes("Analysis did not modify the manuscript."));
    const strategy = page.locator('[data-craft-finding="clarity-long-sentences"] [data-craft-strategy]').first();
    const strategyBox = await strategy.boundingBox();
    assert.ok(strategyBox && strategyBox.height >= 40, `Craft Lens strategy target is too small for touch: ${JSON.stringify(strategyBox)}`);
    const afterAnalysis = await (await fetch(`${baseUrl}/api/projects/${projectId}/workspace`)).json();
    assert.equal(afterAnalysis.books[0].chapters[0].scenes[0].content, CRAFT_FIXTURE, "mobile Craft Lens analysis must be read-only");
    const proposalResponsePromise = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === `/api/projects/${projectId}/ai/editing/propose`);
    await strategy.tap();
    const proposalResponse = await proposalResponsePromise;
    assert.equal(proposalResponse.ok(), false, "Craft Lens proposal must not fake success without a configured provider");
    const failedProposalBody = await proposalResponse.text();
    assert.match(failedProposalBody, /provider|configured|OPENAI|OLLAMA|model/i, "Craft Lens must return a truthful provider configuration error");
    await page.waitForFunction(() => (document.querySelector("#error-banner")?.textContent || "").length > 0);
    const afterFailedProposal = await (await fetch(`${baseUrl}/api/projects/${projectId}/workspace`)).json();
    assert.equal(afterFailedProposal.books[0].chapters[0].scenes[0].content, CRAFT_FIXTURE, "failed mobile Craft Lens proposal must not mutate manuscript state");

    const finalDimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, bodyScrollWidth: document.body.scrollWidth, documentScrollWidth: document.documentElement.scrollWidth }));
    assert.ok(finalDimensions.bodyScrollWidth <= finalDimensions.viewport + 1, `post-Craft-Lens horizontal overflow: ${JSON.stringify(finalDimensions)}`);
    assert.ok(finalDimensions.documentScrollWidth <= finalDimensions.viewport + 1, `post-Craft-Lens document overflow: ${JSON.stringify(finalDimensions)}`);

    console.log(`MOBILE BROWSER ACCEPTANCE PASSED: ${routes.length} routes + touch navigation + live PWA + API-cache boundary + durable manuscript saves + Author Goals create/progress/reload/remove + Craft Lens read-only touch analysis/action + overflow guard.`);
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill("SIGTERM");
    await new Promise((resolve) => server.exitCode !== null ? resolve() : server.once("exit", resolve));
    await rm(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });

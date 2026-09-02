#!/usr/bin/env node
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { createServer } = require("node:net");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { chromium } = require("@playwright/test");

const HOST = "127.0.0.1";
const projectId = `series-browser-${Date.now()}`;

function characterProfile(name) {
  return {
    name, age: 8, birthDate: "2018-01-01", physicalAppearance: "Distinctive", height: "small", build: "young", hair: "golden", eyes: "amber", skin: "fur", clothing: "none", voice: "gentle", speechPatterns: ["warm"], personality: "kind", values: ["friendship"], fears: ["isolation"], secrets: ["none"], goals: ["belong"], motivations: ["community"], relationships: [], history: "Established in the first book", knowledge: ["jungle trails"], skills: ["listening"], weaknesses: ["worry"], characterArc: "Learns courage", importantObjects: ["leaf token"], currentEmotionalState: "hopeful", currentLocation: "Heartwood Jungle", currentInjuries: ["none"],
  };
}

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

async function openSeriesFromStudio(page, base) {
  await page.goto(`${base}/?project=${projectId}`, { waitUntil: "networkidle" });
  const link = page.locator("#open-series-engine");
  await link.waitFor();
  const href = await link.getAttribute("href");
  assert.ok(href && href.includes("/series.html") && href.includes(encodeURIComponent(projectId)), `Main Studio Series link must preserve current project: ${href}`);
  await Promise.all([
    page.waitForURL((url) => url.pathname === "/series.html" && url.searchParams.get("project") === projectId),
    link.click(),
  ]);
  await page.waitForFunction(() => document.querySelector("#series-project-meta")?.textContent.includes("2 project books"));
}

async function main() {
  const dataDir = await mkdtemp(join(tmpdir(), "forge-series-browser-"));
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

    await request(base, "/api/projects", "POST", { id: projectId, title: "Series Browser Acceptance" });
    await request(base, `/api/projects/${projectId}/workspace/books`, "POST", { id: "book-1", title: "Heartwood One", kind: "childrens-book", description: "First series book." });
    await request(base, `/api/projects/${projectId}/workspace/books`, "POST", { id: "book-2", title: "Heartwood Two", kind: "childrens-book", description: "Second series book." });
    await request(base, `/api/projects/${projectId}/characters`, "POST", { id: "luke", profile: characterProfile("Luke") });

    browser = await chromium.launch({ executablePath: process.env.FORGE_BROWSER_EXECUTABLE || chromium.executablePath(), headless: true, args: ["--no-sandbox", "--disable-gpu"] });
    const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await desktop.newPage();
    await openSeriesFromStudio(page, base);

    await page.locator('#series-create-form input[name="name"]').fill("Heartwood Jungle");
    await page.locator("#series-create-book").selectOption("book-1");
    const createResponse = page.waitForResponse((response) => response.url().endsWith(`/api/projects/${projectId}/series`) && response.request().method() === "POST");
    await page.locator('#series-create-form button[type="submit"]').click();
    assert.equal((await createResponse).status(), 201);
    await page.waitForFunction(() => document.querySelector("#series-summary")?.textContent.includes("Heartwood Jungle"));

    await page.locator("#series-characters").selectOption(["luke"]);
    await page.locator("#series-world-rules").fill("The Heartwood Tree remains the geographic center.\nKindness never erases consequences.");
    await page.locator("#series-locations").fill("Heartwood Jungle\nHeartwood Tree");
    await page.locator("#series-terminology").fill("Heartwood Tree\nheart-knot");
    await page.locator("#series-history").fill("The old trails predate every current character.");
    await page.locator("#series-threads").fill("Who first marked the heart-knot?");
    const updateResponse = page.waitForResponse((response) => response.url().includes(`/api/projects/${projectId}/series/`) && response.request().method() === "PUT");
    await page.locator("#series-save-details").click();
    assert.equal((await updateResponse).status(), 200);
    await page.waitForFunction(() => document.querySelector("#series-success")?.textContent.includes("canon saved"));

    await page.locator("#series-add-book").selectOption("book-2");
    await page.locator("#series-add-book-button").click();
    await page.waitForFunction(() => document.querySelector("#series-book-list")?.textContent.includes("Heartwood Two"));
    await page.locator('[data-series-book-up="book-2"]').click();
    await page.waitForFunction(() => document.querySelector("#series-book-list article strong")?.textContent.includes("Heartwood Two"));

    await page.locator("#series-timeline-book").selectOption("book-2");
    await page.locator('#series-timeline-form input[name="date"]').fill("Book 2 / winter");
    await page.locator('#series-timeline-form textarea[name="description"]').fill("Luke returns to the Heartwood Tree and discovers the old mark.");
    const timelineResponse = page.waitForResponse((response) => response.url().endsWith("/timeline") && response.request().method() === "POST");
    await page.locator("#series-add-event").click();
    assert.equal((await timelineResponse).status(), 201);
    await page.waitForFunction(() => document.querySelector("#series-timeline-list")?.textContent.includes("discovers the old mark"));

    await page.locator('[data-series-book-remove="book-2"]').click();
    await page.waitForFunction(() => document.querySelector("#series-error")?.textContent.includes("still has series timeline events"));
    assert.match(await page.locator("#series-book-list").innerText(), /Heartwood Two/, "Failed destructive removal must leave series membership intact.");

    const durableBeforeReload = await request(base, `/api/projects/${projectId}`);
    assert.equal(durableBeforeReload.series.length, 1);
    assert.equal(durableBeforeReload.series[0].name, "Heartwood Jungle");
    assert.deepEqual(durableBeforeReload.series[0].bookIds, ["book-2", "book-1"]);
    assert.deepEqual(durableBeforeReload.series[0].sharedCharacters, ["luke"]);
    assert.deepEqual(durableBeforeReload.series[0].worldRules, ["The Heartwood Tree remains the geographic center.", "Kindness never erases consequences."]);
    assert.equal(durableBeforeReload.series[0].timeline.length, 1);

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelector("#series-world-rules")?.value.includes("Kindness never erases consequences"));
    assert.equal(await page.locator("#series-threads").inputValue(), "Who first marked the heart-knot?");
    assert.match(await page.locator("#series-book-list").innerText(), /1\. Heartwood Two/);

    await page.locator("[data-series-event-remove]").click();
    await page.waitForFunction(() => document.querySelector("#series-timeline-list")?.textContent.includes("No timeline events"));
    await page.locator('[data-series-book-remove="book-2"]').click();
    await page.waitForFunction(() => !document.querySelector("#series-book-list")?.textContent.includes("Heartwood Two"));
    let workspace = await request(base, `/api/projects/${projectId}/workspace`);
    assert.deepEqual(workspace.books.map((book) => book.id), ["book-1", "book-2"], "Removing series membership must not delete manuscript books.");

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const phone = await mobile.newPage();
    await phone.goto(`${base}/?project=${projectId}`, { waitUntil: "networkidle" });
    const mobileSeriesLink = phone.locator("#open-series-engine");
    await mobileSeriesLink.waitFor();
    const mainLinkBox = await mobileSeriesLink.boundingBox();
    assert.ok(mainLinkBox && mainLinkBox.height >= 40, `Main Studio Series touch target too small: ${JSON.stringify(mainLinkBox)}`);
    await Promise.all([
      phone.waitForURL((url) => url.pathname === "/series.html" && url.searchParams.get("project") === projectId),
      mobileSeriesLink.click(),
    ]);
    await phone.waitForFunction(() => document.querySelector("#series-project-meta")?.textContent.includes("2 project books"));
    const dimensions = await phone.evaluate(() => ({ viewport: document.documentElement.clientWidth, body: document.body.scrollWidth, doc: document.documentElement.scrollWidth }));
    assert.ok(dimensions.body <= dimensions.viewport + 1, `Series mobile body overflow: ${JSON.stringify(dimensions)}`);
    assert.ok(dimensions.doc <= dimensions.viewport + 1, `Series mobile document overflow: ${JSON.stringify(dimensions)}`);
    const saveBox = await phone.locator("#series-save-details").boundingBox();
    assert.ok(saveBox && saveBox.height >= 40, `Series save touch target too small: ${JSON.stringify(saveBox)}`);
    await mobile.close();

    page.once("dialog", (dialog) => dialog.accept());
    await page.locator("#series-delete").click();
    await page.waitForFunction(() => document.querySelector("#series-summary")?.textContent.includes("Create a series to begin"));
    const projectAfterDelete = await request(base, `/api/projects/${projectId}`);
    assert.deepEqual(projectAfterDelete.series, [], "Explicit Series deletion must remove only the Series record.");
    workspace = await request(base, `/api/projects/${projectId}/workspace`);
    assert.deepEqual(workspace.books.map((book) => book.id), ["book-1", "book-2"], "Deleting a Series must preserve manuscript books.");
    await desktop.close();

    console.log("SERIES ENGINE BROWSER ACCEPTANCE PASSED: Main Studio discoverability + durable create/edit + shared character/canon + book membership/order + cross-book timeline + destructive-removal guard + reload + explicit Series delete + manuscript preservation + Android fit/touch.");
  } finally {
    if (browser) await browser.close().catch(() => {});
    await stopChild(app);
    await rm(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });

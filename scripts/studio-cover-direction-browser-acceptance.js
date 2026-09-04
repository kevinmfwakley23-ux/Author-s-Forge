#!/usr/bin/env node
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { chromium } = require("@playwright/test");

const HOST = "127.0.0.1";
const PORT = 5960 + Math.floor(Math.random() * 120);
const PROJECT_ID = "cover-direction-browser";
const BOOK_ID = "cover-book";

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
  const dataDir = await mkdtemp(join(tmpdir(), "forge-cover-direction-"));
  const server = spawn(process.execPath, ["dist/studio-server.js"], {
    env: {
      ...process.env,
      HOST,
      PORT: String(PORT),
      FORGE_DATA_DIR: dataDir,
      OPENAI_API_KEY: "",
      OPENAI_MODEL: "",
      OLLAMA_BASE_URL: "",
      OLLAMA_MODEL: "",
      KINGS_AI_ENDPOINT: "",
      OMNIROUTE_BASE_URL: "",
      ROUTER9_BASE_URL: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let browser;
  try {
    const base = `http://${HOST}:${PORT}`;
    await waitForHttp(`${base}/api/health`);
    await api(base, "/api/projects", "POST", { id: PROJECT_ID, title: "Cover Direction Browser Acceptance" });
    await api(base, `/api/projects/${PROJECT_ID}/workspace/books`, "POST", {
      id: BOOK_ID,
      title: "The Honest Cover",
      kind: "novel",
      description: "A browser acceptance fixture for author-controlled cover direction.",
    });

    browser = await chromium.launch({ executablePath: process.env.FORGE_BROWSER_EXECUTABLE || chromium.executablePath(), headless: true, args: ["--no-sandbox", "--disable-gpu"] });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();

    let proposalRequests = 0;
    let proposalPayload;
    await page.route(`**/api/projects/${PROJECT_ID}/agent/cover-direction`, async (route) => {
      proposalRequests += 1;
      proposalPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          projectId: PROJECT_ID,
          bookId: BOOK_ID,
          candidate: {
            frontPrompt: "A solitary brass key suspended above a dark marble desk, photographed with restrained cinematic light.",
            backText: "A precise back-cover draft grounded in the book's approved premise.",
            spineText: "THE HONEST COVER — FORGE AUTHOR",
            typography: "High-contrast serif title with restrained small caps.",
            composition: "Centered key, generous negative space, title above the focal object.",
            mood: "Elegant, tense, deliberate.",
            palette: ["black marble", "warm gold", "ivory"],
            avoid: ["fake awards", "retailer badges", "busy collage"],
          },
          provider: "acceptance-test-provider",
          model: "acceptance-test-model",
          authorApprovalRequired: true,
          persisted: false,
          productionGeometryRequired: true,
        }),
      });
    });

    let coverPlanRequests = 0;
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().includes(`/api/projects/${PROJECT_ID}/cover/plan`)) coverPlanRequests += 1;
    });

    await page.goto(`${base}/?project=${PROJECT_ID}#cover`, { waitUntil: "networkidle" });
    await page.waitForSelector("#cover-agent-panel");
    assert.equal(await page.locator("#cover-agent-apply").isDisabled(), true);

    // Several real Studio extensions emit this shared refresh event without CustomEvent.detail.
    // Prove the Workbench rehydrates from durable workspace state instead of losing the active book.
    await page.evaluate(() => {
      window.forgeWorkspaceState = undefined;
      window.dispatchEvent(new Event("forge:workspace-ready"));
    });
    await page.waitForFunction((bookId) => window.forgeWorkspaceState?.books?.some((book) => book.id === bookId), BOOK_ID);

    const brief = "Create an elegant literary-thriller cover using the book's real premise. No awards, reviews, rankings, or sales claims.";
    await page.locator("#cover-agent-brief").fill(brief);
    await page.locator("#cover-agent-propose").click();
    await page.waitForFunction(() => document.querySelector("#cover-agent-result")?.textContent.includes("Reviewable candidate"));

    assert.equal(proposalRequests, 1, "one deliberate proposal click must make one cover-direction request");
    assert.equal(proposalPayload.bookId, BOOK_ID);
    assert.equal(proposalPayload.brief, brief);
    assert.match(await page.locator("#cover-agent-result").innerText(), /author approval required/i);
    assert.match(await page.locator("#cover-agent-result").innerText(), /production geometry/i);
    assert.equal(await page.locator("#cover-agent-apply").isEnabled(), true);

    await page.locator("#cover-agent-apply").click();
    assert.match(await page.locator("#cover-front").inputValue(), /solitary brass key/i);
    assert.match(await page.locator("#cover-front").inputValue(), /Typography:/);
    assert.match(await page.locator("#cover-front").inputValue(), /Avoid: fake awards, retailer badges, busy collage/);
    assert.equal(await page.locator("#cover-back").inputValue(), "A precise back-cover draft grounded in the book's approved premise.");
    assert.equal(await page.locator("#cover-title").inputValue(), "The Honest Cover");
    await page.locator("#cover-author").fill("Forge Author");

    await page.locator("#cover-run").click();
    await page.waitForFunction(() => document.querySelector("#success-banner")?.textContent.includes("KDP cover plan calculated and stored"));
    assert.equal(coverPlanRequests, 1, "Create cover plan must have exactly one browser owner and one server request");

    const project = await api(base, `/api/projects/${PROJECT_ID}`);
    assert.equal(project.bookCoverPlans.length, 1, "one click must persist exactly one cover plan");
    const productionMemories = project.memories.filter((memory) => memory.class === "production-memory" && memory.relevanceTags?.includes("cover"));
    assert.equal(productionMemories.length, 1, "one click must persist exactly one cover production-memory record");
    assert.match(project.bookCoverPlans[0].frontPrompt, /Typography:/);
    assert.equal(project.bookCoverPlans[0].approvalStatus, "draft");

    console.log("COVER DIRECTION BROWSER ACCEPTANCE PASSED: workspace refresh recovery + reviewable AI candidate + explicit apply + one authoritative cover-plan request + one durable plan.");
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill("SIGTERM");
    await new Promise((resolve) => server.exitCode !== null ? resolve() : server.once("exit", resolve));
    await rm(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });

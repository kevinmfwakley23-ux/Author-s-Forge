import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { chromium } from "playwright";

const port = Number(process.env.FORGE_ACCEPTANCE_PORT ?? 4187);
const dataDir = await mkdtemp(join(tmpdir(), "authors-forge-browser-"));
const baseUrl = `http://127.0.0.1:${port}`;
const projectId = "browser-acceptance";
const child = spawn(process.execPath, ["dist/studio-server.js"], { env: { ...process.env, PORT: String(port), HOST: "127.0.0.1", FORGE_DATA_DIR: dataDir, OPENAI_API_KEY: "", OPENAI_MODEL: "" }, stdio: ["ignore", "pipe", "pipe"] });

async function waitForServer() {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try { const response = await fetch(`${baseUrl}/api/health`); if (response.ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Studio server did not become ready.");
}

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${baseUrl}/?project=${projectId}`);
  await page.waitForLoadState("networkidle");
  assert.match(await page.title(), /Author's Forge/);

  await page.locator("#project-form [name=id]").fill(projectId);
  await page.locator("#project-form [name=title]").fill("Browser Acceptance Book");
  await page.locator("#project-form").evaluate((form) => form.requestSubmit());
  await page.waitForLoadState("networkidle");

  await page.locator('nav a[data-route="manuscript"]').click();
  await page.locator("#book-form [name=title]").fill("Acceptance Book");
  await page.locator("#book-form").evaluate((form) => form.requestSubmit());
  await page.waitForFunction(() => document.querySelector("#chapter-book option"));
  await page.locator("#chapter-form [name=number]").fill("1");
  await page.locator("#chapter-form [name=title]").fill("Acceptance Chapter");
  await page.locator("#chapter-form [name=synopsis]").fill("Acceptance chapter");
  await page.locator("#chapter-form").evaluate((form) => form.requestSubmit());
  await page.waitForFunction(() => document.querySelector("#scene-book option"));
  await page.locator("#scene-form [name=number]").fill("1");
  await page.locator("#scene-form [name=title]").fill("Acceptance Scene");
  await page.locator("#scene-form [name=synopsis]").fill("Acceptance scene");
  await page.locator("#scene-form").evaluate((form) => form.requestSubmit());
  await page.waitForFunction(() => document.querySelector("#editor-scene option"));

  const workspaceResponse = await fetch(`${baseUrl}/api/projects/${projectId}/workspace`);
  assert.equal(workspaceResponse.ok, true);
  const workspace = await workspaceResponse.json();
  const bookId = workspace.books?.[0]?.id;
  assert.equal(typeof bookId, "string");

  const workflowBlocked = await fetch(`${baseUrl}/api/projects/${projectId}/workflow/advance`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bookId, checks: { concept: [{ id: "concept.ready", label: "Concept approved", passed: true }] } }) });
  assert.equal(workflowBlocked.status, 409);
  const blockedPayload = await workflowBlocked.json();
  assert.deepEqual(blockedPayload.workflow.blockers, ["AUTHOR_APPROVAL_REQUIRED"]);

  const workflowAdvanced = await fetch(`${baseUrl}/api/projects/${projectId}/workflow/advance`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bookId, checks: { concept: [{ id: "concept.ready", label: "Concept approved", passed: true }] }, authorApproved: true, now: "2026-08-30T03:00:00.000Z" }) });
  assert.equal(workflowAdvanced.ok, true);
  const advancedPayload = await workflowAdvanced.json();
  assert.equal(advancedPayload.workflow.toStage, "architecture");
  assert.equal(advancedPayload.project.workflowStage, "architecture");

  const persistedWorkflow = await (await fetch(`${baseUrl}/api/projects/${projectId}/workflow`)).json();
  assert.equal(persistedWorkflow.currentStage, "architecture");

  await page.locator('nav a[data-route="writing"]').click();
  await page.locator("#editor-content").fill("A real browser-driven manuscript scene.");
  await page.locator("#save-scene").click();
  await page.waitForFunction(() => document.querySelector("#success-banner")?.textContent.includes("Scene saved."));

  await page.locator('nav a[data-route="characters"]').click();
  const characterForm = page.locator("#character-form");
  for (const [name, value] of Object.entries({ name: "Acceptance Character", age: "34", birthDate: "1992-01-15", physicalAppearance: "Weathered face with steady gaze", height: "5'11", build: "Athletic", hair: "Dark brown", eyes: "Hazel", skin: "Olive", clothing: "Dark jacket", voice: "Low and measured", personality: "Observant and loyal", history: "Former investigator rebuilding a life.", characterArc: "Learns to trust others.", currentEmotionalState: "Determined", currentLocation: "Ogden" })) await characterForm.locator(`[name="${name}"]`).fill(value);
  await characterForm.evaluate((form) => form.requestSubmit());
  await page.waitForFunction(() => document.querySelector("#character-list")?.textContent.includes("Acceptance Character"));

  await page.locator('nav a[data-route="world"]').click();
  const memoryForm = page.locator("#memory-form");
  await memoryForm.locator('[name="class"]').selectOption("story-canon");
  await memoryForm.locator('[name="authority"]').selectOption("working");
  await memoryForm.locator('[name="summary"]').fill("Acceptance canon");
  await memoryForm.locator('[name="content"]').fill("The acceptance test stores durable canon.");
  await memoryForm.locator('[name="reference"]').fill("browser-test");
  await memoryForm.evaluate((form) => form.requestSubmit());
  await page.waitForFunction(() => document.querySelector("#memory-list")?.textContent.includes("Acceptance canon"));

  await page.locator('nav a[data-route="writing"]').click();
  await page.locator("#ai-instruction").fill("Continue the scene, but keep the candidate separate until author approval.");
  await page.locator("#ai-draft").click();
  await page.waitForFunction(() => document.querySelector("#error-banner")?.hidden === false || document.querySelector("#ai-proposals")?.textContent.includes("No durable AI proposals"));

  await page.locator('nav a[data-route="publishing"]').click();
  await page.locator("#export-form [name=author]").fill("Acceptance Author");
  await page.locator("#export-form").evaluate((form) => form.requestSubmit());
  await page.waitForFunction(() => document.querySelector("#export-status")?.textContent.includes("Artifact"));

  await page.locator('nav a[data-route="health"]').click();
  await page.locator("#health-refresh").click();
  await page.waitForFunction(() => document.querySelector("#health-result")?.textContent.includes("books"));

  await browser.close();
  console.log("REAL BROWSER ACCEPTANCE PASSED: routes + durable manuscript + workflow gate + character + canon + honest AI failure + production path");
} finally {
  child.kill("SIGTERM");
  await new Promise((resolve) => { const timer = setTimeout(resolve, 1500); child.once("exit", () => { clearTimeout(timer); resolve(); }); });
  await rm(dataDir, { recursive: true, force: true });
}

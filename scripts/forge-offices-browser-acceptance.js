#!/usr/bin/env node
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { chromium } = require("@playwright/test");

const HOST = "127.0.0.1";
const PORTS = { studio: 4173, journal: 4273, workbooks: 4373, specialized: 4473 };
const projectId = `forge-offices-${Date.now()}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitForHttp(url, timeoutMs = 15000) { const started = Date.now(); while (Date.now() - started < timeoutMs) { try { if ((await fetch(url)).ok) return; } catch {} await sleep(100); } throw new Error(`Timed out waiting for ${url}`); }
async function stop(process) { if (!process || process.exitCode !== null) return; process.kill("SIGTERM"); await Promise.race([new Promise((resolve) => process.once("exit", resolve)), sleep(3000)]); if (process.exitCode === null) process.kill("SIGKILL"); }
async function main() {
  const dataDir = await mkdtemp(join(tmpdir(), "authors-forge-offices-"));
  const launcher = spawn(process.execPath, ["scripts/start-forge.js", `--host=${HOST}`], { env: { ...process.env, FORGE_DATA_DIR: dataDir, PORT: String(PORTS.studio), JOURNAL_PORT: String(PORTS.journal), WORKBOOK_PORT: String(PORTS.workbooks), SPECIALIZED_PORT: String(PORTS.specialized), OMNIROUTE_BASE_URL: "", ROUTER9_BASE_URL: "", KINGS_AI_ENDPOINT: "", OPENAI_API_KEY: "", OLLAMA_BASE_URL: "" }, stdio: ["ignore", "pipe", "pipe"] });
  let browser;
  try {
    for (const port of Object.values(PORTS)) await waitForHttp(`http://${HOST}:${port}/api/health`);
    const created = await fetch(`http://${HOST}:${PORTS.studio}/api/projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: projectId, title: "Cross-office acceptance" }) });
    assert.equal(created.ok, true, await created.text());
    browser = await chromium.launch({ executablePath: process.env.FORGE_BROWSER_EXECUTABLE || chromium.executablePath(), headless: true, args: ["--no-sandbox", "--disable-gpu"] });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await page.goto(`http://${HOST}:${PORTS.studio}/?project=${encodeURIComponent(projectId)}#dashboard`, { waitUntil: "networkidle" });
    await page.waitForSelector("#forge-office-launcher");
    const overflow = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, body: document.body.scrollWidth, doc: document.documentElement.scrollWidth }));
    assert.ok(overflow.body <= overflow.viewport + 1 && overflow.doc <= overflow.viewport + 1, `Cross-office launcher overflows mobile viewport: ${JSON.stringify(overflow)}`);
    const offices = [
      ["#open-guided-journal-office", `http://${HOST}:${PORTS.journal}/?project=${encodeURIComponent(projectId)}`, /Guided Journal/i],
      ["#open-workbook-office", `http://${HOST}:${PORTS.workbooks}/?project=${encodeURIComponent(projectId)}`, /Educational Workbook/i],
      ["#open-workbook-differentiation", `http://${HOST}:${PORTS.workbooks}/educational-differentiation.html?project=${encodeURIComponent(projectId)}`, /Educational Workbook Differentiation/i],
      ["#open-workbook-assessment", `http://${HOST}:${PORTS.workbooks}/educational-assessment.html?project=${encodeURIComponent(projectId)}`, /Rubrics & Performance Assessment/i],
      ["#open-specialized-office", `http://${HOST}:${PORTS.specialized}/?project=${encodeURIComponent(projectId)}`, /Specialized Creation/i],
    ];
    for (const [selector, expectedHref, titlePattern] of offices) {
      const link = page.locator(selector); await link.waitFor(); const href = await link.getAttribute("href"); assert.equal(href, expectedHref); assert.equal(await link.getAttribute("target"), "_blank"); const box = await link.boundingBox(); assert.ok(box && box.height >= 44, `${selector} must remain a touch-sized launcher control.`);
      const officePage = await context.newPage(); const response = await officePage.goto(href, { waitUntil: "domcontentloaded" }); assert.ok(response?.ok(), `${selector} target must be reachable through the unified launcher.`); assert.match(await officePage.locator("body").innerText(), titlePattern); await officePage.close();
    }
    await context.close();
    console.log("FORGE CROSS-OFFICE BROWSER ACCEPTANCE PASSED: one launcher starts all four workplaces; main Studio exposes project-aware Android-touch-sized links to Guided Journal, Educational Workbooks, Workbook Differentiation, Rubrics & Assessment, and Specialized Creation; every target is live.");
  } finally { if (browser) await browser.close().catch(() => {}); await stop(launcher).catch(() => {}); await rm(dataDir, { recursive: true, force: true }); }
}
main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });

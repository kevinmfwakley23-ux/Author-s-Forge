#!/usr/bin/env node
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { chromium } = require("@playwright/test");

const HOST = "127.0.0.1";
const PORT = 6040 + Math.floor(Math.random() * 80);
const PROJECT_ID = "agent-routing-acceptance";

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
  const dataDir = await mkdtemp(join(tmpdir(), "forge-agent-routing-"));
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
      GROQ_API_KEY: "",
      MISTRAL_API_KEY: "",
      GEMINI_API_KEY: "",
      ANTHROPIC_API_KEY: "",
      OPENROUTER_API_KEY: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let browser;
  try {
    const base = `http://${HOST}:${PORT}`;
    await waitForHttp(`${base}/api/health`);
    await api(base, "/api/projects", "POST", { id: PROJECT_ID, title: "Agent Routing Acceptance" });

    const initial = await api(base, `/api/projects/${PROJECT_ID}/ai/control`);
    assert.equal(initial.control.spendPolicy, "no-paid-tokens");
    assert.equal(initial.control.routingMode, "economy");
    assert.equal(initial.resources.length, 0, "fixture must not accidentally use a real provider");

    browser = await chromium.launch({ executablePath: process.env.FORGE_BROWSER_EXECUTABLE || chromium.executablePath(), headless: true, args: ["--no-sandbox", "--disable-gpu"] });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await page.goto(`${base}/forge-agent.html?project=${PROJECT_ID}`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelector("#agent-routing-status")?.textContent.includes("AI routing truth loaded"));

    const summary = await page.locator("#agent-routing-summary").innerText();
    assert.match(summary, /Configured AI resources\s*0/);
    assert.match(summary, /Spend policy\s*no-paid-tokens/);
    assert.match(summary, /Routing mode\s*economy/);
    assert.match(await page.locator("#agent-routing-resources").innerText(), /No AI generation resource is currently configured/);
    assert.equal(await page.locator("#agent-spend-policy").inputValue(), "no-paid-tokens");
    assert.equal(await page.locator("#agent-routing-mode").inputValue(), "economy");
    assert.equal(await page.locator("#agent-provider option").count(), 10);

    // A routing-mode change is real, explicit and preserves the safe no-paid-token policy.
    await page.locator("#agent-routing-mode").selectOption("balanced");
    await page.locator("#agent-apply-routing-policy").tap();
    await page.waitForFunction(() => document.querySelector("#agent-routing-status")?.textContent.includes("Routing policy applied"));
    const changed = await api(base, `/api/projects/${PROJECT_ID}/ai/control`);
    assert.equal(changed.control.routingMode, "balanced");
    assert.equal(changed.control.spendPolicy, "no-paid-tokens");
    assert.equal(changed.control.pinnedProvider, undefined);

    // An unconfigured catalog must fail honestly instead of inventing models.
    await page.locator("#agent-provider").selectOption("openai");
    await page.locator("#agent-load-catalog").tap();
    await page.waitForFunction(() => /not configured|catalog failed/i.test(document.querySelector("#agent-routing-status")?.textContent || ""));
    assert.match(await page.locator("#agent-routing-status").innerText(), /not configured|catalog failed/i);
    assert.equal(await page.locator("#agent-pin-model").isDisabled(), true);

    const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, body: document.body.scrollWidth, document: document.documentElement.scrollWidth }));
    assert.ok(dimensions.body <= dimensions.viewport + 1, `AI routing panel introduced horizontal body overflow: ${JSON.stringify(dimensions)}`);
    assert.ok(dimensions.document <= dimensions.viewport + 1, `AI routing panel introduced horizontal document overflow: ${JSON.stringify(dimensions)}`);
    const applyBox = await page.locator("#agent-apply-routing-policy").boundingBox();
    assert.ok(applyBox && applyBox.height >= 40, `Routing policy control is too small for touch: ${JSON.stringify(applyBox)}`);

    console.log("FORGE AGENT ROUTING BROWSER ACCEPTANCE PASSED: real AI control state + ten-provider UI + explicit policy mutation + safe spend preservation + honest unconfigured catalog failure + Android-sized layout.");
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill("SIGTERM");
    await new Promise((resolve) => server.exitCode !== null ? resolve() : server.once("exit", resolve));
    await rm(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });

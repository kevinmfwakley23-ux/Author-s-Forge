#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const HOST = "127.0.0.1";
const PORT = 6120 + Math.floor(Math.random() * 200);

async function waitFor(url, timeoutMs = 15000) {
  const started = Date.now();
  let last;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      last = new Error(`HTTP ${response.status}`);
    } catch (error) { last = error; }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw last || new Error(`Timed out waiting for ${url}`);
}

async function main() {
  const major = Number(process.versions.node.split(".")[0]);
  assert.equal(major, 18, `Android compatibility smoke must run on Node 18; got ${process.versions.node}.`);
  const dataDir = await mkdtemp(join(tmpdir(), "forge-android-node18-"));
  const server = spawn(process.execPath, ["dist/studio-server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST,
      PORT: String(PORT),
      FORGE_DATA_DIR: dataDir,
      FORGE_BACKUP_DIR: join(dataDir, "backups"),
      OPENAI_API_KEY: "",
      OPENAI_MODEL: "",
      OLLAMA_BASE_URL: "",
      OLLAMA_MODEL: "",
      KINGS_AI_RESPONSES_URL: "",
      OMNIROUTE_BASE_URL: "",
      ROUTER9_BASE_URL: "",
      GROQ_API_KEY: "",
      OPENROUTER_API_KEY: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  server.stderr.on("data", (chunk) => { stderr += chunk; });
  try {
    const base = `http://${HOST}:${PORT}`;
    const healthResponse = await waitFor(`${base}/api/health`);
    const health = await healthResponse.json();
    assert.equal(health.ok, true);
    assert.equal(health.service, "authors-forge-studio");

    const studio = await (await fetch(`${base}/`)).text();
    assert.match(studio, /One place to finish the book\./);
    assert.match(studio, /WRITING DESK/);
    assert.doesNotMatch(studio, /forge\.example\.com/i);

    const projectId = `android-node18-${Date.now()}`;
    const created = await fetch(`${base}/api/projects`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: projectId, title: "Android Embedded Runtime Proof" }),
    });
    assert.equal(created.status, 201, await created.text());
    const project = await (await fetch(`${base}/api/projects/${projectId}`)).json();
    assert.equal(project.metadata.id, projectId);
    console.log(`ANDROID NODE 18 RUNTIME SMOKE PASSED: ${process.versions.node} serves the real Studio + durable project API.`);
  } finally {
    server.kill("SIGTERM");
    await new Promise((resolve) => server.exitCode !== null ? resolve() : server.once("exit", resolve));
    await rm(dataDir, { recursive: true, force: true });
  }
  if (stderr.trim()) console.log(`[Android Node 18 runtime stderr]\n${stderr.trim()}`);
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});

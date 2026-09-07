#!/usr/bin/env node
const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const HOST = "127.0.0.1";
const STUDIO_PORT = 6240 + Math.floor(Math.random() * 80);
const OLLAMA_PORT = 6340 + Math.floor(Math.random() * 80);
const PROJECT_ID = "agent-runtime-api-acceptance";
const BOOK_ID = "runtime-book";
const CHAPTER_ID = "runtime-chapter";
const SCENE_ID = "runtime-scene";

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, HOST, () => { server.off("error", reject); resolve(); });
  });
}

function close(server) {
  return new Promise((resolve) => server.close(() => resolve()));
}

async function waitForHttp(url, timeoutMs = 15000) {
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

function fakeOllama() {
  let calls = 0;
  const server = createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/api/chat") {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Unknown fake Ollama route." }));
      return;
    }
    let raw = "";
    for await (const chunk of req) raw += String(chunk);
    const request = JSON.parse(raw || "{}");
    const messages = Array.isArray(request.messages) ? request.messages : [];
    const user = String(messages.findLast?.((message) => message?.role === "user")?.content || messages[messages.length - 1]?.content || "");
    calls += 1;

    let decision;
    if (!user.includes('"toolId": "project.context"')) {
      decision = { action: "tool", toolId: "project.context", reason: "Read durable Project Brain context before choosing any later operation." };
    } else if (!user.includes('"toolId": "editing.analyze"')) {
      decision = { action: "tool", toolId: "editing.analyze", reason: "Analyze the selected real scene after observing the grounded project context." };
    } else {
      decision = { action: "finish", summary: "The server-owned agent completed the approved mission after observing both grounded project context and real editorial analysis." };
    }

    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      model: "forge-agent-runtime-fixture",
      created_at: new Date().toISOString(),
      message: { role: "assistant", content: JSON.stringify(decision) },
      done: true,
      prompt_eval_count: 24,
      eval_count: 20,
    }));
  });
  return { server, getCalls: () => calls };
}

async function main() {
  const dataDir = await mkdtemp(join(tmpdir(), "forge-agent-runtime-api-"));
  const provider = fakeOllama();
  await listen(provider.server, OLLAMA_PORT);
  const studio = spawn(process.execPath, ["dist/studio-server.js"], {
    env: {
      ...process.env,
      HOST,
      PORT: String(STUDIO_PORT),
      FORGE_DATA_DIR: dataDir,
      AI_PROVIDER_ORDER: "ollama",
      AI_SPEND_POLICY: "no-paid-tokens",
      AI_CACHE_ENABLED: "false",
      AI_MODEL_RESOURCES_JSON: "",
      AI_GATEWAYS_JSON: "",
      OPENAI_API_KEY: "", OPENAI_MODEL: "", OPENAI_MODELS: "",
      OLLAMA_BASE_URL: `http://${HOST}:${OLLAMA_PORT}`, OLLAMA_MODEL: "forge-agent-runtime-fixture", OLLAMA_MODELS: "", OLLAMA_BILLING_CLASS: "local",
      KINGS_AI_ENDPOINT: "", KINGS_AI_RESPONSES_URL: "", KINGS_AI_API_KEY: "", KINGS_AI_MODEL: "", KINGS_AI_MODELS: "",
      OMNIROUTE_BASE_URL: "", OMNIROUTE_API_KEY: "", OMNIROUTE_MODEL: "", OMNIROUTE_MODELS: "",
      ROUTER9_BASE_URL: "", ROUTER9_API_KEY: "", ROUTER9_MODEL: "", ROUTER9_MODELS: "",
      GROQ_API_KEY: "", GROQ_MODEL: "", GROQ_MODELS: "",
      MISTRAL_API_KEY: "", MISTRAL_MODEL: "", MISTRAL_MODELS: "",
      GEMINI_API_KEY: "", GEMINI_MODEL: "", GEMINI_MODELS: "",
      ANTHROPIC_API_KEY: "", ANTHROPIC_MODEL: "", ANTHROPIC_MODELS: "",
      OPENROUTER_API_KEY: "", OPENROUTER_MODEL: "", OPENROUTER_MODELS: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  studio.stderr.on("data", (chunk) => { stderr += String(chunk); });

  try {
    const base = `http://${HOST}:${STUDIO_PORT}`;
    await waitForHttp(`${base}/api/health`);
    await api(base, "/api/projects", "POST", { id: PROJECT_ID, title: "Agent Runtime API Acceptance" });
    await api(base, `/api/projects/${PROJECT_ID}/workspace/books`, "POST", { id: BOOK_ID, title: "Runtime Proof", kind: "novel", description: "Server-owned iterative agent fixture" });
    await api(base, `/api/projects/${PROJECT_ID}/workspace/books/${BOOK_ID}/chapters`, "POST", { id: CHAPTER_ID, number: 1, title: "Agent Loop", synopsis: "Prove tool observation and replanning" });
    await api(base, `/api/projects/${PROJECT_ID}/workspace/books/${BOOK_ID}/chapters/${CHAPTER_ID}/scenes`, "POST", { id: SCENE_ID, number: 1, title: "Observed Scene", synopsis: "A real scene is available for deterministic editorial analysis" });
    await api(base, `/api/projects/${PROJECT_ID}/workspace/books/${BOOK_ID}/chapters/${CHAPTER_ID}/scenes/${SCENE_ID}/content`, "PUT", { content: "The author wrote this scene before the agent ran. The runtime must inspect it without silently rewriting a word." });

    const result = await api(base, `/api/projects/${PROJECT_ID}/agent/run`, "POST", {
      goal: "Ground the project, analyze the selected scene, and report when the approved mission is complete.",
      bookId: BOOK_ID,
      chapterId: CHAPTER_ID,
      sceneId: SCENE_ID,
      approvedToolIds: ["memory.record-working"],
      maxSteps: 5,
    });

    assert.equal(result.authority, "server-owned-iterative-agent");
    assert.equal(result.run.status, "completed");
    assert.deepEqual(result.run.observations.map((item) => item.toolId), ["project.context", "editing.analyze"]);
    assert.deepEqual(result.run.decisions.map((item) => item.action), ["tool", "tool", "finish"]);
    assert.equal(result.run.decisions.every((item) => item.provider === "ollama" && item.model === "forge-agent-runtime-fixture"), true);
    assert.equal(provider.getCalls(), 3, "The controller model must be called again after each real observation.");
    assert.match(result.run.finalSummary, /server-owned agent completed/i);

    const durable = await api(base, `/api/projects/${PROJECT_ID}/agent/run/${result.run.id}`);
    assert.equal(durable.authority, "durable-agent-evidence");
    assert.deepEqual(durable.run, result.run);

    const project = await api(base, `/api/projects/${PROJECT_ID}`);
    const scene = project.studioWorkspace.books[0].chapters[0].scenes[0];
    assert.match(scene.content, /author wrote this scene before the agent ran/i, "read-only agent mission must not mutate manuscript text");

    console.log("FORGE AGENT RUNTIME V4 API ACCEPTANCE PASSED: real Studio route + Project Brain model decisions + loopback Forge tool execution + observation/replan + durable evidence + no manuscript mutation.");
  } finally {
    studio.kill("SIGTERM");
    await new Promise((resolve) => studio.exitCode !== null ? resolve() : studio.once("exit", resolve));
    await close(provider.server);
    await rm(dataDir, { recursive: true, force: true });
    if (studio.exitCode && stderr) process.stderr.write(stderr);
  }
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });

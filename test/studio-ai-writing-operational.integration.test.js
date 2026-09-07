const test = require("node:test");
const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const HOST = "127.0.0.1";
const GENERATED = "Rain whispered across the dark windows while Mara kept one hand on the brass compass. She remembered her promise never to open the red cellar door alone, so she waited for Elias before stepping into the hall. The house creaked around them, but neither character broke the rule the author had already established.";

async function reservePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, HOST, resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (!port) throw new Error("Could not reserve an integration-test port.");
  return port;
}

async function listen(server, port) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, HOST, resolve);
  });
}

async function close(server) {
  if (!server.listening) return;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
}

async function waitForStudio(base, child, stderr, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Studio exited before startup (${child.exitCode}).\n${stderr()}`);
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Studio did not become ready.\n${stderr()}`);
}

async function request(base, path, options = {}, expectedStatus) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
  });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (expectedStatus !== undefined) assert.equal(response.status, expectedStatus, `${options.method || "GET"} ${path}: ${text}`);
  else assert.equal(response.ok, true, `${options.method || "GET"} ${path}: ${text}`);
  return body;
}

function cleanProviderEnv(baseEnv, ollamaUrl) {
  return {
    ...baseEnv,
    OLLAMA_BASE_URL: ollamaUrl,
    OLLAMA_MODEL: "forge-operational-test",
    OLLAMA_MODELS: "",
    AI_PROVIDER_ORDER: "ollama",
    AI_SPEND_POLICY: "no-paid-tokens",
    AI_ROUTING_MODE: "quality",
    AI_PINNED_PROVIDER: "",
    AI_PINNED_MODEL: "",
    AI_MODEL_RESOURCES_JSON: "",
    OPENAI_API_KEY: "",
    OPENAI_MODEL: "",
    OPENAI_MODELS: "",
    OMNIROUTE_BASE_URL: "",
    OMNIROUTE_API_KEY: "",
    ROUTER9_BASE_URL: "",
    ROUTER9_API_KEY: "",
    KINGS_AI_RESPONSES_URL: "",
    KINGS_AI_ENDPOINT: "",
    KINGS_AI_API_KEY: "",
    GROQ_API_KEY: "",
    MISTRAL_API_KEY: "",
    GEMINI_API_KEY: "",
    ANTHROPIC_API_KEY: "",
    OPENROUTER_API_KEY: "",
    AI_GATEWAYS_JSON: "",
  };
}

test("main Studio performs routed Project-Brain AI writing through author approval and durable reload", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "forge-operational-writing-"));
  const studioPort = await reservePort();
  const ollamaPort = await reservePort();
  const base = `http://${HOST}:${studioPort}`;
  const ollamaRequests = [];

  const ollama = createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/api/chat") {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
      return;
    }
    let raw = "";
    for await (const chunk of req) raw += String(chunk);
    const payload = JSON.parse(raw);
    ollamaRequests.push(payload);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      model: "forge-operational-test",
      message: { role: "assistant", content: GENERATED },
      prompt_eval_count: 240,
      eval_count: 72,
      done: true,
    }));
  });
  await listen(ollama, ollamaPort);

  let stderr = "";
  let studio = spawn(process.execPath, ["dist/studio-server.js"], {
    cwd: process.cwd(),
    env: {
      ...cleanProviderEnv(process.env, `http://${HOST}:${ollamaPort}`),
      HOST,
      PORT: String(studioPort),
      FORGE_DATA_DIR: dataDir,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  studio.stderr.on("data", (chunk) => { stderr += String(chunk); });

  const projectId = `operational-writing-${process.pid}`;
  const bookId = "book-1";
  const chapterId = "chapter-1";
  const sceneId = "scene-1";
  const original = "Mara stood at the top of the cellar stairs with the brass compass in her palm.";

  try {
    await waitForStudio(base, studio, () => stderr);

    await request(base, "/api/projects", {
      method: "POST",
      body: JSON.stringify({ id: projectId, title: "Operational Writing Proof" }),
    }, 201);
    await request(base, `/api/projects/${projectId}/workspace/books`, {
      method: "POST",
      body: JSON.stringify({ id: bookId, title: "Operational Book", kind: "novel" }),
    }, 201);
    await request(base, `/api/projects/${projectId}/workspace/books/${bookId}/chapters`, {
      method: "POST",
      body: JSON.stringify({ id: chapterId, number: 1, title: "The Cellar" }),
    }, 201);
    await request(base, `/api/projects/${projectId}/workspace/books/${bookId}/chapters/${chapterId}/scenes`, {
      method: "POST",
      body: JSON.stringify({ id: sceneId, number: 1, title: "At the Door" }),
    }, 201);
    await request(base, `/api/projects/${projectId}/workspace/books/${bookId}/chapters/${chapterId}/scenes/${sceneId}/content`, {
      method: "PUT",
      body: JSON.stringify({ content: original }),
    }, 200);
    await request(base, `/api/projects/${projectId}/memory`, {
      method: "POST",
      body: JSON.stringify({
        id: "canon-cellar-rule",
        class: "story-canon",
        authority: "authoritative",
        summary: "Cellar rule",
        content: "Mara never opens the red cellar door alone; Elias must be with her.",
        reference: "author-approved-operational-test",
      }),
    }, 201);

    const generated = await request(base, `/api/projects/${projectId}/ai/writing/generate`, {
      method: "POST",
      body: JSON.stringify({
        bookId,
        chapterId,
        sceneId,
        task: "continue",
        instruction: "Continue the scene without breaking the established cellar rule or changing Mara's brass compass.",
        proposalId: "proposal-operational-writing",
        contextTokenBudget: 6000,
        routingPreference: { preferProvider: "ollama", preferModel: "forge-operational-test" },
      }),
    }, 201);

    assert.equal(generated.proposal.id, "proposal-operational-writing");
    assert.equal(generated.proposal.status, "pending");
    assert.equal(generated.proposal.proposedContent, GENERATED);
    assert.ok(generated.proposal.sourceMemoryIds.includes("canon-cellar-rule"), JSON.stringify(generated.proposal.sourceMemoryIds));
    assert.equal(ollamaRequests.length, 1, "The production Studio must make one real routed HTTP model call.");

    const providerPrompt = ollamaRequests[0].messages.map((message) => message.content).join("\n\n");
    assert.match(providerPrompt, /AUTHOR'S FORGE QUALITY CONTRACT/);
    assert.match(providerPrompt, /GOVERNED PROJECT CONTEXT/);
    assert.match(providerPrompt, /Mara never opens the red cellar door alone/);
    assert.match(providerPrompt, /brass compass/);

    const beforeReview = await request(base, `/api/projects/${projectId}/workspace`);
    assert.equal(beforeReview.books[0].chapters[0].scenes[0].content, original, "AI generation must not silently mutate the manuscript.");

    await request(base, `/api/projects/${projectId}/ai/proposals/proposal-operational-writing/apply`, {
      method: "POST",
      body: JSON.stringify({}),
    }, 400);
    await request(base, `/api/projects/${projectId}/ai/proposals/proposal-operational-writing/review`, {
      method: "POST",
      body: JSON.stringify({ decision: "accepted", note: "Author approved the generated continuation." }),
    }, 200);
    const applied = await request(base, `/api/projects/${projectId}/ai/proposals/proposal-operational-writing/apply`, {
      method: "POST",
      body: JSON.stringify({}),
    }, 200);
    assert.equal(applied.workspace.books[0].chapters[0].scenes[0].content, GENERATED);

    await stop(studio);
    stderr = "";
    studio = spawn(process.execPath, ["dist/studio-server.js"], {
      cwd: process.cwd(),
      env: {
        ...cleanProviderEnv(process.env, `http://${HOST}:${ollamaPort}`),
        HOST,
        PORT: String(studioPort),
        FORGE_DATA_DIR: dataDir,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    studio.stderr.on("data", (chunk) => { stderr += String(chunk); });
    await waitForStudio(base, studio, () => stderr);

    const reloaded = await request(base, `/api/projects/${projectId}/workspace`);
    assert.equal(reloaded.books[0].chapters[0].scenes[0].content, GENERATED, "Accepted AI writing must survive a real Studio restart.");
    const proposal = await request(base, `/api/projects/${projectId}/ai/proposals/proposal-operational-writing`);
    assert.equal(proposal.status, "accepted");
  } finally {
    await stop(studio);
    await close(ollama);
    await rm(dataDir, { recursive: true, force: true });
  }
});

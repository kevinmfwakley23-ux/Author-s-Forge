const test = require("node:test");
const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { mkdtemp, rm, readFile } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const {
  upsertOpenAiCompatibleGateway,
  discoverGatewayModels,
  loadOpenAiCompatibleGateways,
  gatewayModelKey,
} = require("../dist/infrastructure/openai-compatible-gateways.js");
const { generateText, aiConfiguredResources } = require("../dist/infrastructure/ai-provider.js");

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Gateway test server has no TCP address.");
  return address.port;
}
function json(res, status, value) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(value));
}

function restoreEnv(snapshot) {
  for (const key of Object.keys(process.env)) if (!(key in snapshot)) delete process.env[key];
  for (const [key, value] of Object.entries(snapshot)) process.env[key] = value;
}

test("generic gateway discovers models and completes a real generateText request through loopback OpenAI-compatible HTTP", async () => {
  const env = { ...process.env };
  const root = await mkdtemp(join(tmpdir(), "forge-gateway-test-"));
  let completionRequests = 0;
  const server = createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/v1/models") {
      json(res, 200, { data: [{ id: "local-creative-model" }, { id: "local-editor-model" }] });
      return;
    }
    if (req.method === "POST" && req.url === "/v1/chat/completions") {
      let raw = "";
      for await (const chunk of req) raw += String(chunk);
      const body = JSON.parse(raw);
      assert.equal(body.model, "local-creative-model");
      assert.ok(Array.isArray(body.messages));
      completionRequests += 1;
      json(res, 200, {
        id: "gateway-response-1",
        choices: [{ message: { content: "Mara stopped at the archive threshold and listened before taking another step. The promise she had made still shaped the moment, so she waited for her partner instead of crossing alone. The hallway stayed quiet, but her restraint preserved both the established danger and the character decision already present in the scene." } }],
        usage: { prompt_tokens: 120, completion_tokens: 58, total_tokens: 178 },
      });
      return;
    }
    json(res, 404, { error: { message: "not found" } });
  });

  try {
    const port = await listen(server);
    process.env.FORGE_DATA_DIR = root;
    for (const key of [
      "OMNIROUTE_BASE_URL", "ROUTER9_BASE_URL", "KINGS_AI_ENDPOINT", "OLLAMA_BASE_URL",
      "OPENAI_API_KEY", "GROQ_API_KEY", "MISTRAL_API_KEY", "GEMINI_API_KEY",
      "ANTHROPIC_API_KEY", "OPENROUTER_API_KEY",
    ]) delete process.env[key];

    const gateway = upsertOpenAiCompatibleGateway({
      id: "local-test",
      label: "Local Test Gateway",
      baseUrl: `http://127.0.0.1:${port}`,
      enabled: true,
      models: [{
        id: "local-creative-model",
        billingClass: "local",
        capabilities: {
          contextWindow: 100000,
          maxOutputTokens: 8000,
          creativeWriting: true,
          instructionFollowing: true,
          longContext: true,
        },
      }],
    });

    assert.equal(gateway.apiKeyEnv, undefined);
    assert.deepEqual(await discoverGatewayModels(gateway), ["local-creative-model", "local-editor-model"]);

    const encodedModel = gatewayModelKey("local-test", "local-creative-model");
    const resources = aiConfiguredResources();
    const registered = resources.find((resource) => resource.provider === "gateway" && resource.model === encodedModel);
    assert.ok(registered, "registered gateway model must enter the canonical Forge broker resource pool");
    assert.equal(registered.billingClass, "local");

    const result = await generateText({
      system: "Write only the requested scene candidate and preserve supplied canon.",
      user: "Rewrite the archive threshold beat. Mara previously promised she would not enter alone. Preserve that fact and make the moment concise and tense.",
      task: "writing",
      spendPolicy: "unrestricted",
      preferProvider: "gateway",
      preferModel: encodedModel,
      maxOutputTokens: 1000,
      requiresCreativeWriting: true,
      requiresInstructionFollowing: true,
    });

    assert.equal(result.provider, "gateway");
    assert.equal(result.model, encodedModel);
    assert.match(result.text, /promise/i);
    assert.equal(result.quality.accepted, true);
    assert.equal(result.usage.totalTokens, 178);
    assert.equal(completionRequests, 1);

    const stored = JSON.parse(await readFile(join(root, "ai-openai-compatible-gateways.json"), "utf8"));
    assert.equal(stored.gateways[0].apiKeyEnv, undefined);
    assert.equal(JSON.stringify(stored).includes("Bearer"), false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
    restoreEnv(env);
  }
});

test("gateway registry rejects insecure remote HTTP endpoints and never accepts raw credentials as URL data", async () => {
  const env = { ...process.env };
  const root = await mkdtemp(join(tmpdir(), "forge-gateway-validation-"));
  try {
    process.env.FORGE_DATA_DIR = root;
    assert.throws(() => upsertOpenAiCompatibleGateway({
      id: "unsafe",
      label: "Unsafe Gateway",
      baseUrl: "http://192.168.1.20:4000",
      enabled: true,
      models: [],
    }), /HTTPS|loopback/i);
    assert.throws(() => upsertOpenAiCompatibleGateway({
      id: "url-secret",
      label: "URL Secret",
      baseUrl: "https://user:password@example.com",
      enabled: true,
      models: [],
    }), /credentials/i);
    assert.deepEqual(loadOpenAiCompatibleGateways(), []);
  } finally {
    await rm(root, { recursive: true, force: true });
    restoreEnv(env);
  }
});

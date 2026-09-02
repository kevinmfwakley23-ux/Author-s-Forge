const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { createForgeStudioRuntime } = require("../.forge-build/infrastructure/forge-studio-runtime.js");
const { generateText, aiRoutingTelemetry } = require("../.forge-build/infrastructure/ai-provider.js");

function setEnv(values) {
  const previous = new Map();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  return () => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  };
}

test("production Studio AI provider boundary writes usage into the exact ForgeCore routing state", async () => {
  const dir = await mkdtemp(join(tmpdir(), "forge-core-ai-binding-"));
  const restoreEnv = setEnv({
    AI_PROVIDER_ORDER: "omniroute",
    OMNIROUTE_BASE_URL: "http://forge-core-runtime.test",
    OMNIROUTE_MODEL: "bound-model",
    OMNIROUTE_MODELS: undefined,
    OMNIROUTE_BILLING_CLASS: "subscription",
    ROUTER9_BASE_URL: undefined,
    KINGS_AI_ENDPOINT: undefined,
    OPENAI_API_KEY: undefined,
    OPENAI_MODEL: undefined,
    OLLAMA_BASE_URL: undefined,
    OLLAMA_MODEL: undefined,
  });
  const oldFetch = global.fetch;
  global.fetch = async (_url, options) => {
    const payload = JSON.parse(options.body);
    assert.equal(payload.model, "bound-model");
    return new Response(JSON.stringify({
      id: "bound-response",
      choices: [{ message: { content: "bound result" } }],
      usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 },
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  try {
    const runtime = createForgeStudioRuntime(dir);
    assert.equal(runtime.core.ai.listResources().length, 1);
    const result = await generateText({ system: "Follow the project.", user: "Generate safely.", maxOutputTokens: 100 });
    assert.equal(result.provider, "omniroute");
    assert.equal(result.usage.totalTokens, 12);
    assert.equal(result.routing.accountedTokens, 12);
    const coreState = runtime.core.routing.get("omniroute", "bound-model");
    assert.equal(coreState.totalTokens, 12);
    assert.equal(coreState.totalSuccesses, 1);
    const liveState = aiRoutingTelemetry().find((entry) => entry.provider === "omniroute" && entry.model === "bound-model");
    assert.ok(liveState);
    assert.equal(liveState.totalTokens, 12);
    assert.equal(liveState.totalSuccesses, 1);
  } finally {
    global.fetch = oldFetch;
    restoreEnv();
    await rm(dir, { recursive: true, force: true });
  }
});

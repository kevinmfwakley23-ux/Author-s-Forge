const test = require("node:test");
const assert = require("node:assert/strict");
const { discoverConfiguredAiModelResources } = require("../.forge-build/infrastructure/ai-model-resources.js");

test("AI resource discovery registers only real configured providers", () => {
  const resources = discoverConfiguredAiModelResources({
    OMNIROUTE_BASE_URL: "http://omni.test",
    OMNIROUTE_MODEL: "omni-model",
    OPENAI_API_KEY: "secret",
    OPENAI_MODEL: "gpt-test",
    OLLAMA_BASE_URL: "http://ollama.test",
    OLLAMA_MODEL: "llama-test",
  });
  assert.deepEqual(resources.map((resource) => `${resource.provider}/${resource.model}`), [
    "omniroute/omni-model",
    "openai/gpt-test",
    "ollama/llama-test",
  ]);
  assert.ok(resources.every((resource) => resource.configured && resource.healthy));
  assert.equal(resources.find((resource) => resource.provider === "openai").capabilities.vision, true);
});

test("AI resource discovery preserves declared model order for real multi-model pools", () => {
  const resources = discoverConfiguredAiModelResources({
    OMNIROUTE_BASE_URL: "http://omni.test",
    OMNIROUTE_MODELS: "writer-fast, writer-deep, writer-fast",
    OPENAI_API_KEY: "secret",
    OPENAI_MODELS: "model-b,model-a",
  });
  assert.deepEqual(resources.map((resource) => `${resource.provider}/${resource.model}`), [
    "omniroute/writer-fast",
    "omniroute/writer-deep",
    "openai/model-b",
    "openai/model-a",
  ]);
});

test("explicit AI model resources attach per-model quota and capability metadata only to configured providers", () => {
  const resources = discoverConfiguredAiModelResources({
    OPENAI_API_KEY: "secret",
    OPENAI_MODELS: "writer-a,writer-b",
    AI_MODEL_RESOURCES_JSON: JSON.stringify([
      { provider: "openai", model: "writer-a", quotaLimit: 10000, usedTokens: 2500, estimatedInputCostPerMillion: 1.25, capabilities: { reasoning: true, contextWindow: 200000 } },
      { provider: "openai", model: "writer-b", quotaLimit: 20000, remainingQuota: 17000, capabilities: { reasoning: false, contextWindow: 128000 } },
    ]),
  });
  const a = resources.find((resource) => resource.model === "writer-a");
  const b = resources.find((resource) => resource.model === "writer-b");
  assert.equal(a.quotaLimit, 10000);
  assert.equal(a.usedTokens, 2500);
  assert.equal(a.estimatedInputCostPerMillion, 1.25);
  assert.equal(a.capabilities.contextWindow, 200000);
  assert.equal(b.quotaLimit, 20000);
  assert.equal(b.remainingQuota, 17000);
  assert.equal(b.capabilities.reasoning, false);
  assert.throws(() => discoverConfiguredAiModelResources({
    AI_MODEL_RESOURCES_JSON: JSON.stringify([{ provider: "openai", model: "unconfigured" }]),
  }), /no configured provider endpoint\/credential/);
});

test("AI resource discovery stays empty when no provider is configured", () => {
  assert.deepEqual(discoverConfiguredAiModelResources({}), []);
});

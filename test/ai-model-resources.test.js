const test = require("node:test");
const assert = require("node:assert/strict");
const {
  discoverConfiguredAiModelResources,
  discoverConfiguredAiProviderQuotas,
} = require("../.forge-build/infrastructure/ai-model-resources.js");

test("AI resource discovery registers only real configured providers without inventing model limits", () => {
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
  const openai = resources.find((resource) => resource.provider === "openai");
  assert.equal(openai.capabilities.creativeWriting, true);
  assert.equal(openai.capabilities.instructionFollowing, true);
  assert.equal(openai.capabilities.vision, undefined);
  assert.equal(openai.capabilities.reasoning, undefined);
  assert.equal(openai.capabilities.contextWindow, undefined);
  assert.equal(openai.capabilities.maxOutputTokens, undefined);
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

test("provider-wide router quota is one shared pool across every configured model", () => {
  const env = {
    OMNIROUTE_BASE_URL: "http://omni.test/v1",
    OMNIROUTE_MODELS: "writer-fast,writer-deep,writer-cheap",
    OMNIROUTE_TOKEN_QUOTA: "10000",
    OMNIROUTE_USED_TOKENS: "2500",
    OMNIROUTE_REMAINING_TOKENS: "7500",
    OMNIROUTE_QUOTA_RESET_AT: "2026-09-05T00:00:00.000Z",
  };
  const resources = discoverConfiguredAiModelResources(env);
  const quotas = discoverConfiguredAiProviderQuotas(env);
  assert.equal(quotas.length, 1);
  assert.deepEqual(quotas[0], {
    scope: "omniroute",
    provider: "omniroute",
    quotaLimit: 10000,
    usedTokens: 2500,
    remainingQuota: 7500,
    quotaResetAt: "2026-09-05T00:00:00.000Z",
  });
  assert.ok(resources.every((resource) => resource.quotaScope === "omniroute"));
  assert.ok(resources.every((resource) => resource.quotaLimit === undefined && resource.remainingQuota === undefined));
});

test("explicit AI model resources attach per-model quota and capability metadata only to configured providers", () => {
  const resources = discoverConfiguredAiModelResources({
    OPENAI_API_KEY: "secret",
    OPENAI_MODELS: "writer-a,writer-b",
    AI_MODEL_RESOURCES_JSON: JSON.stringify([
      { provider: "openai", model: "writer-a", quotaLimit: 10000, usedTokens: 2500, estimatedInputCostPerMillion: 1.25, capabilities: { reasoning: true, contextWindow: 200000, maxOutputTokens: 16000 } },
      { provider: "openai", model: "writer-b", quotaLimit: 20000, remainingQuota: 17000, capabilities: { reasoning: false, contextWindow: 128000 } },
    ]),
  });
  const a = resources.find((resource) => resource.model === "writer-a");
  const b = resources.find((resource) => resource.model === "writer-b");
  assert.equal(a.quotaLimit, 10000);
  assert.equal(a.usedTokens, 2500);
  assert.equal(a.estimatedInputCostPerMillion, 1.25);
  assert.equal(a.capabilities.contextWindow, 200000);
  assert.equal(a.capabilities.maxOutputTokens, 16000);
  assert.equal(a.capabilities.reasoning, true);
  assert.equal(b.quotaLimit, 20000);
  assert.equal(b.remainingQuota, 17000);
  assert.equal(b.capabilities.reasoning, false);
  assert.throws(() => discoverConfiguredAiModelResources({
    AI_MODEL_RESOURCES_JSON: JSON.stringify([{ provider: "openai", model: "unconfigured" }]),
  }), /no configured provider endpoint\/credential/);
});

test("explicit AI model metadata fails closed on fabricated or malformed values", () => {
  const env = { OPENAI_API_KEY: "secret", OPENAI_MODEL: "writer-a" };
  assert.throws(() => discoverConfiguredAiModelResources({
    ...env,
    AI_MODEL_RESOURCES_JSON: JSON.stringify([{ provider: "openai", model: "writer-a", capabilities: { contextWindow: 0 } }]),
  }), /contextWindow must be a positive finite number/);
  assert.throws(() => discoverConfiguredAiModelResources({
    ...env,
    AI_MODEL_RESOURCES_JSON: JSON.stringify([{ provider: "openai", model: "writer-a", capabilities: { vision: "yes" } }]),
  }), /vision must be boolean/);
  assert.throws(() => discoverConfiguredAiModelResources({
    ...env,
    AI_MODEL_RESOURCES_JSON: JSON.stringify([{ provider: "openai", model: "writer-a", capabilities: { imaginaryCapability: true } }]),
  }), /unsupported capability/);
});

test("AI resource discovery stays empty when no provider is configured", () => {
  assert.deepEqual(discoverConfiguredAiModelResources({}), []);
  assert.deepEqual(discoverConfiguredAiProviderQuotas({}), []);
});

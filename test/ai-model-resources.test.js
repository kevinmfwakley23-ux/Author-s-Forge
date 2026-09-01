const test = require("node:test");
const assert = require("node:assert/strict");
const { discoverConfiguredAiModelResources } = require("../.forge-build/infrastructure/ai-model-resources.js");

test("AI resource discovery registers only real configured providers without inventing health evidence", () => {
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
  assert.ok(resources.every((resource) => resource.configured && resource.healthy === undefined));
  assert.equal(resources.find((resource) => resource.provider === "openai").capabilities.vision, true);
});

test("AI resource discovery rejects provider configurations that cannot actually execute", () => {
  const resources = discoverConfiguredAiModelResources({
    KINGS_AI_ENDPOINT: "http://kings.test/v1/responses",
    OPENAI_API_KEY: "key-without-model",
    OLLAMA_BASE_URL: "http://ollama.test",
  });
  assert.deepEqual(resources, []);
});

test("K.I.N.G.S. registers only when both endpoint and model required by its execution bridge are present", () => {
  const resources = discoverConfiguredAiModelResources({
    KINGS_AI_ENDPOINT: "http://kings.test/v1/responses",
    KINGS_AI_MODEL: "kings-coder",
  });
  assert.deepEqual(resources.map((resource) => `${resource.provider}/${resource.model}`), ["kings/kings-coder"]);
});

test("AI resource discovery stays empty when no provider is configured", () => {
  assert.deepEqual(discoverConfiguredAiModelResources({}), []);
});

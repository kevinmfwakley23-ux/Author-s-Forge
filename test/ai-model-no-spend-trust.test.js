const test = require("node:test");
const assert = require("node:assert/strict");
const { applyAiModelRuntimeOptions, validateAiModelRuntimeOptions } = require("../dist/infrastructure/ai-model-options-runtime.js");

function explicit(env) { return JSON.parse(env.AI_MODEL_RESOURCES_JSON || "[]"); }

test("remote free billing label alone does not bypass No Paid Tokens", () => {
  const env = {};
  const untrusted = validateAiModelRuntimeOptions({
    additionalModels: [{ provider: "openrouter", model: "vendor/model:free", billingClass: "free" }],
    trustedNoSpendModels: [],
  });
  applyAiModelRuntimeOptions(untrusted, env);
  assert.equal(explicit(env)[0].billingClass, "unknown");
  assert.equal(env.AI_TRUSTED_NO_SPEND_MODELS, undefined);

  const trusted = validateAiModelRuntimeOptions({
    additionalModels: [{ provider: "openrouter", model: "vendor/model:free", billingClass: "free" }],
    trustedNoSpendModels: ["openrouter/vendor/model:free"],
  }, untrusted);
  applyAiModelRuntimeOptions(trusted, env);
  assert.equal(explicit(env)[0].billingClass, "free");
  assert.equal(env.AI_TRUSTED_NO_SPEND_MODELS, "openrouter/vendor/model:free");
});

test("known local providers retain local classification without redundant trust", () => {
  const env = {};
  const options = validateAiModelRuntimeOptions({
    additionalModels: [
      { provider: "ollama", model: "qwen-local", billingClass: "local" },
      { provider: "kings", model: "kings-local", billingClass: "local" },
    ],
    trustedNoSpendModels: [],
  });
  applyAiModelRuntimeOptions(options, env);
  const resources = explicit(env);
  assert.equal(resources.find((item) => item.provider === "ollama").billingClass, "local");
  assert.equal(resources.find((item) => item.provider === "kings").billingClass, "local");
});

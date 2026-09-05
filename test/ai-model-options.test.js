const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, readFile, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const {
  applyAiModelRuntimeOptions,
  defaultAiModelRuntimeOptions,
  persistAiModelRuntimeOptions,
  validateAiModelRuntimeOptions,
} = require("../dist/infrastructure/ai-model-options-runtime.js");

test("model freedom defaults to a three-worker quality-protected ensemble without forcing paid models", () => {
  const options = defaultAiModelRuntimeOptions("2026-09-04T17:00:00.000Z");
  assert.equal(options.ensembleEnabled, true);
  assert.equal(options.ensembleMaxWorkers, 3);
  assert.equal(options.ensembleMinQualityScore, 80);
  assert.deepEqual(options.additionalModels, []);
  assert.deepEqual(options.trustedNoSpendModels, []);
});

test("model freedom validates broad provider/model additions and bounded quality settings", () => {
  const options = validateAiModelRuntimeOptions({
    additionalModels: [
      { provider: "openrouter", model: "vendor/free-model:free", billingClass: "free" },
      { provider: "ollama", model: "qwen-local", billingClass: "local" },
    ],
    trustedNoSpendModels: ["openrouter/vendor/free-model:free", "9router/free-route"],
    ensembleEnabled: true,
    ensembleMaxWorkers: 6,
    ensembleMinQualityScore: 90,
  });
  assert.equal(options.additionalModels.length, 2);
  assert.equal(options.ensembleMaxWorkers, 6);
  assert.equal(options.ensembleMinQualityScore, 90);
  assert.throws(() => validateAiModelRuntimeOptions({ ensembleMaxWorkers: 9 }), /1 to 8/);
  assert.throws(() => validateAiModelRuntimeOptions({ ensembleMinQualityScore: 69 }), /70 to 100/);
});

test("model freedom augments current choices and never resurrects an old pin", () => {
  const env = {
    OPENROUTER_MODELS: "baseline-router",
    AI_TRUSTED_NO_SPEND_MODELS: "openrouter/baseline-free",
  };
  const first = validateAiModelRuntimeOptions({
    additionalModels: [{ provider: "openrouter", model: "extra-free", billingClass: "free" }],
    trustedNoSpendModels: ["openrouter/extra-free"],
  });
  applyAiModelRuntimeOptions(first, env);
  assert.equal(env.OPENROUTER_MODELS, "baseline-router,extra-free");
  assert.match(env.AI_TRUSTED_NO_SPEND_MODELS, /baseline-free/);
  assert.match(env.AI_TRUSTED_NO_SPEND_MODELS, /extra-free/);

  // Simulate the owner changing the active model/pin outside Model Freedom.
  env.OPENROUTER_MODELS = "new-owner-choice";
  const second = validateAiModelRuntimeOptions({ additionalModels: [], trustedNoSpendModels: [] }, first);
  applyAiModelRuntimeOptions(second, env);
  assert.equal(env.OPENROUTER_MODELS, "new-owner-choice");
  assert.equal(env.AI_TRUSTED_NO_SPEND_MODELS, "openrouter/baseline-free");
});

test("persisted model freedom options are private and durable", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "forge-model-options-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const env = { FORGE_DATA_DIR: root, OLLAMA_MODELS: "existing-local" };
  const saved = persistAiModelRuntimeOptions({
    additionalModels: [{ provider: "ollama", model: "another-local", billingClass: "local" }],
    trustedNoSpendModels: [],
    ensembleEnabled: true,
    ensembleMaxWorkers: 4,
    ensembleMinQualityScore: 85,
  }, env);
  assert.equal(saved.ensembleMaxWorkers, 4);
  assert.equal(env.OLLAMA_MODELS, "existing-local,another-local");
  const disk = JSON.parse(await readFile(join(root, "ai-model-options.json"), "utf8"));
  assert.equal(disk.ensembleMinQualityScore, 85);
  assert.equal(disk.additionalModels[0].model, "another-local");
});

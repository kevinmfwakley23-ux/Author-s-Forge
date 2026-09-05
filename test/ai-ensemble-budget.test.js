const test = require("node:test");
const assert = require("node:assert/strict");
const { runAiTextEnsemble } = require("../dist/application/ai-ensemble.js");
const { validateAiModelRuntimeOptions } = require("../dist/infrastructure/ai-model-options-runtime.js");

function quality(score = 95) { return { version: 1, accepted: true, score, failures: [], warnings: [] }; }
function metered(provider, model) {
  return {
    provider,
    model,
    configured: true,
    healthy: true,
    billingClass: "metered",
    estimatedInputCostPerMillion: 0.1,
    estimatedOutputCostPerMillion: 0.1,
    capabilities: { creativeWriting: true, instructionFollowing: true, longContext: true },
  };
}

test("ensemble total budget can be set and explicitly cleared", () => {
  const first = validateAiModelRuntimeOptions({ ensembleMaxTotalEstimatedCostUsd: 0.05 });
  assert.equal(first.ensembleMaxTotalEstimatedCostUsd, 0.05);
  const cleared = validateAiModelRuntimeOptions({ ensembleMaxTotalEstimatedCostUsd: null }, first);
  assert.equal(cleared.ensembleMaxTotalEstimatedCostUsd, undefined);
  assert.throws(() => validateAiModelRuntimeOptions({ ensembleMaxTotalEstimatedCostUsd: -1 }), /non-negative/);
});

test("total ensemble ceiling divides budget across workers synthesis and both judges", async () => {
  const previousSpend = process.env.AI_SPEND_POLICY;
  const previousCap = process.env.AI_MAX_REQUEST_COST_USD;
  process.env.AI_SPEND_POLICY = "unrestricted";
  delete process.env.AI_MAX_REQUEST_COST_USD;
  const observed = [];
  const generate = async (input) => {
    observed.push({ task: input.task, spendPolicy: input.spendPolicy, cap: input.maxEstimatedRequestCostUsd, system: input.system });
    if (input.system.includes("ENSEMBLE ROLE:")) {
      return { provider: input.preferProvider, model: input.preferModel, text: "Mara waited at the archive threshold because her promise still mattered.", quality: quality(94) };
    }
    if (input.system.includes("ENSEMBLE SYNTHESIZER:")) {
      return { provider: "openai", model: "synth", text: "Mara stopped at the archive threshold. Her promise still mattered, so she waited for her partner before entering.", quality: quality(96) };
    }
    if (input.system.includes("INDEPENDENT ANTI-DRIFT JUDGE.")) {
      return { provider: "openai", model: "judge", text: JSON.stringify({ accepted: true, score: 95, failures: [], warnings: [], evidence: ["Promise preserved."] }), quality: quality(95) };
    }
    throw new Error("Unexpected call");
  };
  try {
    const result = await runAiTextEnsemble({
      system: "Preserve canon and voice.",
      user: "Tighten the scene without changing its meaning.",
      sourceText: "Mara had promised not to enter the archive alone.",
      maxOutputTokens: 1200,
    }, {
      generate,
      resources: [metered("openai", "model-a"), metered("anthropic", "model-b")],
      options: {
        formatVersion: 1,
        additionalModels: [],
        trustedNoSpendModels: [],
        ensembleEnabled: true,
        ensembleMaxWorkers: 2,
        ensembleMinQualityScore: 80,
        ensembleMaxTotalEstimatedCostUsd: 0.05,
        updatedAt: "2026-09-04T17:00:00.000Z",
      },
    });
    // 2 workers + 1 synthesis + 2 judges = 5 reserved calls.
    assert.equal(result.budget.reservedCallCount, 5);
    assert.equal(result.budget.maxTotalEstimatedCostUsd, 0.05);
    assert.equal(result.budget.perCallEstimatedCostCeilingUsd, 0.01);
    assert.equal(result.budget.spendPolicy, "budgeted");
    assert.ok(observed.length >= 5);
    for (const call of observed) {
      assert.equal(call.spendPolicy, "budgeted");
      assert.equal(call.cap, 0.01);
    }
  } finally {
    if (previousSpend === undefined) delete process.env.AI_SPEND_POLICY; else process.env.AI_SPEND_POLICY = previousSpend;
    if (previousCap === undefined) delete process.env.AI_MAX_REQUEST_COST_USD; else process.env.AI_MAX_REQUEST_COST_USD = previousCap;
  }
});

test("no-paid-token policy remains stricter than an ensemble dollar ceiling", async () => {
  const previousSpend = process.env.AI_SPEND_POLICY;
  process.env.AI_SPEND_POLICY = "no-paid-tokens";
  try {
    await assert.rejects(() => runAiTextEnsemble({ system: "Preserve canon.", user: "Draft." }, {
      generate: async () => { throw new Error("Metered provider should never execute."); },
      resources: [metered("openai", "paid-only")],
      options: {
        formatVersion: 1,
        additionalModels: [],
        trustedNoSpendModels: [],
        ensembleEnabled: true,
        ensembleMaxWorkers: 3,
        ensembleMinQualityScore: 80,
        ensembleMaxTotalEstimatedCostUsd: 1,
        updatedAt: "2026-09-04T17:00:00.000Z",
      },
    }), /No AI model is eligible/);
  } finally {
    if (previousSpend === undefined) delete process.env.AI_SPEND_POLICY; else process.env.AI_SPEND_POLICY = previousSpend;
  }
});

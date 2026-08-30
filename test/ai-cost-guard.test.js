import test from "node:test";
import assert from "node:assert/strict";
import { createCostGuardedAiGateway, AiCostGuardError, estimateAiRequestCost } from "../dist/application/ai-cost-guard.js";
import { InMemoryContextOptimizationLedger } from "../dist/application/context-optimization-ledger.js";

test("AI cost estimate is deterministic from policy and request", () => {
  const estimate = estimateAiRequestCost({ model: "test", system: "System rules", user: "Write a short scene." }, {
    inputUsdPerMillionTokens: 2,
    outputUsdPerMillionTokens: 8,
  });
  assert.ok(estimate.inputTokens > 0);
  assert.ok(estimate.estimatedOutputTokens > 0);
  assert.ok(estimate.estimatedCostUsd > 0);
});

test("cost guard blocks requests before provider execution and records the reason", async () => {
  let calls = 0;
  const ledger = new InMemoryContextOptimizationLedger();
  const gateway = createCostGuardedAiGateway({
    gateway: {
      id: "test-provider",
      isConfigured: () => true,
      async generate() { calls += 1; return { text: "should not run", provider: "test-provider", model: "test" }; },
    },
    policy: { maxInputTokens: 1 },
    ledger,
    requestId: () => "guard-test",
  });

  await assert.rejects(() => gateway.generate({ model: "test", user: "This request is deliberately larger than one token." }), (error) => {
    assert.ok(error instanceof AiCostGuardError);
    return true;
  });
  assert.equal(calls, 0);
  assert.equal(ledger.get("guard-test")?.fallbackReason?.includes("input-token limit"), true);
});

test("allowed requests reach the real provider boundary and are observable", async () => {
  const ledger = new InMemoryContextOptimizationLedger();
  const gateway = createCostGuardedAiGateway({
    gateway: {
      id: "test-provider",
      isConfigured: () => true,
      async generate(request) { return { text: `generated:${request.user}`, provider: "test-provider", model: request.model }; },
    },
    policy: { maxInputTokens: 1000, inputUsdPerMillionTokens: 1, outputUsdPerMillionTokens: 2 },
    ledger,
    requestId: () => "allowed-test",
  });

  const result = await gateway.generate({ model: "test-model", user: "Write." });
  assert.equal(result.text, "generated:Write.");
  assert.equal(ledger.get("allowed-test")?.provider, "test-provider");
  assert.equal(ledger.get("allowed-test")?.model, "test-model");
});

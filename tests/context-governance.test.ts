import assert from "node:assert/strict";
import test from "node:test";
import { createContextOptimizationLedgerEntry, deduplicateContextFragments, selectContextFragments } from "../src/application/context-governance";

test("context governance prioritizes canonical and higher tiers within budget", () => {
  const result = selectContextFragments([
    { id: "history", text: "old", tier: "historical", priority: 100 },
    { id: "canon", text: "canon fact", tier: "project", priority: 1, canonical: true },
    { id: "active", text: "current scene", tier: "active", priority: 10 },
  ], { maxInputTokens: 5, reservedSystemTokens: 0, minimumActiveTokens: 1 });
  assert.deepEqual(result.fragments.map((item) => item.id), ["canon", "active"]);
  assert.deepEqual(result.omittedFragmentIds, ["history"]);
});

test("context governance removes duplicate normalized fragments without mutating originals", () => {
  const result = deduplicateContextFragments([
    { id: "a", text: "Same   fact", tier: "project", priority: 1 },
    { id: "b", text: " Same fact ", tier: "historical", priority: 1 },
  ]);
  assert.equal(result.fragments.length, 1);
  assert.deepEqual(result.duplicateFragmentIds, ["b"]);
});

test("optimization ledger derives savings and never reports negative savings", () => {
  const saved = createContextOptimizationLedgerEntry({ requestId: "r1", originalTokens: 100, optimizedTokens: 70, strategies: ["lite"], timestamp: "2026-08-30T00:00:00Z" });
  const inflated = createContextOptimizationLedgerEntry({ requestId: "r2", originalTokens: 10, optimizedTokens: 20, strategies: [], timestamp: "2026-08-30T00:00:00Z" });
  assert.equal(saved.tokensSaved, 30);
  assert.equal(saved.savingsRatio, 0.3);
  assert.equal(inflated.tokensSaved, 0);
  assert.equal(inflated.savingsRatio, 0);
});

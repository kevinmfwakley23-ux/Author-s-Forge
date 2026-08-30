import test from "node:test";
import assert from "node:assert/strict";
import { AiModelBroker } from "../dist/application/ai-model-broker.js";

test("model broker favors creative writing capability for voice preservation", () => {
  const broker = new AiModelBroker();
  broker.setResources([
    { provider: "generic", model: "fast", configured: true, healthy: true, capabilities: { contextWindow: 128000, maxOutputTokens: 16000, reasoning: true } },
    { provider: "creative", model: "prose", configured: true, healthy: true, capabilities: { contextWindow: 200000, maxOutputTokens: 32000, creativeWriting: true, instructionFollowing: true } },
  ]);
  const result = broker.select({ task: "voice-preservation", minimumContextWindow: 100000, requiresCreativeWriting: true, requiresInstructionFollowing: true });
  assert.equal(result.resource.model, "prose");
  assert.ok(result.reasons.includes("creative-writing capable"));
});

test("model broker can prioritize long context for continuity", () => {
  const broker = new AiModelBroker();
  broker.setResources([
    { provider: "short", model: "reasoner", configured: true, healthy: true, capabilities: { contextWindow: 128000, reasoning: true } },
    { provider: "long", model: "context", configured: true, healthy: true, capabilities: { contextWindow: 1000000, longContext: true } },
  ]);
  const result = broker.select({ task: "continuity", minimumContextWindow: 500000 });
  assert.equal(result.resource.model, "context");
  assert.ok(result.reasons.includes("long-context capable"));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { AiModelBroker } from '../dist/application/ai-model-broker.js';

test('AI model broker selects a healthy capable resource', () => {
  const broker = new AiModelBroker();
  broker.setResources([
    { provider: 'expensive', model: 'writer-pro', configured: true, healthy: true, capabilities: { contextWindow: 200000, reasoning: true }, estimatedInputCostPerMillion: 10 },
    { provider: 'local', model: 'writer-local', configured: true, healthy: true, capabilities: { contextWindow: 128000, reasoning: true }, estimatedInputCostPerMillion: 0 },
  ]);
  assert.equal(broker.select({ task: 'writing', requiresReasoning: true }).resource.provider, 'local');
});

test('AI model broker rejects unavailable capabilities', () => {
  const broker = new AiModelBroker();
  broker.setResources([{ provider: 'text', model: 'text-1', configured: true, healthy: true, capabilities: { contextWindow: 32000 } }]);
  assert.throws(() => broker.select({ task: 'vision', requiresVision: true }), /No healthy configured AI model/);
});

test('AI model broker enforces known output, streaming, and cost constraints', () => {
  const broker = new AiModelBroker();
  broker.setResources([
    { provider: 'fast', model: 'small', configured: true, healthy: true, capabilities: { contextWindow: 64000, maxOutputTokens: 4096, streaming: true }, estimatedInputCostPerMillion: 0 },
    { provider: 'pro', model: 'large', configured: true, healthy: true, capabilities: { contextWindow: 200000, maxOutputTokens: 32000, streaming: true, reasoning: true }, estimatedInputCostPerMillion: 3 },
  ]);
  assert.equal(broker.select({ task: 'writing', minimumContextWindow: 100000, minimumOutputTokens: 16000, requiresStreaming: true, maxInputCostPerMillion: 5 }).resource.model, 'large');
});

test('AI model broker does not invent zero capacity when model limits are unknown', () => {
  const broker = new AiModelBroker();
  broker.setResources([
    { provider: 'gateway', model: 'unknown-limits', configured: true, healthy: true, capabilities: { creativeWriting: true, instructionFollowing: true } },
    { provider: 'gateway', model: 'known-too-small', configured: true, healthy: true, capabilities: { contextWindow: 4096, maxOutputTokens: 512, creativeWriting: true, instructionFollowing: true } },
  ]);
  const selected = broker.select({ task: 'writing', minimumContextWindow: 32000, minimumOutputTokens: 2000, requiresInstructionFollowing: true });
  assert.equal(selected.resource.model, 'unknown-limits');
  assert.ok(selected.reasons.includes('context limit unknown; provider validates'));
  assert.ok(selected.reasons.includes('output limit unknown; provider validates'));
});

test('AI model broker rejects a model when real metadata proves its limits are insufficient', () => {
  const broker = new AiModelBroker();
  broker.setResources([{ provider: 'gateway', model: 'small', configured: true, healthy: true, capabilities: { contextWindow: 4096, maxOutputTokens: 512 } }]);
  assert.throws(() => broker.select({ task: 'editing', minimumContextWindow: 32000, minimumOutputTokens: 2000 }), /No healthy configured AI model/);
});

test('AI model broker honors explicit model preference', () => {
  const broker = new AiModelBroker();
  broker.setResources([
    { provider: 'gateway', model: 'alpha', configured: true, healthy: true, capabilities: { contextWindow: 128000 } },
    { provider: 'gateway', model: 'beta', configured: true, healthy: true, capabilities: { contextWindow: 128000 } },
  ]);
  assert.equal(broker.select({ task: 'editing', preferModel: 'beta' }).resource.model, 'beta');
});

test('AI model broker preserves declared resource order for otherwise equal candidates', () => {
  const broker = new AiModelBroker();
  broker.setResources([
    { provider: 'gateway', model: 'z-first-declared', configured: true, healthy: true, capabilities: {} },
    { provider: 'gateway', model: 'a-second-declared', configured: true, healthy: true, capabilities: {} },
  ]);
  assert.equal(broker.select({ task: 'editing' }).resource.model, 'z-first-declared');
});

test('AI model broker protects a safety reserve before a near-limit request', () => {
  const broker = new AiModelBroker();
  broker.setResources([
    { provider: 'nearly-full', model: 'a', configured: true, healthy: true, capabilities: { contextWindow: 128000 }, remainingQuota: 1000, quotaLimit: 10000 },
    { provider: 'available', model: 'b', configured: true, healthy: true, capabilities: { contextWindow: 128000 }, remainingQuota: 9000, quotaLimit: 10000 },
  ]);
  assert.equal(broker.select({ task: 'writing', estimatedInputTokens: 850 }).resource.provider, 'available');
});

test('AI model broker protects output tokens in the quota reserve calculation', () => {
  const broker = new AiModelBroker();
  broker.setResources([
    { provider: 'near', model: 'a', configured: true, healthy: true, capabilities: { contextWindow: 128000, maxOutputTokens: 1000 }, remainingQuota: 1500, quotaLimit: 10000 },
    { provider: 'safe', model: 'b', configured: true, healthy: true, capabilities: { contextWindow: 128000, maxOutputTokens: 1000 }, remainingQuota: 9000, quotaLimit: 10000 },
  ]);
  assert.equal(broker.select({ task: 'writing', estimatedInputTokens: 200, estimatedOutputTokens: 900, quotaSafetyFraction: .05 }).resource.provider, 'safe');
});

test('AI model broker enforces one shared provider quota across multiple models', () => {
  const broker = new AiModelBroker();
  broker.setResources([
    { provider: 'omniroute', model: 'writer-a', configured: true, healthy: true, quotaScope: 'omniroute', capabilities: { contextWindow: 128000 } },
    { provider: 'omniroute', model: 'writer-b', configured: true, healthy: true, quotaScope: 'omniroute', capabilities: { contextWindow: 128000 } },
    { provider: 'backup', model: 'safe', configured: true, healthy: true, capabilities: { contextWindow: 128000 } },
  ]);
  broker.setProviderQuotas([{ scope: 'omniroute', provider: 'omniroute', quotaLimit: 10000, usedTokens: 8500, remainingQuota: 1500 }]);
  const selected = broker.select({ task: 'writing', estimatedInputTokens: 400, estimatedOutputTokens: 600, quotaSafetyFraction: .1 });
  assert.equal(selected.resource.provider, 'backup');
});

test('shared provider quota consumes runtime usage from every model in the pool', () => {
  const broker = new AiModelBroker();
  broker.setResources([
    { provider: 'omniroute', model: 'writer-a', configured: true, healthy: true, quotaScope: 'omniroute', capabilities: {} },
    { provider: 'omniroute', model: 'writer-b', configured: true, healthy: true, quotaScope: 'omniroute', capabilities: {} },
  ]);
  broker.setProviderQuotas([{ scope: 'omniroute', provider: 'omniroute', quotaLimit: 10000, usedTokens: 2000, remainingQuota: 8000 }]);
  broker.applyRoutingTelemetry([
    { provider: 'omniroute', model: 'writer-a', consecutiveFailures: 0, totalTokens: 1200 },
    { provider: 'omniroute', model: 'writer-b', consecutiveFailures: 0, totalTokens: 800 },
  ]);
  assert.deepEqual(broker.listProviderQuotas(), [{ scope: 'omniroute', provider: 'omniroute', quotaLimit: 10000, usedTokens: 4000, remainingQuota: 6000 }]);
});

test('AI model broker avoids a provider in cooldown', () => {
  const broker = new AiModelBroker();
  broker.setResources([
    { provider: 'cooling', model: 'a', configured: true, healthy: true, cooldownUntil: '2030-01-01T00:00:00Z', capabilities: { contextWindow: 128000 } },
    { provider: 'ready', model: 'b', configured: true, healthy: true, capabilities: { contextWindow: 128000 } },
  ]);
  assert.equal(broker.select({ task: 'editing', now: '2029-01-01T00:00:00Z' }).resource.provider, 'ready');
});

test('AI model broker penalizes repeated failures and high latency', () => {
  const broker = new AiModelBroker();
  broker.setResources([
    { provider: 'flaky', model: 'a', configured: true, healthy: true, consecutiveFailures: 3, latencyMs: 3000, capabilities: { contextWindow: 128000 } },
    { provider: 'stable', model: 'b', configured: true, healthy: true, consecutiveFailures: 0, latencyMs: 100, capabilities: { contextWindow: 128000 } },
  ]);
  assert.equal(broker.select({ task: 'editing' }).resource.provider, 'stable');
});

test('AI model broker rotates toward the less-used eligible model before exhaustion', () => {
  const broker = new AiModelBroker();
  broker.setResources([
    { provider: 'gateway', model: 'alpha', configured: true, healthy: true, usedTokens: 12000, capabilities: { contextWindow: 128000 } },
    { provider: 'gateway', model: 'beta', configured: true, healthy: true, usedTokens: 1000, capabilities: { contextWindow: 128000 } },
  ]);
  const selected = broker.select({ task: 'editing' });
  assert.equal(selected.resource.model, 'beta');
  assert.ok(selected.reasons.some((reason) => reason.includes('usage balance')));
});

test('AI model broker combines static remaining quota with live accounted usage', () => {
  const broker = new AiModelBroker();
  broker.setResources([
    { provider: 'gateway', model: 'alpha', configured: true, healthy: true, quotaLimit: 10000, remainingQuota: 9000, usedTokens: 7500, capabilities: { contextWindow: 128000 } },
    { provider: 'gateway', model: 'beta', configured: true, healthy: true, quotaLimit: 10000, remainingQuota: 5000, usedTokens: 1000, capabilities: { contextWindow: 128000 } },
  ]);
  assert.equal(broker.select({ task: 'editing', estimatedInputTokens: 1500, quotaSafetyFraction: .1 }).resource.model, 'beta');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { AiModelBroker } from '../dist/application/ai-model-broker.js';

test('AI model broker selects a healthy capable resource', () => {
  const broker = new AiModelBroker();
  broker.setResources([
    { provider: 'expensive', model: 'writer-pro', configured: true, healthy: true, capabilities: { contextWindow: 200000, reasoning: true }, estimatedInputCostPerMillion: 10 },
    { provider: 'local', model: 'writer-local', configured: true, healthy: true, capabilities: { contextWindow: 128000, reasoning: true }, estimatedInputCostPerMillion: 0 },
  ]);
  const selected = broker.select({ task: 'writing', requiresReasoning: true });
  assert.equal(selected.resource.provider, 'local');
});

test('AI model broker rejects unavailable capabilities', () => {
  const broker = new AiModelBroker();
  broker.setResources([{ provider: 'text', model: 'text-1', configured: true, healthy: true, capabilities: { contextWindow: 32000 } }]);
  assert.throws(() => broker.select({ task: 'vision', requiresVision: true }), /No healthy configured AI model/);
});

test('AI model broker enforces output, streaming, and cost constraints', () => {
  const broker = new AiModelBroker();
  broker.setResources([
    { provider: 'fast', model: 'small', configured: true, healthy: true, capabilities: { contextWindow: 64000, maxOutputTokens: 4096, streaming: true }, estimatedInputCostPerMillion: 0 },
    { provider: 'pro', model: 'large', configured: true, healthy: true, capabilities: { contextWindow: 200000, maxOutputTokens: 32000, streaming: true, reasoning: true }, estimatedInputCostPerMillion: 3 },
  ]);
  const selected = broker.select({ task: 'writing', minimumContextWindow: 100000, minimumOutputTokens: 16000, requiresStreaming: true, maxInputCostPerMillion: 5 });
  assert.equal(selected.resource.model, 'large');
});

test('AI model broker honors explicit model preference after eligibility filtering', () => {
  const broker = new AiModelBroker();
  broker.setResources([
    { provider: 'gateway', model: 'alpha', configured: true, healthy: true, capabilities: { contextWindow: 128000 } },
    { provider: 'gateway', model: 'beta', configured: true, healthy: true, capabilities: { contextWindow: 128000 } },
  ]);
  const selected = broker.select({ task: 'editing', preferModel: 'beta' });
  assert.equal(selected.resource.model, 'beta');
});

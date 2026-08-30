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

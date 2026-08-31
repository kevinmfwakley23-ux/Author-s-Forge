import test from 'node:test';
import assert from 'node:assert/strict';
import { AiModelBroker } from '../dist/application/ai-model-broker.js';
import { estimateRequestCost, rankCostConsciousCandidates } from '../dist/application/ai-cost-routing-policy.js';

function broker() {
  const broker = new AiModelBroker();
  broker.setResources([
    { provider: 'budget', model: 'writer-lite', configured: true, healthy: true, estimatedInputCostPerMillion: 0.2, estimatedOutputCostPerMillion: 0.8, capabilities: { contextWindow: 128000, maxOutputTokens: 16000, creativeWriting: true, instructionFollowing: true } },
    { provider: 'premium', model: 'writer-pro', configured: true, healthy: true, estimatedInputCostPerMillion: 8, estimatedOutputCostPerMillion: 24, capabilities: { contextWindow: 200000, maxOutputTokens: 32000, creativeWriting: true, instructionFollowing: true, reasoning: true, longContext: true } },
  ]);
  return broker;
}

test('Mission 062 economy routing prefers the cheaper eligible creative model', () => {
  const request = { task: 'writing', requiresCreativeWriting: true, requiresInstructionFollowing: true, estimatedInputTokens: 12000, estimatedOutputTokens: 2500 };
  const ranked = rankCostConsciousCandidates(broker().rank(request), request);
  assert.equal(ranked[0].selection.resource.provider, 'budget');
  assert.equal(ranked[0].routingMode, 'economy');
  assert.ok(ranked[0].estimatedRequestCostUsd < ranked[1].estimatedRequestCostUsd);
  assert.ok(ranked[0].reasons.some((reason) => reason.includes('estimated request cost')));
});

test('Mission 062 quality routing can favor richer capability when explicitly requested', () => {
  const request = { task: 'writing', requiresCreativeWriting: true, requiresInstructionFollowing: true, estimatedInputTokens: 12000, estimatedOutputTokens: 2500, routingMode: 'quality' };
  const ranked = rankCostConsciousCandidates(broker().rank(request), request);
  assert.equal(ranked[0].selection.resource.provider, 'premium');
  assert.equal(ranked[0].routingMode, 'quality');
});

test('Mission 062 cost estimate uses input and output token rates', () => {
  const value = estimateRequestCost({ provider: 'x', model: 'y', configured: true, capabilities: {}, estimatedInputCostPerMillion: 2, estimatedOutputCostPerMillion: 10 }, 100000, 20000);
  assert.equal(value, 0.4);
});

test('Mission 062 preserves broker hard cost ceilings before reranking', () => {
  const request = { task: 'writing', requiresCreativeWriting: true, maxInputCostPerMillion: 1, maxOutputCostPerMillion: 2, estimatedInputTokens: 4000, estimatedOutputTokens: 1000 };
  const candidates = broker().rank(request);
  assert.deepEqual(candidates.map((item) => item.resource.provider), ['budget']);
  const ranked = rankCostConsciousCandidates(candidates, request);
  assert.deepEqual(ranked.map((item) => item.selection.resource.provider), ['budget']);
});

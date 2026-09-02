const test = require('node:test');
const assert = require('node:assert/strict');
const { AiModelBroker } = require('../dist/application/ai-model-broker.js');

const base = (provider, model, billingClass, extra = {}) => ({
  provider,
  model,
  billingClass,
  configured: true,
  healthy: true,
  capabilities: { creativeWriting: true, instructionFollowing: true },
  ...extra,
});

test('no-paid-tokens excludes metered and unknown resources', () => {
  const broker = new AiModelBroker();
  broker.setResources([
    base('openai', 'paid-model', 'metered', { estimatedInputCostPerMillion: 1, estimatedOutputCostPerMillion: 2 }),
    base('groq', 'unknown-tier', 'unknown'),
    base('ollama', 'local-model', 'local'),
  ]);
  const ranked = broker.rank({ task: 'writing', spendPolicy: 'no-paid-tokens', requiresCreativeWriting: true, requiresInstructionFollowing: true });
  assert.deepEqual(ranked.map((item) => `${item.resource.provider}/${item.resource.model}`), ['ollama/local-model']);
});

test('no-paid-tokens refuses a metered-only configuration', () => {
  const broker = new AiModelBroker();
  broker.setResources([base('openai', 'paid-model', 'metered')]);
  assert.throws(() => broker.select({ task: 'writing', spendPolicy: 'no-paid-tokens' }), /spend policy/i);
});

test('budgeted policy requires known cost and respects per-request cap', () => {
  const broker = new AiModelBroker();
  broker.setResources([
    base('openai', 'cheap', 'metered', { estimatedInputCostPerMillion: 1, estimatedOutputCostPerMillion: 2 }),
    base('openai', 'unknown-cost', 'metered'),
  ]);
  const ranked = broker.rank({
    task: 'writing',
    spendPolicy: 'budgeted',
    maxEstimatedRequestCostUsd: 0.01,
    estimatedInputTokens: 1000,
    estimatedOutputTokens: 1000,
  });
  assert.deepEqual(ranked.map((item) => item.resource.model), ['cheap']);
  assert.equal(broker.rank({ task: 'writing', spendPolicy: 'budgeted', maxEstimatedRequestCostUsd: 0.001, estimatedInputTokens: 1000, estimatedOutputTokens: 1000 }).length, 0);
});

test('explicit trusted no-spend model can be allowed without pretending the whole provider is free', () => {
  const broker = new AiModelBroker();
  broker.setResources([base('groq', 'free-tier-model', 'unknown')]);
  const selected = broker.select({ task: 'writing', spendPolicy: 'no-paid-tokens', trustedNoSpendModels: ['groq/free-tier-model'] });
  assert.equal(selected.resource.model, 'free-tier-model');
});

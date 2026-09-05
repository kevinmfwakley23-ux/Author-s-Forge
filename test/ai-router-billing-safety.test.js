const test = require('node:test');
const assert = require('node:assert/strict');
const { AiModelBroker } = require('../dist/application/ai-model-broker.js');
const { discoverConfiguredAiModelResources } = require('../dist/infrastructure/ai-model-resources.js');

test('router discovery fails closed and does not invent a generic 9Router auto model', () => {
  const resources = discoverConfiguredAiModelResources({
    OMNIROUTE_BASE_URL: 'http://omni.test/v1',
    ROUTER9_BASE_URL: 'http://router9.test/v1',
    OLLAMA_BASE_URL: 'http://ollama.test',
    OLLAMA_MODEL: 'local-writer',
  });
  const omni = resources.find((resource) => resource.provider === 'omniroute');
  const router9 = resources.find((resource) => resource.provider === '9router');
  assert.equal(omni.model, 'auto', 'OmniRoute explicitly supports its documented auto model');
  assert.equal(omni.billingClass, 'gateway-managed');
  assert.equal(router9, undefined, '9Router requires a real model/combo id from configuration or the live catalog');

  const broker = new AiModelBroker();
  broker.setResources(resources);
  const ranked = broker.rank({ task: 'writing', spendPolicy: 'no-paid-tokens' });
  assert.deepEqual(ranked.map((item) => `${item.resource.provider}/${item.resource.model}`), ['ollama/local-writer']);
});

test('configured 9Router model remains gateway-managed and blocked from no-paid routing by default', () => {
  const resources = discoverConfiguredAiModelResources({
    ROUTER9_BASE_URL: 'http://router9.test/v1',
    ROUTER9_MODEL: 'premium-coding',
  });
  const router9 = resources.find((resource) => resource.provider === '9router');
  assert.equal(router9.model, 'premium-coding');
  assert.equal(router9.billingClass, 'gateway-managed');
  const broker = new AiModelBroker();
  broker.setResources(resources);
  assert.throws(() => broker.select({ task: 'writing', spendPolicy: 'no-paid-tokens' }), /spend policy/i);
});

test('owner may explicitly mark a router endpoint subscription-covered after configuring it that way', () => {
  const resources = discoverConfiguredAiModelResources({
    OMNIROUTE_BASE_URL: 'http://omni.test/v1',
    OMNIROUTE_MODEL: 'subscription-only-route',
    OMNIROUTE_BILLING_CLASS: 'subscription',
  });
  const broker = new AiModelBroker();
  broker.setResources(resources);
  const selected = broker.select({ task: 'writing', spendPolicy: 'no-paid-tokens' });
  assert.equal(selected.resource.provider, 'omniroute');
  assert.equal(selected.resource.billingClass, 'subscription');
});

test('owner may trust one router model without declaring the whole gateway free', () => {
  const resources = discoverConfiguredAiModelResources({
    ROUTER9_BASE_URL: 'http://router9.test/v1',
    ROUTER9_MODEL: 'free-only-combo',
  });
  const broker = new AiModelBroker();
  broker.setResources(resources);
  assert.throws(() => broker.select({ task: 'writing', spendPolicy: 'no-paid-tokens' }), /spend policy/i);
  const selected = broker.select({ task: 'writing', spendPolicy: 'no-paid-tokens', trustedNoSpendModels: ['9router/free-only-combo'] });
  assert.equal(selected.resource.model, 'free-only-combo');
});
import test from 'node:test';
import assert from 'node:assert/strict';
import { AiModelBroker } from '../dist/application/ai-model-broker.js';
import { AiFederation } from '../dist/application/ai-federation.js';

test('federation exposes ordered eligible candidates', () => {
  const broker = new AiModelBroker();
  broker.setResources([
    {provider:'a',model:'one',configured:true,healthy:true,capabilities:{contextWindow:128000}},
    {provider:'b',model:'two',configured:true,healthy:true,capabilities:{contextWindow:128000}}
  ]);
  const plan = new AiFederation(broker).plan({task:'writing'}, 2);
  assert.equal(plan.guarantee,'available-candidate');
  assert.equal(plan.candidates.length,2);
  assert.equal(plan.maxAttempts,2);
});

test('federation truthfully reports no eligible AI', () => {
  const broker = new AiModelBroker();
  broker.setResources([{provider:'offline',model:'x',configured:true,healthy:false,capabilities:{}}]);
  const plan = new AiFederation(broker).plan({task:'writing'});
  assert.equal(plan.guarantee,'no-eligible-candidate');
});

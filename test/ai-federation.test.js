const test = require('node:test');
const assert = require('node:assert/strict');
const { AiModelBroker } = require('../dist/application/ai-model-broker.js');
const { AiFederation } = require('../dist/application/ai-federation.js');

test('federation plans ordered eligible candidates', () => {
  const broker = new AiModelBroker();
  broker.setResources([
    { provider:'a', model:'one', configured:true, healthy:true, capabilities:{contextWindow:128000} },
    { provider:'b', model:'two', configured:true, healthy:true, capabilities:{contextWindow:128000} }
  ]);
  const plan = new AiFederation(broker).plan({task:'writing'}, 2);
  assert.equal(plan.guarantee, 'available-candidate');
  assert.equal(plan.candidates.length, 2);
  assert.equal(plan.maxAttempts, 2);
});

test('federation reports no eligible candidate truthfully', () => {
  const broker = new AiModelBroker();
  broker.setResources([{ provider:'offline', model:'x', configured:true, healthy:false, capabilities:{} }]);
  const plan = new AiFederation(broker).plan({task:'writing'});
  assert.equal(plan.guarantee, 'no-eligible-candidate');
});

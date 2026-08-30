const test = require('node:test');
const assert = require('node:assert/strict');
const { ContextOptimizationService } = require('../dist/application/context-optimization-service');

test('optimization service records measurable savings', () => {
  const service = new ContextOptimizationService();
  const result = service.optimize({
    requestId: 'ctx-1',
    kind: 'text',
    text: 'alpha   beta\n\nalpha   beta\n\n\n',
  });
  assert.equal(result.fallback, false);
  assert.ok(result.optimizedEstimatedTokens <= result.originalEstimatedTokens);
  assert.equal(service.getLedger().get('ctx-1').tokensSaved, result.tokensSaved);
});

test('optimization service never reports token inflation as savings', () => {
  const service = new ContextOptimizationService();
  const result = service.optimize({ requestId: 'ctx-2', kind: 'text', text: 'a b' });
  const ledger = service.getLedger().get('ctx-2');
  assert.ok(ledger.optimizedEstimatedTokens <= ledger.originalEstimatedTokens);
  assert.equal(result.tokensSaved, ledger.tokensSaved);
});

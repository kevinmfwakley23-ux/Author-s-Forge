const test = require('node:test');
const assert = require('node:assert/strict');
const { createForgeCore } = require('../dist/application/forge-core.js');
const { inspectForgeCore } = require('../dist/application/forge-core-health.js');

test('core health reports configured AI as ready', () => {
  const core = createForgeCore();
  core.registerAiModels([{ provider:'test', model:'model', configured:true, healthy:true, capabilities:{} }]);
  const report = inspectForgeCore(core, '2026-08-30T00:00:00.000Z');
  assert.equal(report.status, 'ready');
  assert.equal(report.aiModels, 1);
  assert.equal(report.checkedAt, '2026-08-30T00:00:00.000Z');
});

test('core health reports missing AI capacity as degraded', () => {
  const report = inspectForgeCore(createForgeCore(), '2026-08-30T00:00:00.000Z');
  assert.equal(report.status, 'degraded');
  assert.equal(report.aiModels, 0);
});

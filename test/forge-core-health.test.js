const test = require('node:test');
const assert = require('node:assert/strict');
const { createForgeCore } = require('../.forge-build/application/forge-core.js');
const { inspectForgeCore } = require('../.forge-build/application/forge-core-health.js');

function projectStore() {
  return { async create() {}, async load() { return null; }, async save() {}, async exists() { return false; } };
}

test('core health reports configured AI and durable storage as ready', () => {
  const core = createForgeCore({ projectStore: projectStore() });
  core.registerAiModels([{ provider:'test', model:'model', configured:true, healthy:true, capabilities:{} }]);
  const report = inspectForgeCore(core, '2026-08-30T00:00:00.000Z');
  assert.equal(report.status, 'ready');
  assert.equal(report.aiModels, 1);
  assert.equal(report.checkedAt, '2026-08-30T00:00:00.000Z');
  assert.equal(report.checks.find((check) => check.name === 'durable-project-store').ok, true);
});

test('core health reports missing AI capacity or durable storage as degraded', () => {
  const report = inspectForgeCore(createForgeCore(), '2026-08-30T00:00:00.000Z');
  assert.equal(report.status, 'degraded');
  assert.equal(report.aiModels, 0);
  assert.equal(report.checks.find((check) => check.name === 'durable-project-store').ok, false);
});

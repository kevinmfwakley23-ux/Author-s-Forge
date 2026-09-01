const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { createForgeStudioRuntime } = require('../.forge-build/infrastructure/forge-studio-runtime.js');
const { createDefaultForgeCoreRuntime } = require('../.forge-build/infrastructure/forge-core-runtime.js');

test('Studio composition binds one durable project store and core-routed AI boundary directly into Forge Core', async () => {
  const root = await mkdtemp(join(tmpdir(), 'forge-core-runtime-'));
  try {
    const runtime = createForgeStudioRuntime(root, {});
    assert.strictEqual(runtime.core.projectStore, runtime.projectStore);
    assert.equal(typeof runtime.generateText, 'function');
    assert.equal(runtime.core.readiness().projectStoreAvailable, true);
    assert.equal(runtime.core.readiness().aiConfigured, false);
    assert.equal(runtime.core.readiness().aiOperational, false);
    await assert.rejects(() => runtime.generateText({ system: 'system', user: 'write' }), /No AI provider is configured/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('configured Studio AI is eligible to try but not operational until real execution establishes health evidence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'forge-core-health-evidence-'));
  try {
    const runtime = createForgeStudioRuntime(root, { OPENAI_API_KEY: 'configured-key', OPENAI_MODEL: 'configured-model' });
    assert.equal(runtime.core.readiness().aiConfigured, true);
    assert.equal(runtime.core.readiness().aiOperational, false);
    assert.equal(runtime.core.readiness().ready, false);

    const result = await runtime.core.executeAi({ task: 'writing', input: 'health-check', maxAttempts: 1 }, async (_input, context) => context.resource.model);
    assert.equal(result.value, 'configured-model');
    assert.equal(runtime.core.readiness().aiOperational, true);
    assert.equal(runtime.core.readiness().operationalModelCount, 1);
    assert.equal(runtime.core.readiness().ready, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('Forge Core compatibility runtime delegates to the canonical Studio composition', () => {
  const runtime = createDefaultForgeCoreRuntime('/tmp/author-forge-runtime-test');
  assert.ok(runtime.projectStore);
  assert.equal(runtime.readiness().projectStoreAvailable, true);
});

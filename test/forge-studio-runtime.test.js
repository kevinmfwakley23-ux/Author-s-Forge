const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { createForgeStudioRuntime } = require('../.forge-build/infrastructure/forge-studio-runtime.js');
const { createDefaultForgeCoreRuntime } = require('../.forge-build/infrastructure/forge-core-runtime.js');

test('Studio composition binds one durable project store directly into Forge Core', async () => {
  const root = await mkdtemp(join(tmpdir(), 'forge-core-runtime-'));
  try {
    const runtime = createForgeStudioRuntime(root, {});
    assert.strictEqual(runtime.core.projectStore, runtime.projectStore);
    assert.equal(runtime.core.readiness().projectStoreAvailable, true);
    assert.equal(runtime.core.readiness().aiConfigured, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('Forge Core compatibility runtime delegates to the canonical Studio composition', () => {
  const runtime = createDefaultForgeCoreRuntime('/tmp/author-forge-runtime-test');
  assert.ok(runtime.projectStore);
  assert.equal(runtime.readiness().projectStoreAvailable, true);
});

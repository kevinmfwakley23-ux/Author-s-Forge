const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { refreshPersistedAiOwnerControl, constrainResourcesForOwnerPin } = require('../dist/infrastructure/ai-owner-control-runtime.js');

test('durable owner AI control applies spend mode and an exact provider/model pin', () => {
  const dir = mkdtempSync(join(tmpdir(), 'forge-ai-owner-'));
  const env = { FORGE_DATA_DIR: dir };
  writeFileSync(join(dir, 'ai-runtime-control.json'), JSON.stringify({
    formatVersion: 1,
    spendPolicy: 'no-paid-tokens',
    routingMode: 'quality',
    providerOrder: ['ollama', 'openai'],
    pinnedProvider: 'ollama',
    pinnedModel: 'qwen-test',
    updatedAt: new Date().toISOString(),
  }));
  try {
    const control = refreshPersistedAiOwnerControl(env);
    assert.equal(env.AI_SPEND_POLICY, 'no-paid-tokens');
    assert.equal(env.AI_ROUTING_MODE, 'quality');
    assert.equal(env.AI_PINNED_PROVIDER, 'ollama');
    assert.equal(env.AI_PINNED_MODEL, 'qwen-test');
    assert.equal(env.AI_PROVIDER_ORDER.split(',')[0], 'ollama');
    const resources = constrainResourcesForOwnerPin([
      { provider: 'openai', model: 'paid', configured: true, capabilities: {} },
      { provider: 'ollama', model: 'other', configured: true, capabilities: {} },
      { provider: 'ollama', model: 'qwen-test', configured: true, capabilities: {} },
    ], control);
    assert.deepEqual(resources.map((resource) => `${resource.provider}/${resource.model}`), ['ollama/qwen-test']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('corrupt owner control fails closed to No Paid Tokens and clears a stale pin', () => {
  const dir = mkdtempSync(join(tmpdir(), 'forge-ai-owner-corrupt-'));
  const env = { FORGE_DATA_DIR: dir, AI_PINNED_PROVIDER: 'openai', AI_PINNED_MODEL: 'stale', AI_SPEND_POLICY: 'unrestricted' };
  writeFileSync(join(dir, 'ai-runtime-control.json'), '{not-json');
  try {
    const control = refreshPersistedAiOwnerControl(env);
    assert.equal(control.spendPolicy, 'no-paid-tokens');
    assert.equal(env.AI_SPEND_POLICY, 'no-paid-tokens');
    assert.equal(env.AI_PINNED_PROVIDER, undefined);
    assert.equal(env.AI_PINNED_MODEL, undefined);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

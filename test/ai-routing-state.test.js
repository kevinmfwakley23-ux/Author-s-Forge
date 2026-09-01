import test from 'node:test';
import assert from 'node:assert/strict';
import { AiRoutingState } from '../dist/application/ai-routing-state.js';

test('routing state records success, usage, and resets failure streak', () => {
  const state = new AiRoutingState();
  state.hydrate([{ provider: 'gateway', model: 'writer', configured: true, healthy: true, capabilities: {}, usedTokens: 100 }], '2026-01-01T00:00:00.000Z');
  state.recordFailure('gateway', 'writer', new Error('timeout'), '2026-01-01T00:01:00.000Z', 30000);
  state.recordSuccess('gateway', 'writer', 120, 500, '2026-01-01T00:02:00.000Z');
  const current = state.get('gateway', 'writer');
  assert.equal(current.consecutiveFailures, 0);
  assert.equal(current.totalFailures, 1);
  assert.equal(current.totalSuccesses, 1);
  assert.equal(current.totalTokens, 600);
  assert.equal(current.lastLatencyMs, 120);
  assert.equal(current.cooldownUntil, undefined);
});

test('routing state derives initial used tokens from quota limit and remaining quota', () => {
  const state = new AiRoutingState();
  state.hydrate([{ provider: 'gateway', model: 'writer', configured: true, healthy: true, capabilities: {}, quotaLimit: 10000, remainingQuota: 7600 }], '2026-01-01T00:00:00.000Z');
  assert.equal(state.get('gateway', 'writer').totalTokens, 2400);
  state.recordSuccess('gateway', 'writer', 50, 125, '2026-01-01T00:01:00.000Z');
  assert.equal(state.get('gateway', 'writer').totalTokens, 2525);
});

test('routing state prefers explicit used-token baseline when both usage forms exist', () => {
  const state = new AiRoutingState();
  state.hydrate([{ provider: 'gateway', model: 'writer', configured: true, healthy: true, capabilities: {}, quotaLimit: 10000, remainingQuota: 7600, usedTokens: 3000 }], '2026-01-01T00:00:00.000Z');
  assert.equal(state.get('gateway', 'writer').totalTokens, 3000);
});

test('routing state accumulates failure streak and cooldown', () => {
  const state = new AiRoutingState();
  state.recordFailure('x', 'm', 'rate limited', '2026-01-01T00:00:00.000Z', 60000);
  const current = state.get('x', 'm');
  assert.equal(current.consecutiveFailures, 1);
  assert.equal(current.totalFailures, 1);
  assert.equal(current.lastError, 'rate limited');
  assert.equal(current.cooldownUntil, '2026-01-01T00:01:00.000Z');
});

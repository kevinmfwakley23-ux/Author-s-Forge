import test from 'node:test';
import assert from 'node:assert/strict';
import { AiRoutingState } from '../dist/application/ai-routing-state.js';

test('routing state snapshots restore deterministically', () => {
  const state = new AiRoutingState();
  state.recordFailure('z','m',new Error('timeout'),'2026-08-30T00:00:00.000Z',5000);
  state.recordUsage('a','m',50,'2026-08-30T00:00:01.000Z');
  const snapshot = state.createSnapshot();
  assert.deepEqual(snapshot.states.map(x => `${x.provider}/${x.model}`), ['a/m','z/m']);
  const restored = new AiRoutingState();
  restored.restore(snapshot);
  assert.deepEqual(restored.createSnapshot(), snapshot);
});

test('routing state rejects invalid snapshots', () => {
  const state = new AiRoutingState();
  assert.throws(() => state.restore({formatVersion:999,states:[]}), /Unsupported AI routing state format/);
  assert.throws(() => state.restore({formatVersion:1,states:[{provider:'',model:'m',consecutiveFailures:0,totalFailures:0,totalSuccesses:0,totalTokens:0,updatedAt:'2026-08-30T00:00:00.000Z'}]}), /requires provider and model/);
});

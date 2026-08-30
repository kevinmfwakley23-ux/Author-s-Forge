import assert from 'node:assert/strict';
import test from 'node:test';
import { CompressionEngineRegistry, type CompressionEngine } from '../.forge-build/application/compression-engine.js';

const whitespaceEngine: CompressionEngine = {
  id: 'test-whitespace',
  priority: 10,
  targets: ['messages'],
  compress(input) {
    const content = input.content.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    const inputTokens = Math.ceil(input.content.length / 4);
    const outputTokens = Math.ceil(content.length / 4);
    return { content, changed: content !== input.content, estimatedInputTokens: inputTokens, estimatedOutputTokens: outputTokens, engineId: 'test-whitespace' };
  },
};

test('compression registry orders engines by priority and applies measurable savings', () => {
  const registry = new CompressionEngineRegistry([whitespaceEngine]);
  assert.deepEqual(registry.list('messages').map((engine) => engine.id), ['test-whitespace']);
  const result = registry.compress({ target: 'messages', content: 'hello     world\n\n\nagain' });
  assert.equal(result.changed, true);
  assert.equal(result.content, 'hello world\n\nagain');
  assert.ok(result.estimatedOutputTokens < result.estimatedInputTokens);
});

test('compression registry fails open when an engine throws', () => {
  const registry = new CompressionEngineRegistry([{
    id: 'broken',
    priority: 1,
    targets: ['messages'],
    compress() { throw new Error('boom'); },
  }]);
  const result = registry.compress({ target: 'messages', content: 'canonical text' });
  assert.equal(result.changed, false);
  assert.equal(result.content, 'canonical text');
  assert.equal(result.engineId, 'none');
});

test('compression registry never replaces content with a larger result', () => {
  const registry = new CompressionEngineRegistry([{
    id: 'inflating',
    priority: 1,
    targets: ['messages'],
    compress(input) {
      return { content: `${input.content} expanded`, changed: true, estimatedInputTokens: 1, estimatedOutputTokens: 999, engineId: 'inflating' };
    },
  }]);
  const result = registry.compress({ target: 'messages', content: 'keep this exact' });
  assert.equal(result.changed, false);
  assert.equal(result.content, 'keep this exact');
});

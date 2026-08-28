import assert from 'node:assert/strict';
import test from 'node:test';

const { CompressionEngineRegistry } = await import('../dist/application/compression-engine.js');

const engine = (id, priority, targets = ['context'], lossless = true) => ({
  id,
  priority,
  targets,
  lossless,
  compress(input) {
    return {
      text: input.text,
      changed: false,
      estimatedInputTokens: Math.ceil(input.text.length / 4),
      estimatedOutputTokens: Math.ceil(input.text.length / 4),
    };
  },
});

test('compression registry sorts engines deterministically', () => {
  const registry = new CompressionEngineRegistry({
    engines: [engine('zeta', 20), engine('alpha', 10), engine('beta', 10)],
  });
  assert.deepEqual(registry.list().map((item) => item.id), ['alpha', 'beta', 'zeta']);
});

test('compression registry filters by target', () => {
  const registry = new CompressionEngineRegistry({
    engines: [engine('context', 10, ['context']), engine('tools', 20, ['tool_results'])],
  });
  assert.deepEqual(registry.list('tool_results').map((item) => item.id), ['tools']);
});

test('compression registry rejects duplicate engines', () => {
  const registry = new CompressionEngineRegistry({ engines: [engine('one', 1)] });
  assert.throws(() => registry.register(engine('one', 2)), /already registered/);
});

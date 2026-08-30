import assert from 'node:assert/strict';
import test from 'node:test';
import { compressToolResult } from '../.forge-build/application/tool-result-compressor.js';

test('tool compression preserves structured output byte-for-byte', () => {
  const input = '{"items":[{"id":1},{"id":2}]}';
  const result = compressToolResult({ command: 'npm test', text: input });
  assert.equal(result.text, input);
  assert.equal(result.changed, false);
});

test('tool compression removes repeated diagnostic noise while retaining errors', () => {
  const repeated = 'This is a repeated diagnostic line that is intentionally long enough to deduplicate.';
  const input = [repeated, repeated, 'ERROR: build failed', repeated, 'done'].join('\n');
  const result = compressToolResult({ command: 'npm test', text: input });
  assert.equal(result.changed, true);
  assert.match(result.text, /ERROR: build failed/);
  assert.equal(result.text.split(repeated).length - 1, 1);
});

test('tool compression does not expand output', () => {
  const input = 'short output';
  const result = compressToolResult({ text: input });
  assert.equal(result.text, input);
  assert.equal(result.changed, false);
});

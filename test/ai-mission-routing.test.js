const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseAiMissionRoutingPreference,
  aiMissionRoutingGenerationFields,
} = require('../.forge-build/application/ai-mission-routing.js');

test('mission routing accepts a supported provider/model and exposes only broker preference fields', () => {
  const parsed = parseAiMissionRoutingPreference({
    preferProvider: 'gateway',
    preferModel: '  local-proxy/model-a  ',
  });
  assert.deepEqual(parsed, {
    preferProvider: 'gateway',
    preferModel: 'local-proxy/model-a',
  });
  assert.deepEqual(aiMissionRoutingGenerationFields(parsed), {
    preferProvider: 'gateway',
    preferModel: 'local-proxy/model-a',
  });
});

test('mission routing may prefer a provider without forcing a specific model', () => {
  const parsed = parseAiMissionRoutingPreference({ preferProvider: 'ollama' });
  assert.deepEqual(parsed, { preferProvider: 'ollama' });
  assert.deepEqual(aiMissionRoutingGenerationFields(parsed), { preferProvider: 'ollama' });
});

test('mission routing rejects unsupported providers and hidden execution metadata', () => {
  assert.throws(
    () => parseAiMissionRoutingPreference({ preferProvider: 'made-up-router' }),
    /supported provider/i,
  );
  assert.throws(
    () => parseAiMissionRoutingPreference({ preferProvider: 'openai', autoExecute: true }),
    /unsupported fields/i,
  );
});

test('mission routing is optional and never fabricates a preference', () => {
  assert.equal(parseAiMissionRoutingPreference(undefined), undefined);
  assert.equal(parseAiMissionRoutingPreference(null), undefined);
  assert.deepEqual(aiMissionRoutingGenerationFields(undefined), {});
});

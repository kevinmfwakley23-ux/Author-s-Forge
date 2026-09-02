const test = require('node:test');
const assert = require('node:assert/strict');
const {
  appendAssetRightsRecord,
  createAssetRightsRecord,
  createAssetRightsRegistry,
  latestRightsDeclaration,
  validateAssetRightsRegistry,
} = require('../.forge-build/domain/asset-rights-provenance.js');

test('asset rights registry preserves separate declaration, consent, and AI generation events', () => {
  let registry = createAssetRightsRegistry('project-1');
  const declaration = createAssetRightsRecord({
    id: 'rights-1', projectId: 'project-1', artifactId: 'source-1', eventType: 'source-declaration',
    provenanceKind: 'licensed', source: 'Stock license receipt', consentStatus: 'not-required',
    rightsBasis: 'licensed', publicationClearance: 'author-declared-cleared', licenseUrl: 'https://example.com/license',
    rightsUsageTerms: 'Commercial book use licensed.', digitalSourceType: 'human-created', recordedAt: '2026-09-02T20:00:00Z',
  });
  registry = appendAssetRightsRecord(registry, declaration);
  const consent = createAssetRightsRecord({
    id: 'rights-2', projectId: 'project-1', artifactId: 'source-1', eventType: 'external-processing-consent',
    provenanceKind: 'licensed', source: 'Author consented to Image Lab processing.', consentStatus: 'granted',
    rightsBasis: 'licensed', publicationClearance: 'author-declared-cleared', rightsUsageTerms: 'Commercial book use licensed.',
    provider: 'openai', digitalSourceType: 'human-created', recordedAt: '2026-09-02T20:01:00Z',
  });
  registry = appendAssetRightsRecord(registry, consent);
  const generated = createAssetRightsRecord({
    id: 'rights-3', projectId: 'project-1', artifactId: 'image-1', eventType: 'generation', provenanceKind: 'ai-generated',
    source: 'OpenAI image generation', consentStatus: 'not-required', rightsBasis: 'not-applicable', publicationClearance: 'review-required',
    provider: 'openai', model: 'gpt-image-2', aiPromptInformation: 'A quiet forest', digitalSourceType: 'trained-algorithmic-media', recordedAt: '2026-09-02T20:02:00Z',
  });
  registry = appendAssetRightsRecord(registry, generated);
  const restored = validateAssetRightsRegistry(JSON.parse(JSON.stringify(registry)));
  assert.equal(restored.records.length, 3);
  assert.equal(latestRightsDeclaration(restored, 'source-1').rightsBasis, 'licensed');
  assert.equal(restored.records.find((record) => record.id === 'rights-3').publicationClearance, 'review-required');
});

test('rights registry rejects false clearance and missing external-processing consent evidence', () => {
  assert.throws(() => createAssetRightsRecord({
    id: 'bad-1', projectId: 'project-1', artifactId: 'source-1', eventType: 'source-declaration', provenanceKind: 'unknown',
    source: 'Unknown image', consentStatus: 'not-required', rightsBasis: 'unknown', publicationClearance: 'author-declared-cleared', recordedAt: '2026-09-02T20:00:00Z',
  }), /cannot be marked publication-cleared/);
  assert.throws(() => createAssetRightsRecord({
    id: 'bad-2', projectId: 'project-1', artifactId: 'source-1', eventType: 'external-processing-consent', provenanceKind: 'licensed',
    source: 'No consent', consentStatus: 'pending', rightsBasis: 'licensed', provider: 'openai', recordedAt: '2026-09-02T20:00:00Z',
  }), /explicit granted consent|Consent must be granted/i);
  assert.throws(() => createAssetRightsRecord({
    id: 'bad-3', projectId: 'project-1', artifactId: 'image-1', eventType: 'generation', provenanceKind: 'ai-generated',
    source: 'Generated', consentStatus: 'not-required', rightsBasis: 'not-applicable', provider: 'openai', model: 'gpt-image-2',
    digitalSourceType: 'trained-algorithmic-media', recordedAt: '2026-09-02T20:00:00Z',
  }), /prompt information/);
});

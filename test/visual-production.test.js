import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVisualGenerationPlan } from '../dist/domain/visual-continuity.js';
import { VisualProductionPipeline } from '../dist/application/visual-production.js';

function plan() {
  return buildVisualGenerationPlan({
    scene: { sceneId: 'scene-1', characterIds: ['hero'], action: 'standing', composition: 'full body', mood: 'hopeful', aspectRatio: '2:3', textElements: [] },
    characters: [{ characterId: 'hero', name: 'Hero', immutableTraits: ['red hair', 'green eyes'], signatureItems: ['silver pendant'], costumeRules: ['blue coat'], referenceAssetIds: ['char-master'], allowedStyleModes: ['comic-book-artist'] }],
    style: { id: 'comic', mode: 'comic-book-artist', description: 'modern comic book art', palette: ['limited'], lighting: 'rim light', cameraLanguage: 'dynamic', linework: 'clean ink', rendering: 'flat color', referenceAssetIds: ['style-master'] },
    references: [
      { id: 'char-master', role: 'character-master', uri: 'character://hero', characterId: 'hero', tags: ['master'], approved: true, createdAt: '2026-01-01' },
      { id: 'style-master', role: 'style-master', uri: 'style://comic', styleId: 'comic', tags: ['comic'], approved: true, createdAt: '2026-01-01' }
    ]
  });
}

test('visual production rejects a provider result that fails continuity and tries another provider', async () => {
  const providers = [
    { id: 'bad', healthy: true, generate: async () => ({ assetUri: 'bad://asset', provider: 'bad', model: 'x' }) },
    { id: 'good', healthy: true, generate: async () => ({ assetUri: 'good://asset', provider: 'good', model: 'y' }) }
  ];
  const pipeline = new VisualProductionPipeline(providers);
  const result = await pipeline.produce({
    plan: plan(),
    quality: { expectedCharacterTraits: ['red hair', 'green eyes'], expectedStyleTags: ['comic'], requiredSignatureItems: ['silver pendant'], expectedCostumeRules: ['blue coat'] },
    inspect: async (asset) => asset.provider === 'bad'
      ? { observedCharacterTraits: ['red hair'], observedStyleTags: ['comic'], observedSignatureItems: ['silver pendant'], observedCostumeRules: ['blue coat'] }
      : { observedCharacterTraits: ['red hair', 'green eyes'], observedStyleTags: ['comic'], observedSignatureItems: ['silver pendant'], observedCostumeRules: ['blue coat'] }
  });
  assert.equal(result.asset.provider, 'good');
  assert.deepEqual(result.providerAttempts, ['bad', 'good']);
  assert.equal(result.quality.passed, true);
});

test('visual production fails clearly when every provider fails', async () => {
  const pipeline = new VisualProductionPipeline([{ id: 'down', healthy: true, generate: async () => { throw new Error('offline'); } }]);
  await assert.rejects(() => pipeline.produce({ plan: plan(), quality: { expectedCharacterTraits: ['red hair'], expectedStyleTags: ['comic'] }, inspect: async () => ({ observedCharacterTraits: ['red hair'], observedStyleTags: ['comic'] }) }), /Visual production exhausted/);
});

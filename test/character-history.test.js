const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createCharacter,
  updateCharacter,
  getCharacterAt,
  getCharacterChanges,
  getCharacterFieldHistory,
} = require('../dist/domain/character-bible.js');

function profile(overrides = {}) {
  return {
    name: 'Mara Vale', age: 34, birthDate: '1992-04-12', physicalAppearance: 'Lean and weathered',
    height: '5ft 8in', build: 'Athletic', hair: 'Black', eyes: 'Gray', skin: 'Olive',
    clothing: 'Dark field coat', voice: 'Low and controlled', speechPatterns: ['Short sentences'],
    personality: 'Observant', values: ['Loyalty'], fears: ['Abandonment'], secrets: ['She left home'],
    goals: ['Find the truth'], motivations: ['Protect her brother'], relationships: [], history: 'Raised near the reservoir',
    knowledge: ['Local history'], skills: ['Investigation'], weaknesses: ['Distrust'], characterArc: 'Learns to trust',
    importantObjects: ['Old key'], currentEmotionalState: 'Guarded', currentLocation: 'Ogden', currentInjuries: [],
    ...overrides,
  };
}

test('character updates create attributable field history without losing the original state', () => {
  const created = createCharacter({ id: 'mara', projectId: 'project', profile: profile(), now: '2026-01-01T00:00:00.000Z' });
  const updated = updateCharacter(created, {
    characterId: 'mara',
    changes: { currentLocation: 'Pineview Reservoir', currentEmotionalState: 'Determined' },
    effectiveAt: '2026-01-02T00:00:00.000Z',
    reason: 'Chapter 4 continuity change',
  });

  assert.equal(getCharacterFieldHistory(updated, 'currentLocation').length, 2);
  assert.equal(getCharacterFieldHistory(updated, 'currentLocation')[1].reason, 'Chapter 4 continuity change');
  assert.equal(getCharacterFieldHistory(updated, 'currentLocation')[1].actor, 'author');
  assert.equal(getCharacterAt(updated, '2026-01-01T12:00:00.000Z').currentLocation, 'Ogden');
  assert.equal(getCharacterAt(updated, '2026-01-02T12:00:00.000Z').currentLocation, 'Pineview Reservoir');

  const changes = getCharacterChanges(updated);
  assert.equal(changes.length, 2);
  assert.deepEqual(changes.map((change) => change.field).sort(), ['currentEmotionalState', 'currentLocation']);
});

test('character history rejects empty changes and unsupported fields', () => {
  const created = createCharacter({ id: 'mara', projectId: 'project', profile: profile(), now: '2026-01-01T00:00:00.000Z' });
  assert.throws(() => updateCharacter(created, { characterId: 'mara', changes: {}, reason: 'Nothing changed' }), /at least one field change/);
  assert.throws(() => updateCharacter(created, { characterId: 'mara', changes: { inventedField: 'x' }, reason: 'Bad change' }), /Unsupported character field/);
});

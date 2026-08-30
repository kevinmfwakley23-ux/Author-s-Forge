import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SPECIALIZED_CREATION_MODES,
  advanceSpecializedCreationStage,
  buildSpecializedCreationSteps,
  createSpecializedCreationProject,
  validateSpecializedCreationProject,
} from '../dist/domain/specialized-creation-workflows.js';

test('specialized creation office exposes exactly the six canonical modes', () => {
  assert.deepEqual(SPECIALIZED_CREATION_MODES, [
    'comic-book',
    'greeting-card',
    'birthday-card',
    'invitation',
    'flyer',
    'trading-card-game',
  ]);
});

test('workflow starts at brief and exposes a complete production path', () => {
  const project = createSpecializedCreationProject({ id: 'p1', mode: 'comic-book', title: 'Issue One', brief: 'A hero enters a haunted station.', now: '2026-08-30T00:00:00.000Z' });
  assert.deepEqual(validateSpecializedCreationProject(project), []);
  assert.equal(project.stage, 'brief');
  assert.deepEqual(buildSpecializedCreationSteps(project).map((step) => step.stage), ['brief', 'plan', 'create', 'review', 'production']);
});

test('workflow cannot skip stages', () => {
  const project = createSpecializedCreationProject({ id: 'p2', mode: 'trading-card-game', title: 'Set One', brief: 'A starter set.' });
  assert.throws(() => advanceSpecializedCreationStage(project, 'create'), /expected current stage brief/);
});

test('workflow advances one governed stage at a time', () => {
  let project = createSpecializedCreationProject({ id: 'p3', mode: 'flyer', title: 'Event', brief: 'Promote an event.' });
  project = advanceSpecializedCreationStage(project, 'brief', '2026-08-30T00:01:00.000Z');
  assert.equal(project.stage, 'plan');
  project = advanceSpecializedCreationStage(project, 'plan', '2026-08-30T00:02:00.000Z');
  assert.equal(project.stage, 'create');
});

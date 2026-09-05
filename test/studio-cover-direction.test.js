const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const { FileProjectStore } = require('../.forge-build/infrastructure/file-project-store.js');
const { createProject, withProjectStudioWorkspace } = require('../.forge-build/domain/project.js');
const { createStudioWorkspace, createWorkspaceBook, addWorkspaceBook } = require('../.forge-build/domain/studio-workspace.js');
const { StudioCoverDirectionService } = require('../.forge-build/application/studio-cover-direction.js');

async function fixture(generator) {
  const root = await mkdtemp(join(tmpdir(), 'forge-cover-direction-'));
  const store = new FileProjectStore(root);
  let workspace = createStudioWorkspace();
  workspace = addWorkspaceBook(workspace, createWorkspaceBook({
    id: 'book-1', title: 'The Cover Truth', kind: 'novel', description: 'A quiet literary mystery about memory and evidence.', now: '2026-09-04T19:20:00.000Z',
  }));
  let project = createProject({ id: 'cover-project', title: 'Cover Project', now: '2026-09-04T19:20:00.000Z' });
  project = withProjectStudioWorkspace(project, workspace, '2026-09-04T19:21:00.000Z');
  await store.save(project);
  return { root, store, service: new StudioCoverDirectionService(store, generator) };
}

test('Cover Studio direction produces a reviewable candidate without inventing production geometry or persistence', async () => {
  let captured;
  const { root, store, service } = await fixture(async (request) => {
    captured = request;
    return {
      provider: 'openai',
      model: 'cover-test-model',
      requestId: 'cover-request-1',
      text: JSON.stringify({
        frontPrompt: 'A restrained archival desk scene with one torn photograph and a distant window.',
        backText: 'A literary mystery about what survives when memory and evidence disagree.',
        spineText: 'The Cover Truth — Forge Author',
        typography: 'Elegant high-contrast serif title with restrained small-cap supporting type.',
        composition: 'Title in the upper third, central evidence motif, generous negative space, quiet lower author line.',
        mood: 'Literary, uneasy, intimate, credible.',
        palette: ['warm ivory', 'charcoal', 'muted brass'],
        avoid: ['fake review quotes', 'retailer badges', 'spine measurements'],
      }),
    };
  });

  try {
    const before = await store.load('cover-project');
    const proposal = await service.propose('cover-project', { bookId: 'book-1', brief: 'Create a serious literary cover direction grounded in the actual book.' });
    const after = await store.load('cover-project');

    assert.equal(proposal.provider, 'openai');
    assert.equal(proposal.model, 'cover-test-model');
    assert.equal(proposal.requestId, 'cover-request-1');
    assert.equal(proposal.authorApprovalRequired, true);
    assert.equal(proposal.persisted, false);
    assert.equal(proposal.productionGeometryRequired, true);
    assert.equal(proposal.candidate.palette.length, 3);
    assert.match(proposal.candidate.backText, /literary mystery/i);
    assert.equal(after.metadata.updatedAt, before.metadata.updatedAt, 'candidate generation must not mutate durable project state');
    assert.equal(after.bookCoverPlans, undefined, 'cover direction must not fabricate a production cover plan');

    assert.equal(captured.task, 'cover');
    assert.equal(captured.context.projectId, 'cover-project');
    assert.match(captured.system, /Do not claim production readiness/i);
    assert.match(captured.system, /spine width/i);
    assert.match(captured.user, /The Cover Truth/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('Cover Studio direction rejects model-invented geometry/readiness fields', async () => {
  const { root, service } = await fixture(async () => ({
    provider: 'openai',
    model: 'cover-test-model',
    text: JSON.stringify({
      frontPrompt: 'Front.', backText: 'Back.', spineText: 'Spine.', typography: 'Type.', composition: 'Composition.', mood: 'Mood.', palette: [], avoid: [],
      spineWidthInches: 0.42,
      kdpReady: true,
    }),
  }));
  try {
    await assert.rejects(() => service.propose('cover-project', { bookId: 'book-1', brief: 'Make the cover.' }), /unsupported fields/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('Cover Studio direction fails honestly when its configured AI provider fails', async () => {
  const { root, service } = await fixture(async () => { throw new Error('Configured cover model is unavailable.'); });
  try {
    await assert.rejects(() => service.propose('cover-project', { bookId: 'book-1', brief: 'Make the cover.' }), /Configured cover model is unavailable/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

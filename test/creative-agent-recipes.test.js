const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const { FileProjectStore } = require('../.forge-build/infrastructure/file-project-store.js');
const { createProject } = require('../.forge-build/domain/project.js');
const { CreativeAgentRecipeService } = require('../.forge-build/application/creative-agent-recipes.js');

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'forge-agent-recipes-'));
  const store = new FileProjectStore(root);
  await store.save(createProject({ id: 'recipe-project', title: 'Recipe Project', now: '2026-09-04T18:30:00.000Z' }));
  return { root, store, service: new CreativeAgentRecipeService(store) };
}

test('Forge Recipes persist versioned governed tool sequences inside durable project memory', async () => {
  const { root, store, service } = await fixture();
  try {
    const created = await service.create('recipe-project', {
      id: 'launch-kit',
      title: 'Launch Kit',
      description: 'Research the market, create a visual, and prepare campaign drafts.',
      steps: [
        { toolId: 'market.kdp.research', instruction: 'Research the selected market with dated evidence.' },
        { toolId: 'visual.image.generate', instruction: 'Create a reviewable launch visual.' },
        { toolId: 'promotion.campaign.propose', instruction: 'Prepare draft campaign assets.' },
      ],
      now: '2026-09-04T18:31:00.000Z',
    });
    assert.equal(created.version, 1);
    assert.equal(created.steps.length, 3);

    const reloaded = new CreativeAgentRecipeService(store);
    assert.deepEqual((await reloaded.list('recipe-project')).map((recipe) => recipe.id), ['launch-kit']);
    const project = await store.load('recipe-project');
    const recipeMemories = project.memories.filter((memory) => memory.relevanceTags.includes('agent-recipe'));
    assert.equal(recipeMemories.length, 1);
    assert.equal(recipeMemories[0].class, 'creative-note');
    assert.equal(recipeMemories[0].authority, 'working');
    assert.equal(recipeMemories[0].provenance[0].kind, 'author');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('Forge Recipe updates append versions and compile to plan-only governed tool metadata', async () => {
  const { root, store, service } = await fixture();
  try {
    await service.create('recipe-project', {
      id: 'creative-pass',
      title: 'Creative Pass',
      steps: [
        { toolId: 'research.live' },
        { toolId: 'visual.image.generate' },
      ],
      now: '2026-09-04T18:32:00.000Z',
    });
    const updated = await service.update('recipe-project', 'creative-pass', {
      title: 'Creative Pass Plus',
      steps: [
        { toolId: 'research.live' },
        { toolId: 'editing.analyze' },
        { toolId: 'visual.image.generate' },
      ],
      now: '2026-09-04T18:33:00.000Z',
    });
    assert.equal(updated.version, 2);

    const compiled = await service.compile('recipe-project', 'creative-pass', { goal: 'Improve and visualize the current work.' });
    assert.equal(compiled.recipe.title, 'Creative Pass Plus');
    assert.deepEqual(compiled.plan.steps.map((step) => step.toolId), [
      'research.live',
      'editing.analyze',
      'visual.image.generate',
      'memory.record-working',
    ]);
    assert.match(compiled.plan.steps.find((step) => step.toolId === 'editing.analyze').blockedReason, /requires scene scope/);
    assert.equal(compiled.plan.steps.find((step) => step.toolId === 'visual.image.generate').providerRequirement, 'configured-image');
    assert.equal(compiled.plan.policy.directCanonMutationAllowed, false);
    assert.equal(compiled.plan.policy.directManuscriptMutationAllowed, false);

    const project = await store.load('recipe-project');
    assert.equal(project.memories.filter((memory) => memory.relevanceTags.includes('agent-recipe:creative-pass')).length, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('Forge Recipe compilation forces exactly one workflow evidence record to the final step', async () => {
  const { root, service } = await fixture();
  try {
    await service.create('recipe-project', {
      id: 'audit-order',
      title: 'Audit Order',
      steps: [
        { toolId: 'project.context' },
        { toolId: 'memory.record-working', instruction: 'Attempt to record too early.' },
        { toolId: 'research.live' },
      ],
      now: '2026-09-04T18:33:30.000Z',
    });
    const compiled = await service.compile('recipe-project', 'audit-order', { goal: 'Ground and research the project.' });
    assert.deepEqual(compiled.plan.steps.map((step) => step.toolId), [
      'project.context',
      'research.live',
      'memory.record-working',
    ]);
    assert.equal(compiled.plan.steps.filter((step) => step.toolId === 'memory.record-working').length, 1);
    assert.match(compiled.plan.steps.at(-1).reason, /after all other recipe operations finish/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('Forge Recipes reject unregistered tools and cannot smuggle proposal-apply or manuscript-content routes into a workflow', async () => {
  const { root, store, service } = await fixture();
  try {
    await assert.rejects(() => service.create('recipe-project', {
      id: 'unsafe',
      title: 'Unsafe',
      steps: [{ toolId: 'proposal.apply' }],
      now: '2026-09-04T18:34:00.000Z',
    }), /Unknown Forge creative tool/);
    const project = await store.load('recipe-project');
    assert.equal(project.memories.some((memory) => memory.relevanceTags.includes('agent-recipe:unsafe')), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('Forge Recipe deletion is append-only and hides the deleted workflow without erasing history', async () => {
  const { root, store, service } = await fixture();
  try {
    await service.create('recipe-project', {
      id: 'temporary',
      title: 'Temporary Recipe',
      steps: [{ toolId: 'project.context' }],
      now: '2026-09-04T18:35:00.000Z',
    });
    const removed = await service.remove('recipe-project', 'temporary', '2026-09-04T18:36:00.000Z');
    assert.deepEqual(removed, { id: 'temporary', deleted: true, version: 2 });
    assert.equal((await service.list('recipe-project')).length, 0);
    await assert.rejects(() => service.get('recipe-project', 'temporary'), /was not found/);
    const project = await store.load('recipe-project');
    assert.equal(project.memories.filter((memory) => memory.relevanceTags.includes('agent-recipe:temporary')).length, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

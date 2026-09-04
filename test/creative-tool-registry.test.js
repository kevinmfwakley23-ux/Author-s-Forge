const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CREATIVE_TOOL_REGISTRY_FORMAT_VERSION,
  creativeToolRegistrySnapshot,
  creativeToolById,
  resolveCreativeToolPath,
} = require('../.forge-build/application/creative-tool-registry.js');

test('Creative Tool Registry exposes one typed governed definition per Agent Workbench operation', () => {
  const snapshot = creativeToolRegistrySnapshot();
  assert.equal(snapshot.formatVersion, CREATIVE_TOOL_REGISTRY_FORMAT_VERSION);
  assert.deepEqual(snapshot.tools.map((tool) => tool.id), [
    'project.context',
    'research.live',
    'market.kdp.research',
    'architecture.generate',
    'story.chapter-cards.propose',
    'writing.propose',
    'editing.analyze',
    'visual.image.generate',
    'promotion.campaign.propose',
    'production.export',
    'memory.record-working',
  ]);
  assert.equal(new Set(snapshot.tools.map((tool) => tool.id)).size, snapshot.tools.length);

  for (const tool of snapshot.tools) {
    assert.equal(tool.method, 'POST');
    assert.match(tool.pathTemplate, /^\/api\/projects\/:projectId\//);
    assert.equal(tool.mayChangeCanon, false);
    assert.equal(tool.mayDirectlyChangeManuscript, false);
    assert.ok(tool.requiredScope.includes('project'));
    assert.ok(tool.authorCanReviewBeforeMutation);
    assert.doesNotMatch(tool.pathTemplate, /\/apply(?:\/|$)/);
    assert.doesNotMatch(tool.pathTemplate, /\/content(?:\/|$)/);
  }
});

test('writing and Chapter Card tools stay proposal-only and cannot directly alter author manuscript', () => {
  const writing = creativeToolById('writing.propose');
  assert.equal(writing.approvalClass, 'proposal');
  assert.equal(writing.providerRequirement, 'configured-ai');
  assert.equal(writing.stateEffect, 'proposal-ledger');
  assert.deepEqual(writing.requiredScope, ['project', 'book', 'chapter', 'scene']);
  assert.equal(writing.pathTemplate, '/api/projects/:projectId/ai/writing/generate');

  const chapterCards = creativeToolById('story.chapter-cards.propose');
  assert.equal(chapterCards.approvalClass, 'proposal');
  assert.equal(chapterCards.providerRequirement, 'configured-ai');
  assert.equal(chapterCards.stateEffect, 'candidate-ledger');
  assert.deepEqual(chapterCards.requiredScope, ['project', 'book']);
  assert.equal(chapterCards.pathTemplate, '/api/projects/:projectId/story-map/chapter-card-workflow/generate');
});

test('visual, market and promotion tools expose truthful provider and state requirements', () => {
  assert.equal(creativeToolById('architecture.generate').providerRequirement, 'configured-ai');
  assert.equal(creativeToolById('research.live').providerRequirement, 'hosted-research');
  assert.equal(creativeToolById('market.kdp.research').providerRequirement, 'hosted-research');
  assert.equal(creativeToolById('market.kdp.research').stateEffect, 'market-intelligence');
  assert.equal(creativeToolById('visual.image.generate').providerRequirement, 'configured-image');
  assert.equal(creativeToolById('visual.image.generate').stateEffect, 'asset-library');
  assert.equal(creativeToolById('promotion.campaign.propose').providerRequirement, 'configured-ai');
  assert.equal(creativeToolById('promotion.campaign.propose').stateEffect, 'campaign-draft');
  assert.deepEqual(creativeToolById('promotion.campaign.propose').requiredScope, ['project', 'book']);
  assert.equal(creativeToolById('project.context').providerRequirement, 'none');
  assert.equal(creativeToolById('editing.analyze').approvalClass, 'read-only');
  assert.equal(creativeToolById('production.export').approvalClass, 'artifact');
  assert.equal(creativeToolById('memory.record-working').stateEffect, 'working-memory');
});

test('creative tool paths are project-scoped and reject unsafe project ids', () => {
  assert.equal(resolveCreativeToolPath('writing.propose', 'forge-project_01'), '/api/projects/forge-project_01/ai/writing/generate');
  assert.equal(resolveCreativeToolPath('visual.image.generate', 'forge-project_01'), '/api/projects/forge-project_01/ai/image');
  assert.throws(() => resolveCreativeToolPath('writing.propose', '../other-project'), /Invalid project id/);
  assert.throws(() => creativeToolById('proposal.apply'), /Unknown Forge creative tool/);
});

const test = require('node:test');
const assert = require('node:assert/strict');

const { compileCreativeAgentPlan } = require('../.forge-build/application/creative-agent-plan.js');

const fullScope = { project: true, book: true, chapter: true, scene: true, sceneHasContent: true };

test('Editor mode makes drafting visibly unavailable in an agent plan', () => {
  const plan = compileCreativeAgentPlan({ goal: 'Draft a stronger version of this scene.', mode: 'editor', scope: fullScope });
  const writing = plan.steps.find((step) => step.toolId === 'writing.propose');
  assert.ok(writing);
  assert.match(writing.blockedReason, /configured not to draft new prose/);
  assert.equal(plan.policy.bulkExecutionEligible, false);
  assert.equal(plan.policy.directCanonMutationAllowed, false);
  assert.equal(plan.policy.directManuscriptMutationAllowed, false);
  assert.equal(plan.policy.writingMustUseProposalBoundary, true);
});

test('Autonomous mode can group only read-only no-state-effect steps, never writing or state mutations', () => {
  const plan = compileCreativeAgentPlan({ goal: 'Draft and edit this scene, then export a PDF review copy.', mode: 'autonomous', scope: fullScope });
  assert.equal(plan.policy.bulkExecutionEligible, true);
  const context = plan.steps.find((step) => step.toolId === 'project.context');
  const writing = plan.steps.find((step) => step.toolId === 'writing.propose');
  const editing = plan.steps.find((step) => step.toolId === 'editing.analyze');
  const production = plan.steps.find((step) => step.toolId === 'production.export');
  assert.equal(context.eligibleForApprovedRunGroup, true);
  assert.equal(editing.eligibleForApprovedRunGroup, true);
  assert.equal(writing.eligibleForApprovedRunGroup, false);
  assert.equal(production.eligibleForApprovedRunGroup, false);
});

test('Planner surfaces missing scope instead of inventing a target', () => {
  const plan = compileCreativeAgentPlan({ goal: 'Write the next chapter.', mode: 'partner', scope: { project: true } });
  const writing = plan.steps.find((step) => step.toolId === 'writing.propose');
  assert.match(writing.blockedReason, /requires book, chapter, scene scope/);
});

test('Planner orders source grounding before writing and keeps evidence recording last', () => {
  const plan = compileCreativeAgentPlan({ goal: 'Research the real-world setting, then draft and continuity edit the scene.', mode: 'partner', scope: fullScope });
  assert.deepEqual(plan.steps.map((step) => step.toolId), [
    'research.live',
    'project.context',
    'writing.propose',
    'editing.analyze',
    'memory.record-working',
  ]);
});

test('Planner defaults an ordinary author goal to grounded proposal work rather than untracked generation', () => {
  const plan = compileCreativeAgentPlan({ goal: 'Make this better.', mode: 'co-pilot', scope: fullScope });
  assert.deepEqual(plan.steps.map((step) => step.toolId), ['project.context', 'writing.propose', 'memory.record-working']);
  assert.equal(plan.steps.find((step) => step.toolId === 'writing.propose').approvalClass, 'proposal');
});

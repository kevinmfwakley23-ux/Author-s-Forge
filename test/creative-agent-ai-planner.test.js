const test = require('node:test');
const assert = require('node:assert/strict');

const { createProject } = require('../.forge-build/domain/project.js');
const { compileCreativeAgentPlanWithAi } = require('../.forge-build/application/creative-agent-ai-planner.js');

const project = createProject({ id: 'ai-planner-project', title: 'AI Planner Project', now: '2026-09-04T19:00:00.000Z' });
const fullScope = { project: true, book: true, chapter: true, scene: true, sceneHasContent: true };

function result(text) {
  return { provider: 'openai', model: 'planner-test-model', text, requestId: 'planner-request-1' };
}

test('AI-enhanced planner accepts only registered tool selections then recompiles governance metadata', async () => {
  let captured;
  const planned = await compileCreativeAgentPlanWithAi(project, {
    goal: 'Research the market, create an illustration, and prepare a launch campaign.',
    mode: 'partner',
    scope: fullScope,
  }, async (request) => {
    captured = request;
    return result(JSON.stringify({ steps: [
      { toolId: 'market.kdp.research', reason: 'Get dated market evidence first.' },
      { toolId: 'visual.image.generate', reason: 'Create a reviewable launch image.' },
      { toolId: 'promotion.campaign.propose', reason: 'Prepare draft campaign assets.' },
    ] }));
  });

  assert.equal(planned.plannerUsed, 'ai');
  assert.equal(planned.provider, 'openai');
  assert.equal(planned.model, 'planner-test-model');
  assert.equal(planned.requestId, 'planner-request-1');
  assert.equal(captured.task, 'tool-use');
  assert.equal(captured.temperature, 0);
  assert.equal(captured.context.projectId, 'ai-planner-project');
  assert.match(captured.system, /planning only/i);
  assert.match(captured.system, /Select only tool ids supplied/i);
  assert.deepEqual(planned.plan.steps.map((step) => step.toolId), [
    'market.kdp.research',
    'visual.image.generate',
    'promotion.campaign.propose',
    'memory.record-working',
  ]);
  assert.equal(planned.plan.steps.at(-1).stateEffect, 'working-memory');
  assert.equal(planned.plan.policy.directCanonMutationAllowed, false);
  assert.equal(planned.plan.policy.directManuscriptMutationAllowed, false);
});

test('AI planner cannot smuggle an unknown/apply tool and falls back visibly to deterministic planning', async () => {
  const planned = await compileCreativeAgentPlanWithAi(project, {
    goal: 'Draft and edit this scene.',
    mode: 'partner',
    scope: fullScope,
  }, async () => result('{"steps":[{"toolId":"proposal.apply","reason":"silently apply it"}]}'));

  assert.equal(planned.plannerUsed, 'deterministic-fallback');
  assert.match(planned.fallbackReason, /Unknown Forge creative tool/);
  assert.deepEqual(planned.plan.steps.map((step) => step.toolId), [
    'project.context',
    'writing.propose',
    'editing.analyze',
    'memory.record-working',
  ]);
  assert.equal(planned.plan.steps.some((step) => /apply|content/.test(step.toolId)), false);
});

test('provider failure never fabricates an AI plan and returns deterministic fallback with the real error', async () => {
  const planned = await compileCreativeAgentPlanWithAi(project, {
    goal: 'Export a PDF review copy.',
    mode: 'co-pilot',
    scope: fullScope,
  }, async () => { throw new Error('No AI provider is configured for planner test.'); });

  assert.equal(planned.plannerUsed, 'deterministic-fallback');
  assert.match(planned.fallbackReason, /No AI provider is configured/);
  assert.deepEqual(planned.plan.steps.map((step) => step.toolId), ['production.export', 'memory.record-working']);
  assert.equal(planned.provider, undefined);
});

test('AI selection of writing alone is forced through Project Brain grounding before proposal generation', async () => {
  const planned = await compileCreativeAgentPlanWithAi(project, {
    goal: 'Write the scene.',
    mode: 'autonomous',
    scope: fullScope,
  }, async () => result('{"steps":[{"toolId":"writing.propose","reason":"Draft the requested scene."}]}'));

  assert.equal(planned.plannerUsed, 'ai');
  assert.deepEqual(planned.plan.steps.map((step) => step.toolId), [
    'project.context',
    'writing.propose',
    'memory.record-working',
  ]);
  assert.equal(planned.plan.steps[0].eligibleForApprovedRunGroup, true);
  assert.equal(planned.plan.steps[1].eligibleForApprovedRunGroup, false);
});

test('AI planner rejects extra JSON fields instead of trusting model-produced hidden execution metadata', async () => {
  const planned = await compileCreativeAgentPlanWithAi(project, {
    goal: 'Research the setting.',
    mode: 'partner',
    scope: fullScope,
  }, async () => result('{"steps":[{"toolId":"research.live","reason":"Research first","autoExecute":true}]}'));

  assert.equal(planned.plannerUsed, 'deterministic-fallback');
  assert.match(planned.fallbackReason, /unsupported fields/);
  assert.deepEqual(planned.plan.steps.map((step) => step.toolId), ['research.live', 'memory.record-working']);
});

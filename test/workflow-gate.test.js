const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorkflowGateReport, canAdvanceWorkflow, validateWorkflowGateReport, FORGE_WORKFLOW_STAGES } = require('../dist/index.js');

test('workflow gate models the complete author lifecycle and blocks incomplete stages', () => {
  const report = createWorkflowGateReport({
    id: 'gate-1', projectId: 'project-1', bookId: 'book-1', currentStage: 'editing', now: '2026-08-30T00:00:00.000Z',
    checks: {
      concept: [{ id: 'concept-ready', label: 'Concept approved', passed: true }],
      architecture: [{ id: 'architecture-ready', label: 'Architecture approved', passed: true }],
      canon: [{ id: 'canon-ready', label: 'Canon locked', passed: true }],
      manuscript: [{ id: 'draft-ready', label: 'Draft complete', passed: false, remediation: 'Finish the manuscript.' }],
    },
  });
  assert.equal(report.stages.length, FORGE_WORKFLOW_STAGES.length);
  assert.equal(report.stages[0].status, 'ready');
  assert.equal(report.stages[3].status, 'blocked');
  assert.equal(canAdvanceWorkflow(report, 'concept'), true);
  assert.equal(canAdvanceWorkflow(report, 'manuscript'), false);
  assert.doesNotThrow(() => validateWorkflowGateReport(report));
});

test('workflow gate preserves deterministic check failures', () => {
  const report = createWorkflowGateReport({ id:'gate-2', projectId:'p', bookId:'b', currentStage:'release', checks:{ release:[{ id:'audit', label:'Release audit', passed:false }] }, now:'2026-08-30T00:00:00.000Z' });
  assert.equal(report.stages.at(-1).status, 'blocked');
  assert.throws(() => validateWorkflowGateReport({ ...report, stages: report.stages.map((s) => s.stage === 'release' ? { ...s, status:'ready' } : s) }), /inconsistent/);
});

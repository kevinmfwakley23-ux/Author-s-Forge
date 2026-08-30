const test = require("node:test");
const assert = require("node:assert/strict");
const { createProject } = require("../.forge-build/domain/project.js");
const { advanceProjectWorkflow } = require("../.forge-build/application/project-workflow.js");

const readyConcept = { concept: [{ id: "concept-ready", label: "Concept approved", passed: true }] };
const blockedConcept = { concept: [{ id: "concept-missing", label: "Concept approved", passed: false, remediation: "Complete the concept." }] };

function project() { return createProject({ id: "project-workflow", title: "Workflow Book", now: "2026-08-30T00:00:00.000Z" }); }

test("project workflow defaults to concept and remains unchanged when blocked", () => {
  const current = project();
  const result = advanceProjectWorkflow({ project: current, bookId: "book-1", checks: blockedConcept, now: "2026-08-30T00:01:00.000Z" });
  assert.equal(current.workflowStage, undefined);
  assert.equal(result.project.workflowStage, undefined);
  assert.equal(result.workflow.fromStage, "concept");
  assert.equal(result.workflow.decision, "blocked");
  assert.deepEqual(result.workflow.blockers, ["concept-missing"]);
});

test("ready workflow requires explicit author approval and does not mutate on preview", () => {
  const current = project();
  const result = advanceProjectWorkflow({ project: current, bookId: "book-1", checks: readyConcept, now: "2026-08-30T00:01:00.000Z" });
  assert.equal(result.workflow.decision, "blocked");
  assert.deepEqual(result.workflow.blockers, ["AUTHOR_APPROVAL_REQUIRED"]);
  assert.equal(result.project.workflowStage, undefined);
});

test("explicit author approval advances exactly one canonical stage", () => {
  const current = project();
  const result = advanceProjectWorkflow({ project: current, bookId: "book-1", checks: readyConcept, authorApproved: true, now: "2026-08-30T00:01:00.000Z" });
  assert.equal(result.workflow.decision, "advanced");
  assert.equal(result.workflow.fromStage, "concept");
  assert.equal(result.workflow.toStage, "architecture");
  assert.equal(result.project.workflowStage, "architecture");
  assert.equal(result.project.metadata.updatedAt, "2026-08-30T00:01:00.000Z");
});

test("requested non-sequential stages are rejected", () => {
  const current = project();
  const result = advanceProjectWorkflow({ project: current, bookId: "book-1", checks: readyConcept, requestedStage: "manuscript", authorApproved: true });
  assert.equal(result.workflow.decision, "blocked");
  assert.deepEqual(result.workflow.blockers, ["WORKFLOW_STAGE_ORDER_INVALID"]);
  assert.equal(result.project.workflowStage, undefined);
});

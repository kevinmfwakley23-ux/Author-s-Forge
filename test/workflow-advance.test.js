import test from "node:test";
import assert from "node:assert/strict";
import { advanceWorkflow } from "../src/application/workflow-advance.ts";

const base = {
  id: "gate-1",
  projectId: "project-1",
  bookId: "book-1",
  currentStage: "concept",
  checks: {
    concept: [{ id: "concept.ready", label: "Concept is approved", passed: true }],
  },
  now: "2026-08-29T00:00:00.000Z",
};

test("advances only when the current stage is ready", () => {
  const result = advanceWorkflow(base);
  assert.equal(result.decision, "advanced");
  assert.equal(result.fromStage, "concept");
  assert.equal(result.toStage, "architecture");
  assert.deepEqual(result.blockers, []);
});

test("blocks advancement when a current-stage check fails", () => {
  const result = advanceWorkflow({
    ...base,
    checks: {
      concept: [{ id: "concept.ready", label: "Concept is approved", passed: false, remediation: "Approve the concept." }],
    },
  });
  assert.equal(result.decision, "blocked");
  assert.equal(result.toStage, "concept");
  assert.deepEqual(result.blockers, ["concept.ready"]);
});

test("blocks non-sequential jumps", () => {
  const result = advanceWorkflow({ ...base, requestedStage: "manuscript" });
  assert.equal(result.decision, "blocked");
  assert.deepEqual(result.blockers, ["WORKFLOW_STAGE_ORDER_INVALID"]);
});

test("rejects duplicate check identifiers within a stage", () => {
  assert.throws(
    () => advanceWorkflow({
      ...base,
      checks: {
        concept: [
          { id: "concept.ready", label: "Concept is approved", passed: true },
          { id: "concept.ready", label: "Duplicate", passed: true },
        ],
      },
    }),
    /Duplicate workflow check id/
  );
});

test("rejects malformed workflow checks instead of treating them as ready", () => {
  assert.throws(
    () => advanceWorkflow({
      ...base,
      checks: { concept: [{ id: "concept.ready", label: "Concept is approved", passed: "yes" }] },
    }),
    /must declare passed as a boolean/
  );
});

test("cannot advance beyond the release stage", () => {
  const result = advanceWorkflow({
    ...base,
    currentStage: "release",
    checks: { release: [{ id: "release.ready", label: "Release is approved", passed: true }] },
  });
  assert.equal(result.decision, "blocked");
  assert.equal(result.toStage, "release");
  assert.deepEqual(result.blockers, ["WORKFLOW_STAGE_ORDER_INVALID", "WORKFLOW_FINAL_STAGE_REACHED"]);
});

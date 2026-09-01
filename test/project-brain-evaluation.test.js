const test = require("node:test");
const assert = require("node:assert/strict");

const { createMemoryRecord } = require("../.forge-build/domain/memory.js");
const { ProjectMemoryStore } = require("../.forge-build/application/project-memory-store.js");
const { evaluateProjectBrainRetrieval } = require("../.forge-build/application/project-brain-evaluation.js");

function memory(id, content, authority = "authoritative", projectId = "project-1") {
  return createMemoryRecord({
    id,
    projectId,
    class: "story-canon",
    authority,
    summary: content,
    content,
    provenance: [{ kind: "author", reference: `canon:${id}`, recordedAt: "2026-01-01T00:00:00.000Z" }],
    now: "2026-01-01T00:00:00.000Z",
  });
}

test("retrieval evaluation computes deterministic ID recall and forbidden-memory leakage", () => {
  const store = new ProjectMemoryStore();
  store.register(memory("needed-a", "Mara carries the brass key."));
  store.register(memory("needed-b", "Mara hides the brass key beneath the stairs."));
  store.register(memory("forbidden", "An obsolete brass key note."));

  const report = evaluateProjectBrainRetrieval(store, [{
    id: "brass-key-context",
    query: { projectId: "project-1", queryTerms: ["brass key"], limit: 2 },
    expectedMemoryIds: ["needed-a", "needed-b"],
    forbiddenMemoryIds: ["forbidden"],
  }]);

  assert.equal(report.caseCount, 1);
  assert.equal(report.passedCount, 1);
  assert.equal(report.failedCount, 0);
  assert.equal(report.expectedRecall, 1);
  assert.equal(report.forbiddenLeakRate, 0);
  assert.deepEqual(report.cases[0].retrievedExpectedIds, ["needed-a", "needed-b"]);
  assert.deepEqual(report.cases[0].retrievedForbiddenIds, []);
});

test("retrieval evaluation reports missing expected memory without an LLM judge", () => {
  const store = new ProjectMemoryStore();
  store.register(memory("first", "A river crossing."));
  store.register(memory("second", "A river crossing after midnight."));

  const report = evaluateProjectBrainRetrieval(store, [{
    id: "tight-window",
    query: { projectId: "project-1", queryTerms: ["river crossing"], limit: 1 },
    expectedMemoryIds: ["first", "second"],
  }]);

  assert.equal(report.passedCount, 0);
  assert.equal(report.failedCount, 1);
  assert.equal(report.expectedRecall, 0.5);
  assert.equal(report.cases[0].missingExpectedIds.length, 1);
  assert.equal(report.cases[0].forbiddenLeakRate, 0);
});

test("retrieval evaluation makes forbidden-memory leakage explicit", () => {
  const store = new ProjectMemoryStore();
  store.register(memory("expected", "The observatory clock stops at midnight."));
  store.register(memory("stale", "The observatory clock stops at midnight too."));

  const report = evaluateProjectBrainRetrieval(store, [{
    id: "stale-leak",
    query: { projectId: "project-1", queryTerms: ["observatory clock"] },
    expectedMemoryIds: ["expected"],
    forbiddenMemoryIds: ["stale"],
  }]);

  assert.equal(report.failedCount, 1);
  assert.equal(report.expectedRecall, 1);
  assert.equal(report.forbiddenLeakRate, 1);
  assert.deepEqual(report.cases[0].retrievedForbiddenIds, ["stale"]);
});

test("retrieval evaluation supports governed entity and point-in-time Brain queries", () => {
  const store = new ProjectMemoryStore();
  store.register(memory("old", "May Parker wears a red scarf."));
  store.register(memory("new", "May Parker wears a blue scarf."));
  store.supersede("old", "new", {
    actor: "author",
    reason: "Author changed the scarf color.",
    now: "2026-02-01T00:00:00.000Z",
  });

  const report = evaluateProjectBrainRetrieval(store, [{
    id: "historical-entity",
    query: {
      projectId: "project-1",
      asOf: "2026-01-15T00:00:00.000Z",
      entityMatchRules: [{ entityId: "may", aliases: ["May Parker"] }],
    },
    expectedMemoryIds: ["old", "new"],
  }]);

  assert.equal(report.passedCount, 1);
  assert.equal(report.expectedRecall, 1);
});

test("retrieval evaluation validates cases and contradictory expectations before execution", () => {
  const store = new ProjectMemoryStore();
  store.register(memory("one", "One fact."));

  assert.throws(() => evaluateProjectBrainRetrieval(store, []), /requires at least one case/i);
  assert.throws(() => evaluateProjectBrainRetrieval(store, [{
    id: "bad",
    query: { projectId: "project-1" },
    expectedMemoryIds: [],
  }]), /expected memory ids must contain at least one/i);
  assert.throws(() => evaluateProjectBrainRetrieval(store, [{
    id: "overlap",
    query: { projectId: "project-1" },
    expectedMemoryIds: ["one"],
    forbiddenMemoryIds: ["one"],
  }]), /cannot expect and forbid memory "one"/i);
  assert.throws(() => evaluateProjectBrainRetrieval(store, [
    { id: "duplicate", query: { projectId: "project-1" }, expectedMemoryIds: ["one"] },
    { id: "duplicate", query: { projectId: "project-1" }, expectedMemoryIds: ["one"] },
  ]), /case id "duplicate" is duplicated/i);
});

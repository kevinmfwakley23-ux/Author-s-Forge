const assert = require("node:assert/strict");
const test = require("node:test");
const { createMemoryRecord } = require("../.forge-build/domain/memory.js");
const { ProjectMemoryStore } = require("../.forge-build/application/project-memory-store.js");
const { assembleProjectBrainContext } = require("../.forge-build/application/project-brain.js");

test("changedSince does not bypass working-state authority policy", () => {
  const store = new ProjectMemoryStore();
  store.register(createMemoryRecord({
    id: "canon",
    projectId: "p1",
    class: "story-canon",
    authority: "authoritative",
    summary: "Authoritative",
    content: "Approved canon.",
    provenance: [{ kind: "author", reference: "canon", recordedAt: "2026-01-01T00:00:00.000Z" }],
    now: "2026-03-01T00:00:01.000Z",
  }));
  store.register(createMemoryRecord({
    id: "working",
    projectId: "p1",
    class: "creative-note",
    authority: "working",
    summary: "Working",
    content: "Unapproved possibility.",
    now: "2026-03-01T00:00:02.000Z",
  }));

  const defaultContext = assembleProjectBrainContext(store, {
    projectId: "p1",
    changedSince: "2026-03-01T00:00:00.000Z",
  });

  assert.deepEqual(defaultContext.authoritative.map((memory) => memory.id), ["canon"]);
  assert.deepEqual(defaultContext.working, []);
  assert.deepEqual(defaultContext.changed.map((memory) => memory.id), ["canon"]);

  const workingContext = assembleProjectBrainContext(store, {
    projectId: "p1",
    changedSince: "2026-03-01T00:00:00.000Z",
    includeWorkingState: true,
  });

  assert.deepEqual(workingContext.authoritative.map((memory) => memory.id), ["canon"]);
  assert.deepEqual(workingContext.working.map((memory) => memory.id), ["working"]);
  assert.deepEqual(workingContext.changed.map((memory) => memory.id), ["canon", "working"]);
});
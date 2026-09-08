const test = require("node:test");
const assert = require("node:assert/strict");
const { ProjectMemoryStore } = require("../.forge-build/application/project-memory-store.js");
const { createMemoryRecord } = require("../.forge-build/domain/memory.js");
const { buildProjectContext } = require("../.forge-build/application/context-pipeline.js");

function memory(id, authority, content) {
  return createMemoryRecord({
    id,
    projectId: "p1",
    class: "story-canon",
    authority,
    summary: id,
    content,
    provenance: [{ kind: "author", reference: id, recordedAt: "2026-01-01T00:00:00.000Z" }],
  });
}

test("project context removes normalized duplicate memory payloads before budgeting", () => {
  const store = new ProjectMemoryStore();
  store.register(memory("canon-a", "authoritative", "The lighthouse is on the north shore and remains open at dawn."));
  store.register(memory("canon-b", "authoritative", "  The lighthouse is on the north shore and remains open at dawn.  "));
  const result = buildProjectContext(store, { query: { projectId: "p1" }, budget: 1000 });

  assert.equal(result.selectedMemoryIds.length, 1);
  assert.equal(result.omittedMemoryIds.length, 1);
  assert.ok(result.strategies.includes("session-context-deduplication"));
});

const test = require("node:test");
const assert = require("node:assert/strict");
const { ProjectMemoryStore } = require("../.forge-build/application/project-memory-store.js");
const { createMemoryRecord } = require("../.forge-build/domain/memory.js");
const { buildProjectContext } = require("../.forge-build/application/context-pipeline.js");

function memory(id, authority, summary, content, memoryClass = "story-canon") {
  return createMemoryRecord({
    id,
    projectId: "p1",
    class: memoryClass,
    authority,
    summary,
    content,
    provenance: [{ kind: "author", reference: id, recordedAt: "2026-01-01T00:00:00.000Z" }],
  });
}

test("project context removes normalized duplicate payloads before budgeting even when summaries differ", () => {
  const store = new ProjectMemoryStore();
  store.register(memory("canon-a", "authoritative", "Opening location", "The lighthouse is on the north shore and remains open at dawn."));
  store.register(memory("canon-b", "authoritative", "Lighthouse status", "  THE lighthouse is on the north shore   and remains open at dawn.  "));

  const result = buildProjectContext(store, { query: { projectId: "p1" }, budget: 1000 });

  assert.deepEqual(result.selectedMemoryIds, ["canon-a"]);
  assert.ok(result.omittedMemoryIds.includes("canon-b"));
  assert.ok(result.strategies.includes("normalized-memory-deduplication"));
  assert.equal((result.system.match(/lighthouse/gi) ?? []).length, 1);
});

test("project context keeps the authoritative copy when a working memory repeats the same canon payload", () => {
  const store = new ProjectMemoryStore();
  store.register(memory("working-copy", "working", "Working note", "Mara carries the brass compass."));
  store.register(memory("canon-copy", "authoritative", "Locked canon", "Mara carries the brass compass."));

  const result = buildProjectContext(store, { query: { projectId: "p1", includeWorkingState: true }, budget: 1000 });

  assert.ok(result.selectedMemoryIds.includes("canon-copy"));
  assert.ok(result.omittedMemoryIds.includes("working-copy"));
  assert.doesNotMatch(result.system, /\[story-canon \| working\]/);
  assert.match(result.system, /\[story-canon \| authoritative\]/);
});

test("project context does not deduplicate identical text across different memory classes", () => {
  const store = new ProjectMemoryStore();
  store.register(memory("canon", "authoritative", "Story fact", "The brass compass points east.", "story-canon"));
  store.register(memory("object", "authoritative", "Object fact", "The brass compass points east.", "project-memory"));

  const result = buildProjectContext(store, { query: { projectId: "p1" }, budget: 1000 });

  assert.equal(result.selectedMemoryIds.length, 2);
  assert.equal(result.omittedMemoryIds.length, 0);
});

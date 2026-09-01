const test = require("node:test");
const assert = require("node:assert/strict");
const { ProjectMemoryStore } = require("../.forge-build/application/project-memory-store.js");
const { createMemoryRecord } = require("../.forge-build/domain/memory.js");

function baseMemory() {
  return createMemoryRecord({
    id: "canon-1",
    projectId: "p1",
    class: "story-canon",
    authority: "authoritative",
    summary: "Stable canon",
    content: "Mara carries the brass compass.",
    provenance: [{ kind: "author", reference: "canon", recordedAt: "2026-01-01T00:00:00.000Z" }],
    now: "2026-01-01T00:00:00.000Z",
  });
}

test("restore rejects malformed supersession links without replacing valid memory", () => {
  const store = new ProjectMemoryStore();
  const current = baseMemory();
  store.register(current);

  const malformed = { ...current, id: "bad-link", supersedes: 42 };
  assert.throws(() => store.restore([malformed]), /supersedes must be a non-empty string/);
  assert.deepEqual(store.list(), [current]);
});

test("restore rejects duplicate relationship ids and tags without replacing valid memory", () => {
  const store = new ProjectMemoryStore();
  const current = baseMemory();
  store.register(current);

  assert.throws(() => store.restore([{ ...current, id: "bad-related", relatedMemoryIds: ["x", "x"] }]), /related ids must not contain duplicates/);
  assert.deepEqual(store.list(), [current]);
  assert.throws(() => store.restore([{ ...current, id: "bad-tags", relevanceTags: ["canon", "canon"] }]), /relevance tags must not contain duplicates/);
  assert.deepEqual(store.list(), [current]);
});

test("restore rejects contradictory bidirectional supersession links", () => {
  const store = new ProjectMemoryStore();
  const current = baseMemory();
  store.register(current);
  const malformed = { ...current, id: "bad-cycle", supersedes: "other", supersededBy: "other" };
  assert.throws(() => store.restore([malformed]), /cannot point to the same record in both directions/);
  assert.deepEqual(store.list(), [current]);
});

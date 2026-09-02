const test = require("node:test");
const assert = require("node:assert/strict");
const { ProjectMemoryStore } = require("../.forge-build/application/project-memory-store.js");
const { createMemoryRecord, validateMemoryRecord } = require("../.forge-build/domain/memory.js");

function baseMemory(overrides = {}) {
  return createMemoryRecord({
    id: "canon-1",
    projectId: "p1",
    class: "story-canon",
    authority: "authoritative",
    summary: "Stable canon",
    content: "Mara carries the brass compass.",
    provenance: [{ kind: "author", reference: "canon", recordedAt: "2026-01-01T00:00:00.000Z" }],
    relatedMemoryIds: ["character-mara"],
    relevanceTags: ["canon", "compass"],
    now: "2026-01-01T00:00:00.000Z",
    ...overrides,
  });
}

test("restore rejects malformed supersession link types without replacing valid memory", () => {
  const store = new ProjectMemoryStore();
  const current = baseMemory();
  store.register(current);

  const malformedSupersedes = { ...current, id: "bad-link", supersedes: 42 };
  assert.throws(() => store.restore([malformedSupersedes]), /supersedes must be a non-empty string/);
  assert.deepEqual(store.list(), [current]);

  const malformedSupersededBy = { ...current, id: "bad-back-link", supersededBy: {} };
  assert.throws(() => store.restore([malformedSupersededBy]), /supersededBy must be a non-empty string/);
  assert.deepEqual(store.list(), [current]);
});

test("restore rejects duplicate relationship ids and relevance tags without replacing valid memory", () => {
  const store = new ProjectMemoryStore();
  const current = baseMemory();
  store.register(current);

  assert.throws(
    () => store.restore([{ ...current, id: "bad-related", relatedMemoryIds: ["x", "x"] }]),
    /related ids must not contain duplicates/,
  );
  assert.deepEqual(store.list(), [current]);

  assert.throws(
    () => store.restore([{ ...current, id: "bad-tags", relevanceTags: ["canon", "canon"] }]),
    /relevance tags must not contain duplicates/,
  );
  assert.deepEqual(store.list(), [current]);
});

test("restore rejects contradictory bidirectional supersession links", () => {
  const store = new ProjectMemoryStore();
  const current = baseMemory();
  store.register(current);

  const malformed = { ...current, id: "bad-cycle", supersedes: "other", supersededBy: "other" };
  assert.throws(
    () => store.restore([malformed]),
    /cannot point to the same record in both directions/,
  );
  assert.deepEqual(store.list(), [current]);
});

test("createMemoryRecord still normalizes author input while raw persisted runtime shape stays strict", () => {
  const normalized = baseMemory({
    id: "normalized",
    relatedMemoryIds: ["beta", "alpha", "beta", "   alpha   "],
    relevanceTags: ["voice", "canon", "voice"],
  });

  assert.deepEqual(normalized.relatedMemoryIds, ["alpha", "beta"]);
  assert.deepEqual(normalized.relevanceTags, ["canon", "voice"]);
  assert.doesNotThrow(() => validateMemoryRecord(normalized));
});

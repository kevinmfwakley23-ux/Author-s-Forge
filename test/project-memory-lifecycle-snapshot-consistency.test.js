const assert = require("node:assert/strict");
const test = require("node:test");
const { createMemoryRecord } = require("../.forge-build/domain/memory.js");
const { ProjectMemoryStore } = require("../.forge-build/application/project-memory-store.js");

function memory(id, authority, now, memoryClass = "story-canon") {
  return createMemoryRecord({
    id,
    projectId: "p1",
    class: memoryClass,
    authority,
    summary: `${id} summary`,
    content: `${id} content`,
    provenance: authority === "authoritative" ? [{ kind: "author", reference: id, recordedAt: now }] : [{ kind: "author", reference: id, recordedAt: now }],
    now,
  });
}

function lifecycleFixture() {
  const store = new ProjectMemoryStore();
  store.register(memory("source", "working", "2026-01-01T00:00:00.000Z"));
  store.promote("source", "author", "Author approved source canon.", "2026-02-01T00:00:00.000Z");
  store.register(memory("replacement", "authoritative", "2026-03-01T00:00:00.000Z"));
  store.supersede("source", "replacement", { actor: "author", reason: "Author approved replacement.", now: "2026-04-01T00:00:00.000Z" });
  return store.createSnapshot("p1");
}

test("supersession timestamps both mutated records so changedSince sees reciprocal link changes", () => {
  const store = new ProjectMemoryStore();
  store.register(memory("old", "authoritative", "2026-01-01T00:00:00.000Z"));
  store.register(memory("new", "authoritative", "2026-02-01T00:00:00.000Z"));

  store.supersede("old", "new", { actor: "author", reason: "Replace old canon.", now: "2026-03-01T00:00:00.000Z" });

  assert.equal(store.get("old").updatedAt, "2026-03-01T00:00:00.000Z");
  assert.equal(store.get("new").updatedAt, "2026-03-01T00:00:00.000Z");
  assert.equal(store.get("new").supersedes, "old");
  assert.deepEqual(store.query({ projectId: "p1", changedSince: "2026-02-15T00:00:00.000Z" }).map((item) => item.id), ["new", "old"]);
});

test("snapshot recovery rejects lifecycle events whose authority transition cannot produce recovered state", () => {
  const snapshot = lifecycleFixture();
  const promotionIndex = snapshot.lifecycleEvents.findIndex((event) => event.type === "promotion");
  const malformed = {
    ...snapshot,
    lifecycleEvents: snapshot.lifecycleEvents.map((event, index) => index === promotionIndex ? { ...event, to: "working" } : event),
  };
  const target = new ProjectMemoryStore();
  target.register(memory("safe", "working", "2026-01-01T00:00:00.000Z", "project-memory"));
  const before = target.list();

  assert.throws(() => target.restoreSnapshot(malformed), /impossible authority transition/i);
  assert.deepEqual(target.list(), before);
});

test("snapshot recovery rejects events before their memory endpoints and inconsistent reciprocal links", () => {
  const snapshot = lifecycleFixture();
  const promotionIndex = snapshot.lifecycleEvents.findIndex((event) => event.type === "promotion");
  const early = {
    ...snapshot,
    lifecycleEvents: snapshot.lifecycleEvents.map((event, index) => index === promotionIndex ? { ...event, occurredAt: "2025-12-31T23:59:59.000Z" } : event),
  };
  assert.throws(() => new ProjectMemoryStore().restoreSnapshot(early), /predates memory/i);

  const brokenLinks = {
    ...snapshot,
    memories: snapshot.memories.map((item) => item.id === "replacement" ? { ...item, supersedes: undefined } : item),
  };
  assert.throws(() => new ProjectMemoryStore().restoreSnapshot(brokenLinks), /reciprocal supersession links/i);
});

test("snapshot recovery rejects cross-class supersession and final authority drift", () => {
  const snapshot = lifecycleFixture();
  const crossClass = {
    ...snapshot,
    memories: snapshot.memories.map((item) => item.id === "replacement" ? { ...item, class: "character-memory" } : item),
  };
  assert.throws(() => new ProjectMemoryStore().restoreSnapshot(crossClass), /crosses memory classes/i);

  const authorityDrift = {
    ...snapshot,
    memories: snapshot.memories.map((item) => item.id === "source" ? { ...item, authority: "authoritative" } : item),
  };
  assert.throws(() => new ProjectMemoryStore().restoreSnapshot(authorityDrift), /does not reconstruct current authority/i);
});

test("snapshot recovery validates runtime containers and duplicate memory identity before mutation", () => {
  const target = new ProjectMemoryStore();
  target.register(memory("safe-runtime", "working", "2026-01-01T00:00:00.000Z", "project-memory"));
  const before = target.list();

  assert.throws(() => target.restoreSnapshot({ formatVersion: 1, projectId: "p1", memories: "not-an-array" }), /memories must be an array/i);
  assert.deepEqual(target.list(), before);

  const snapshot = lifecycleFixture();
  assert.throws(() => target.restoreSnapshot({ ...snapshot, lifecycleEvents: [null] }), /invalid memory lifecycle event/i);
  assert.deepEqual(target.list(), before);

  assert.throws(() => target.restoreSnapshot({ ...snapshot, memories: [...snapshot.memories, snapshot.memories[0]] }), /duplicate memory id/i);
  assert.deepEqual(target.list(), before);
});

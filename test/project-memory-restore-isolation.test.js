const test = require("node:test");
const assert = require("node:assert/strict");
const { ProjectMemoryStore } = require("../.forge-build/application/project-memory-store.js");
const { createMemoryRecord } = require("../.forge-build/domain/memory.js");

function memory(id, projectId, content) {
  return createMemoryRecord({
    id,
    projectId,
    class: "story-canon",
    authority: "authoritative",
    summary: id,
    content,
    provenance: [{ kind: "author", reference: id, recordedAt: "2026-01-01T00:00:00.000Z" }],
    now: "2026-01-01T00:00:00.000Z",
  });
}

test("restoring one project snapshot preserves every other project's loaded memory", () => {
  const source = new ProjectMemoryStore();
  source.register(memory("p1-new", "p1", "New project-one canon."));
  const snapshot = source.createSnapshot("p1");

  const target = new ProjectMemoryStore();
  target.register(memory("p1-old", "p1", "Old project-one canon."));
  target.register(memory("p2-canon", "p2", "Project two must survive recovery."));

  target.restoreSnapshot(snapshot);

  assert.equal(target.get("p1-old"), undefined);
  assert.equal(target.get("p1-new").content, "New project-one canon.");
  assert.equal(target.get("p2-canon").content, "Project two must survive recovery.");
  assert.deepEqual(target.query({ projectId: "p2" }).map((item) => item.id), ["p2-canon"]);
});

test("snapshot restore validates duplicate ids before mutating any loaded project", () => {
  const target = new ProjectMemoryStore();
  const existing = memory("shared-id", "p2", "Existing project-two state.");
  target.register(existing);
  const before = target.list();

  const snapshot = {
    formatVersion: 1,
    projectId: "p1",
    memories: [memory("shared-id", "p1", "Colliding project-one state.")],
  };

  assert.throws(() => target.restoreSnapshot(snapshot), /Duplicate memory id/);
  assert.deepEqual(target.list(), before);
});

test("whole-store restore validates duplicates before clearing existing state", () => {
  const target = new ProjectMemoryStore();
  target.register(memory("safe", "p1", "Safe existing state."));
  const before = target.list();
  const duplicate = memory("duplicate", "p1", "Duplicate state.");

  assert.throws(() => target.restore([duplicate, duplicate]), /Duplicate memory id/);
  assert.deepEqual(target.list(), before);
});

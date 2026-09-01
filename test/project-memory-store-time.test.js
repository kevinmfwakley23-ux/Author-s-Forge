const assert = require("node:assert/strict");
const test = require("node:test");
const { createMemoryRecord } = require("../.forge-build/domain/memory.js");
const { ProjectMemoryStore } = require("../.forge-build/application/project-memory-store.js");

test("changedSince compares real instants instead of timestamp strings", () => {
  const store = new ProjectMemoryStore();
  store.register(createMemoryRecord({
    id: "same-instant",
    projectId: "p1",
    class: "story-canon",
    authority: "working",
    summary: "Same instant",
    content: "Equivalent timestamp with an offset.",
    now: "2026-02-01T00:00:00.000-08:00",
  }));
  store.register(createMemoryRecord({
    id: "later-instant",
    projectId: "p1",
    class: "story-canon",
    authority: "working",
    summary: "Later instant",
    content: "Actually changed later.",
    now: "2026-02-01T08:00:01.000Z",
  }));

  const changed = store.query({ projectId: "p1", changedSince: "2026-02-01T08:00:00.000Z" });

  assert.deepEqual(changed.map((memory) => memory.id), ["later-instant"]);
});

test("changedSince respects equivalent non-UTC query offsets", () => {
  const store = new ProjectMemoryStore();
  store.register(createMemoryRecord({
    id: "before",
    projectId: "p1",
    class: "story-canon",
    authority: "working",
    summary: "Before",
    content: "Before boundary.",
    now: "2026-02-01T07:59:59.999Z",
  }));
  store.register(createMemoryRecord({
    id: "after",
    projectId: "p1",
    class: "story-canon",
    authority: "working",
    summary: "After",
    content: "After boundary.",
    now: "2026-02-01T08:00:00.001Z",
  }));

  const changed = store.query({ projectId: "p1", changedSince: "2026-02-01T00:00:00.000-08:00" });

  assert.deepEqual(changed.map((memory) => memory.id), ["after"]);
});
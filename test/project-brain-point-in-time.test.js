const test = require("node:test");
const assert = require("node:assert/strict");

const { createMemoryRecord } = require("../.forge-build/domain/memory.js");
const { ProjectMemoryStore } = require("../.forge-build/application/project-memory-store.js");
const { assembleProjectBrainContext } = require("../.forge-build/application/project-brain.js");

function memory(id, authority, content, now, projectId = "project-1") {
  return createMemoryRecord({
    id,
    projectId,
    class: "story-canon",
    authority,
    summary: content,
    content,
    provenance: [{ kind: "author", reference: `canon:${id}`, recordedAt: now }],
    now,
  });
}

test("point-in-time memory query reverses a later author promotion", () => {
  const store = new ProjectMemoryStore();
  store.register(memory("scene-state", "working", "The lantern is unlit.", "2026-01-01T00:00:00.000Z"));
  store.promote("scene-state", "author", "Approved scene state.", "2026-02-01T00:00:00.000Z");

  assert.equal(store.get("scene-state").authority, "authoritative");
  const historical = store.queryAt({ projectId: "project-1" }, "2026-01-15T00:00:00.000Z");
  assert.equal(historical.length, 1);
  assert.equal(historical[0].authority, "working");
  assert.equal(historical[0].updatedAt, "2026-01-01T00:00:00.000Z");
});

test("point-in-time memory query restores pre-supersession canon and link state", () => {
  const store = new ProjectMemoryStore();
  store.register(memory("old-canon", "authoritative", "Mara wears a red scarf.", "2026-01-01T00:00:00.000Z"));
  store.register(memory("new-canon", "authoritative", "Mara wears a blue scarf.", "2026-01-10T00:00:00.000Z"));
  store.supersede("old-canon", "new-canon", {
    actor: "author",
    reason: "Author changed the scarf color.",
    now: "2026-02-01T00:00:00.000Z",
  });

  const before = store.queryAt({ projectId: "project-1" }, "2026-01-20T00:00:00.000Z");
  const oldBefore = before.find((item) => item.id === "old-canon");
  const newBefore = before.find((item) => item.id === "new-canon");
  assert.equal(oldBefore.authority, "authoritative");
  assert.equal(oldBefore.supersededBy, undefined);
  assert.equal(newBefore.supersedes, undefined);

  const currentOld = store.get("old-canon");
  const currentNew = store.get("new-canon");
  assert.equal(currentOld.authority, "superseded");
  assert.equal(currentOld.supersededBy, "new-canon");
  assert.equal(currentNew.supersedes, "old-canon");
});

test("point-in-time reconstruction excludes memories that did not exist yet and stays project-scoped", () => {
  const store = new ProjectMemoryStore();
  store.register(memory("early", "authoritative", "Early fact.", "2026-01-01T00:00:00.000Z"));
  store.register(memory("later", "authoritative", "Later fact.", "2026-03-01T00:00:00.000Z"));
  store.register(memory("other-project", "authoritative", "Other project fact.", "2026-01-01T00:00:00.000Z", "project-2"));

  const result = store.queryAt({ projectId: "project-1" }, "2026-02-01T00:00:00.000Z");
  assert.deepEqual(result.map((item) => item.id), ["early"]);
});

test("point-in-time reconstruction fails closed when an update has no lifecycle evidence", () => {
  const store = new ProjectMemoryStore();
  const base = memory("unexplained", "working", "Unexplained imported update.", "2026-01-01T00:00:00.000Z");
  store.register({ ...base, updatedAt: "2026-03-01T00:00:00.000Z" });

  assert.throws(
    () => store.queryAt({ projectId: "project-1" }, "2026-02-01T00:00:00.000Z"),
    /update history is incomplete/i,
  );
});

test("Project Brain retrieves the canon valid at asOf without leaking current supersession state", () => {
  const store = new ProjectMemoryStore();
  store.register(memory("old-canon", "authoritative", "Mara wears a red scarf.", "2026-01-01T00:00:00.000Z"));
  store.register(memory("new-canon", "authoritative", "Mara wears a blue scarf.", "2026-01-10T00:00:00.000Z"));
  store.supersede("old-canon", "new-canon", {
    actor: "author",
    reason: "Author changed the scarf color.",
    now: "2026-02-01T00:00:00.000Z",
  });

  const historical = assembleProjectBrainContext(store, {
    projectId: "project-1",
    queryTerms: ["red scarf"],
    asOf: "2026-01-20T00:00:00.000Z",
  });
  assert.deepEqual(historical.authoritative.map((item) => item.id), ["old-canon"]);
  assert.equal(historical.asOf, "2026-01-20T00:00:00.000Z");
  assert.ok(historical.evidence[0].reasons.includes("as-of:2026-01-20T00:00:00.000Z"));

  const current = assembleProjectBrainContext(store, { projectId: "project-1", queryTerms: ["red scarf"] });
  assert.deepEqual(current.authoritative, []);
});

test("Project Brain validates historical query semantics before retrieval", () => {
  const store = new ProjectMemoryStore();
  store.register(memory("one", "authoritative", "A fact.", "2026-01-01T00:00:00.000Z"));

  assert.throws(
    () => assembleProjectBrainContext(store, { projectId: "project-1", asOf: "not-a-date" }),
    /asOf must be a valid timestamp/i,
  );
  assert.throws(
    () => assembleProjectBrainContext(store, {
      projectId: "project-1",
      changedSince: "2026-01-01T00:00:00.000Z",
      asOf: "2026-02-01T00:00:00.000Z",
    }),
    /changedSince and asOf cannot be combined/i,
  );
  assert.throws(
    () => store.queryAt({}, "2026-02-01T00:00:00.000Z"),
    /requires a project id/i,
  );
});

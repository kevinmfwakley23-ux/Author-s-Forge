const test = require("node:test");
const assert = require("node:assert/strict");

const { createMemoryRecord } = require("../.forge-build/domain/memory.js");
const { ProjectMemoryStore } = require("../.forge-build/application/project-memory-store.js");
const { assembleProjectBrainContext } = require("../.forge-build/application/project-brain.js");

function stateMemory(id, authority, stateKey, stateValue, now = "2026-01-01T00:00:00.000Z") {
  return createMemoryRecord({
    id,
    projectId: "project-1",
    class: "story-canon",
    authority,
    summary: `${stateKey}: ${stateValue}`,
    content: `${stateKey}: ${stateValue}`,
    stateKey,
    stateValue,
    provenance: [{ kind: "author", reference: `canon:${id}`, recordedAt: now }],
    now,
  });
}

test("memory state claims normalize stable keys and require a complete key/value pair", () => {
  const record = stateMemory("one", "authoritative", " Character / Mara / Scarf Color ", "  Blue  ");
  assert.equal(record.stateKey, "character / mara / scarf color");
  assert.equal(record.stateValue, "Blue");

  assert.throws(() => createMemoryRecord({
    id: "missing-value",
    projectId: "project-1",
    class: "story-canon",
    authority: "working",
    summary: "Missing value",
    content: "Missing value",
    stateKey: "character/mara/scarf",
    now: "2026-01-01T00:00:00.000Z",
  }), /state key and state value must be provided together/i);
});

test("Project Brain fails closed on conflicting live authoritative state claims", () => {
  const store = new ProjectMemoryStore();
  store.register(stateMemory("red", "authoritative", "character/mara/scarf", "red"));
  store.register(stateMemory("blue", "authoritative", "character/mara/scarf", "blue"));

  assert.throws(
    () => assembleProjectBrainContext(store, { projectId: "project-1" }),
    /authoritative state conflict.*character\/mara\/scarf.*blue.*red|authoritative state conflict.*character\/mara\/scarf/i,
  );
});

test("equivalent authoritative state values do not create a false conflict", () => {
  const store = new ProjectMemoryStore();
  store.register(stateMemory("one", "authoritative", "character/mara/scarf", "Blue"));
  store.register(stateMemory("two", "authoritative", "character/mara/scarf", " blue "));

  const result = assembleProjectBrainContext(store, { projectId: "project-1" });
  assert.deepEqual(result.authoritative.map((item) => item.id), ["one", "two"]);
});

test("author supersession resolves an authoritative state conflict without deleting history", () => {
  const store = new ProjectMemoryStore();
  store.register(stateMemory("old", "authoritative", "character/mara/scarf", "red", "2026-01-01T00:00:00.000Z"));
  store.register(stateMemory("new", "authoritative", "character/mara/scarf", "blue", "2026-01-02T00:00:00.000Z"));
  store.supersede("old", "new", {
    actor: "author",
    reason: "Author changed the canonical scarf color.",
    now: "2026-01-03T00:00:00.000Z",
  });

  const result = assembleProjectBrainContext(store, { projectId: "project-1" });
  assert.deepEqual(result.authoritative.map((item) => item.id), ["new"]);
  assert.equal(store.get("old").authority, "superseded");
  assert.equal(store.get("old").stateValue, "red");
});

test("non-authoritative alternatives remain reviewable without overriding authoritative state", () => {
  const store = new ProjectMemoryStore();
  store.register(stateMemory("canon", "authoritative", "character/mara/scarf", "blue"));
  store.register(stateMemory("alternative", "working", "character/mara/scarf", "green"));

  const result = assembleProjectBrainContext(store, { projectId: "project-1", includeWorkingState: true });
  assert.deepEqual(result.authoritative.map((item) => item.id), ["canon"]);
  assert.deepEqual(result.working.map((item) => item.id), ["alternative"]);
});

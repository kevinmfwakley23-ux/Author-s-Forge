const test = require("node:test");
const assert = require("node:assert/strict");

const { createMemoryRecord } = require("../.forge-build/domain/memory.js");
const { ProjectMemoryStore } = require("../.forge-build/application/project-memory-store.js");
const { assembleProjectBrainContext } = require("../.forge-build/application/project-brain.js");

function memory(id, authority, memoryClass, content, relevanceTags = []) {
  return createMemoryRecord({
    id,
    projectId: "project-1",
    class: memoryClass,
    authority,
    summary: content,
    content,
    relevanceTags,
    provenance: [{ kind: "author", reference: `memory:${id}`, recordedAt: "2026-01-01T00:00:00.000Z" }],
    now: "2026-01-01T00:00:00.000Z",
  });
}

test("unrequested working state cannot consume a tight authoritative retrieval window", () => {
  const store = new ProjectMemoryStore();
  store.register(memory("canon", "authoritative", "story-canon", "The oak door is locked."));
  store.register(memory("working", "working", "story-canon", "The oak door may be painted blue.", ["a", "b", "c", "d"]));

  const authoritativeOnly = assembleProjectBrainContext(store, {
    projectId: "project-1",
    queryTerms: ["oak door"],
    relevanceTags: ["a", "b", "c", "d"],
    limit: 1,
  });

  assert.deepEqual(authoritativeOnly.authoritative.map((item) => item.id), ["canon"]);
  assert.deepEqual(authoritativeOnly.working, []);
  assert.deepEqual(authoritativeOnly.evidence.map((item) => item.memoryId), ["canon"]);

  const explicitWorking = assembleProjectBrainContext(store, {
    projectId: "project-1",
    queryTerms: ["oak door"],
    relevanceTags: ["a", "b", "c", "d"],
    includeWorkingState: true,
    limit: 1,
  });

  assert.deepEqual(explicitWorking.authoritative, []);
  assert.deepEqual(explicitWorking.working.map((item) => item.id), ["working"]);
  assert.deepEqual(explicitWorking.evidence.map((item) => item.memoryId), ["working"]);
});

test("retrieval diagnostics explain bounded exclusion counts without exposing manuscript content", () => {
  const store = new ProjectMemoryStore();
  store.register(memory("selected", "authoritative", "story-canon", "signal alpha"));
  store.register(memory("limited", "authoritative", "story-canon", "signal beta"));
  store.register(memory("working", "working", "story-canon", "signal gamma"));
  store.register(memory("archived", "archived", "story-canon", "signal delta"));
  store.register(memory("wrong-class", "authoritative", "creative-note", "signal epsilon"));

  const result = assembleProjectBrainContext(store, {
    projectId: "project-1",
    taskMemoryClasses: ["story-canon"],
    queryTerms: ["signal"],
    limit: 1,
    includeDiagnostics: true,
  });

  assert.deepEqual(result.diagnostics, {
    sourceCount: 5,
    liveCount: 4,
    classEligibleCount: 3,
    authorityEligibleCount: 2,
    saliencyMatchedCount: 2,
    selectedCount: 1,
    excluded: {
      inactive: 1,
      classMismatch: 1,
      unrequestedAuthority: 1,
      saliencyMismatch: 0,
      resultLimit: 1,
    },
  });

  const serialized = JSON.stringify(result.diagnostics);
  assert.equal(serialized.includes("signal alpha"), false);
  assert.equal(serialized.includes("signal gamma"), false);
});

test("diagnostics remain opt-in and runtime validation fails closed", () => {
  const store = new ProjectMemoryStore();
  store.register(memory("canon", "authoritative", "story-canon", "A signal."));

  const defaultResult = assembleProjectBrainContext(store, { projectId: "project-1" });
  assert.equal(Object.hasOwn(defaultResult, "diagnostics"), false);

  assert.throws(
    () => assembleProjectBrainContext(store, { projectId: "project-1", includeDiagnostics: "yes" }),
    /includeDiagnostics must be a boolean/i,
  );
});

const test = require("node:test");
const assert = require("node:assert/strict");
const { ProjectMemoryStore } = require("../.forge-build/application/project-memory-store.js");
const { assembleProjectBrainContext, PROJECT_BRAIN_MAX_RESULTS } = require("../.forge-build/application/project-brain.js");
const { createMemoryRecord } = require("../.forge-build/domain/memory.js");

function authoritative(id, summary, content, relevanceTags = []) {
  return createMemoryRecord({
    id,
    projectId: "project-1",
    class: "story-canon",
    authority: "authoritative",
    summary,
    content,
    provenance: [{ kind: "author", reference: `canon:${id}`, recordedAt: "2026-01-01T00:00:00.000Z" }],
    relevanceTags,
    now: "2026-01-01T00:00:00.000Z",
  });
}

test("Project Brain uses whole terms instead of leaking substring false positives", () => {
  const store = new ProjectMemoryStore();
  store.register(authoritative("party", "Birthday party", "The invitation is ready for the party.", ["party"]));
  store.register(authoritative("art", "Gallery art", "The stolen art hangs behind the curator.", ["gallery-art"]));

  const context = assembleProjectBrainContext(store, { projectId: "project-1", queryTerms: ["art"] });

  assert.deepEqual(context.authoritative.map((memory) => memory.id), ["art"]);
  assert.deepEqual(context.evidence.map((item) => item.memoryId), ["art"]);
  assert.ok(context.evidence[0].reasons.includes("terms:art"));
});

test("Project Brain matches normalized phrases and Unicode words deterministically", () => {
  const store = new ProjectMemoryStore();
  store.register(authoritative("cafe", "Café encounter", "Daniel meets the main character at Café Noir.", ["lead character"]));
  store.register(authoritative("warehouse", "Warehouse", "丹尼尔在仓库发现线索。", ["mystery"]));

  const phrase = assembleProjectBrainContext(store, { projectId: "project-1", queryTerms: ["  MAIN   CHARACTER  "] });
  const unicode = assembleProjectBrainContext(store, { projectId: "project-1", queryTerms: ["仓库"] });
  const compatibility = assembleProjectBrainContext(store, { projectId: "project-1", queryTerms: ["Cafe\u0301"] });

  assert.deepEqual(phrase.authoritative.map((memory) => memory.id), ["cafe"]);
  assert.deepEqual(unicode.authoritative.map((memory) => memory.id), ["warehouse"]);
  assert.deepEqual(compatibility.authoritative.map((memory) => memory.id), ["cafe"]);
});

test("Project Brain rejects malformed runtime query collections before retrieval", () => {
  const store = new ProjectMemoryStore();
  store.register(authoritative("safe", "Safe canon", "Author-approved fact."));

  assert.throws(() => assembleProjectBrainContext(store, { projectId: 42 }), /project id is required/);
  assert.throws(() => assembleProjectBrainContext(store, { projectId: "project-1", taskMemoryClasses: ["not-a-memory-class"] }), /memory class .* is invalid/);
  assert.throws(() => assembleProjectBrainContext(store, { projectId: "project-1", relevanceTags: null }), /relevance tags must be an array/);
  assert.throws(() => assembleProjectBrainContext(store, { projectId: "project-1", queryTerms: [" "] }), /query terms must contain non-empty strings/);
  assert.throws(() => assembleProjectBrainContext(store, { projectId: "project-1", relatedMemoryIds: [17] }), /related memory ids must contain non-empty strings/);
  assert.throws(() => assembleProjectBrainContext(store, { projectId: "project-1", changedSince: null }), /changedSince must be a valid timestamp/);
  assert.throws(() => assembleProjectBrainContext(store, { projectId: "project-1", includeWorkingState: "yes" }), /includeWorkingState must be a boolean/);
  assert.throws(() => assembleProjectBrainContext(store, { projectId: "project-1", limit: PROJECT_BRAIN_MAX_RESULTS + 1 }), /limit must be an integer from 0 to 256/);
});

test("Project Brain trims and deduplicates valid runtime selectors without changing evidence order", () => {
  const store = new ProjectMemoryStore();
  store.register(authoritative("canon", "Opening warehouse", "Daniel enters the warehouse.", ["opening"]));

  const context = assembleProjectBrainContext(store, {
    projectId: " project-1 ",
    taskMemoryClasses: ["story-canon", "story-canon"],
    relevanceTags: [" opening ", "opening"],
    queryTerms: [" Daniel ", "Daniel"],
    limit: 1,
  });

  assert.equal(context.projectId, "project-1");
  assert.deepEqual(context.authoritative.map((memory) => memory.id), ["canon"]);
  assert.deepEqual(context.evidence.map((item) => item.memoryId), ["canon"]);
});

test("Project Brain applies a bounded default retrieval window to unbounded callers", () => {
  const store = new ProjectMemoryStore();
  for (let index = 0; index < PROJECT_BRAIN_MAX_RESULTS + 20; index += 1) {
    store.register(authoritative(`canon-${String(index).padStart(3, "0")}`, `Canon ${index}`, `Author-approved fact number ${index}.`));
  }

  const context = assembleProjectBrainContext(store, { projectId: "project-1" });

  assert.equal(context.evidence.length, PROJECT_BRAIN_MAX_RESULTS);
  assert.equal(context.authoritative.length, PROJECT_BRAIN_MAX_RESULTS);
});

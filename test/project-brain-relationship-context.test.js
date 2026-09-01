const assert = require("node:assert/strict");
const test = require("node:test");
const { createMemoryRecord } = require("../.forge-build/domain/memory.js");
const { createMemoryRelationship } = require("../.forge-build/domain/relationship-memory.js");
const { ProjectMemoryStore } = require("../.forge-build/application/project-memory-store.js");
const { assembleRelationshipAwareProjectBrainContext } = require("../.forge-build/application/project-brain-relationship-context.js");
const { buildProjectContext } = require("../.forge-build/application/context-pipeline.js");

function memory(id, memoryClass, authority, summary, content, now = "2026-01-01T00:00:00.000Z") {
  return createMemoryRecord({
    id,
    projectId: "project-1",
    class: memoryClass,
    authority,
    summary,
    content,
    provenance: authority === "authoritative" ? [{ kind: "author", reference: `canon:${id}`, recordedAt: now }] : [],
    now,
  });
}
function edge(id, sourceMemoryId, targetMemoryId, relation = "supports", context = "Connected project context") {
  return createMemoryRelationship({ id, projectId: "project-1", sourceMemoryId, targetMemoryId, relation, context, significance: "continuity", createdAt: "2026-01-02T00:00:00.000Z" });
}

test("relationship-aware Brain adds a bounded one-hop neighbor that ordinary saliency would miss", () => {
  const store = new ProjectMemoryStore();
  store.register(memory("scene", "story-canon", "authoritative", "Warehouse confrontation", "Daniel confronts Elias in the warehouse."));
  store.register(memory("elias", "character-memory", "authoritative", "Elias continuity", "Elias carries the brass key in his left coat pocket."));
  store.register(memory("rain", "location-memory", "authoritative", "Weather", "Rain falls over the city."));
  const relationships = [edge("rel-scene-elias", "scene", "elias", "features-character", "Elias is physically present in this confrontation")];

  const context = assembleRelationshipAwareProjectBrainContext(store, relationships, { projectId: "project-1", queryTerms: ["warehouse"] });
  assert.deepEqual(context.authoritative.map((item) => item.id), ["scene", "elias"]);
  assert.equal(context.relationshipEvidence.length, 1);
  assert.equal(context.relationshipEvidence[0].memoryId, "elias");
  assert.ok(context.evidence.find((item) => item.memoryId === "elias").reasons.some((reason) => reason.includes("relationship:rel-scene-elias")));

  const rendered = buildProjectContext(store, { query: { projectId: "project-1", queryTerms: ["warehouse"] }, relationships, budget: 2000 });
  assert.ok(rendered.selectedMemoryIds.includes("scene"));
  assert.ok(rendered.selectedMemoryIds.includes("elias"));
  assert.ok(!rendered.selectedMemoryIds.includes("rain"));
  assert.match(rendered.system, /Relationship context:/);
  assert.match(rendered.system, /Elias is physically present/);
  assert.ok(rendered.strategies.includes("bounded-relationship-expansion"));
});

test("relationship expansion is one hop and never recursively floods the graph", () => {
  const store = new ProjectMemoryStore();
  store.register(memory("seed", "story-canon", "authoritative", "Opening clue", "The obsidian clue appears in the opening."));
  store.register(memory("neighbor", "story-canon", "authoritative", "First neighbor", "This memory does not contain the query phrase."));
  store.register(memory("second-hop", "story-canon", "authoritative", "Second hop", "This must not be reached recursively."));
  const relationships = [edge("r1", "seed", "neighbor"), edge("r2", "neighbor", "second-hop")];

  const context = assembleRelationshipAwareProjectBrainContext(store, relationships, { projectId: "project-1", queryTerms: ["obsidian"] });
  assert.deepEqual(context.authoritative.map((item) => item.id), ["seed", "neighbor"]);
  assert.ok(!context.authoritative.some((item) => item.id === "second-hop"));
});

test("relationship expansion respects author-state and class boundaries unless explicitly widened", () => {
  const store = new ProjectMemoryStore();
  store.register(memory("seed", "story-canon", "authoritative", "Opening clue", "The obsidian clue appears in the opening."));
  store.register(memory("working-character", "character-memory", "working", "Possible character note", "A provisional character detail."));
  const relationships = [edge("r1", "seed", "working-character")];

  const hiddenWorking = assembleRelationshipAwareProjectBrainContext(store, relationships, { projectId: "project-1", queryTerms: ["obsidian"] });
  assert.deepEqual(hiddenWorking.working, []);

  const classRestricted = assembleRelationshipAwareProjectBrainContext(store, relationships, { projectId: "project-1", queryTerms: ["obsidian"], taskMemoryClasses: ["story-canon"], includeWorkingState: true });
  assert.deepEqual(classRestricted.working, []);

  const widened = assembleRelationshipAwareProjectBrainContext(store, relationships, { projectId: "project-1", queryTerms: ["obsidian"], taskMemoryClasses: ["story-canon"], includeWorkingState: true }, { includeCrossClass: true });
  assert.deepEqual(widened.working.map((item) => item.id), ["working-character"]);
});

test("relationship expansion enforces its own result ceiling and deterministic ranking", () => {
  const store = new ProjectMemoryStore();
  store.register(memory("seed", "story-canon", "authoritative", "Opening clue", "The obsidian clue appears in the opening."));
  store.register(memory("a", "story-canon", "authoritative", "A", "A related fact."));
  store.register(memory("b", "story-canon", "authoritative", "B", "B related fact."));
  const relationships = [edge("ra", "seed", "a"), edge("rb", "seed", "b")];

  const context = assembleRelationshipAwareProjectBrainContext(store, relationships, { projectId: "project-1", queryTerms: ["obsidian"] }, { maxRelatedMemories: 1 });
  assert.deepEqual(context.authoritative.map((item) => item.id), ["seed", "a"]);
  assert.throws(() => assembleRelationshipAwareProjectBrainContext(store, relationships, { projectId: "project-1", queryTerms: ["obsidian"] }, { maxRelatedMemories: 65 }), /0 to 64/i);
});

test("relationship-aware Brain fails closed on dangling, cross-project, or globally invalid graph edges", () => {
  const store = new ProjectMemoryStore();
  store.register(memory("seed", "story-canon", "authoritative", "Opening clue", "The obsidian clue appears in the opening."));
  store.register(memory("neighbor", "story-canon", "authoritative", "Neighbor", "A valid related fact."));

  assert.throws(() => assembleRelationshipAwareProjectBrainContext(store, [edge("dangling", "seed", "missing")], { projectId: "project-1", queryTerms: ["obsidian"] }), /missing target memory/i);
  const crossProject = { ...edge("foreign", "seed", "missing"), projectId: "project-2" };
  assert.throws(() => assembleRelationshipAwareProjectBrainContext(store, [crossProject], { projectId: "project-1", queryTerms: ["obsidian"] }), /another project/i);
  const invalidUnrelatedEdge = edge("unrelated-dangling", "missing-source", "missing-target");
  assert.throws(() => assembleRelationshipAwareProjectBrainContext(store, [edge("valid", "seed", "neighbor"), invalidUnrelatedEdge], { projectId: "project-1", queryTerms: ["obsidian"] }), /missing source memory/i);
});

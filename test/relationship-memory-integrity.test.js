const assert = require("node:assert/strict");
const test = require("node:test");
const { createMemoryRecord } = require("../.forge-build/domain/memory.js");
const { createMemoryRelationship, validateMemoryRelationship, validateMemoryRelationshipSet } = require("../.forge-build/domain/relationship-memory.js");
const { RelationshipMemoryService } = require("../.forge-build/application/relationship-memory.js");

function memory(id, now = "2026-01-01T00:00:00.000Z") {
  return createMemoryRecord({ id, projectId: "project-1", class: "story-canon", authority: "working", summary: id, content: `${id} content`, now });
}

function relationship(overrides = {}) {
  return {
    formatVersion: 1,
    id: "rel-1",
    projectId: "project-1",
    sourceMemoryId: "source",
    targetMemoryId: "target",
    relation: "supports",
    context: "The source establishes context needed by the target.",
    createdAt: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

test("memory relationship validator is a runtime contract rather than a TypeScript-only cast", () => {
  assert.throws(() => validateMemoryRelationship(null), /invalid memory relationship/i);
  assert.throws(() => validateMemoryRelationship(relationship({ createdAt: "not-a-date" })), /createdat must be a valid timestamp/i);
  assert.throws(() => validateMemoryRelationship(relationship({ sourceMemoryId: "same", targetMemoryId: "same" })), /cannot relate to itself/i);
  assert.throws(() => validateMemoryRelationship(relationship({ relation: "   " })), /relation is required/i);

  const validated = createMemoryRelationship({
    id: " rel-2 ", projectId: " project-1 ", sourceMemoryId: " source ", targetMemoryId: " target ", relation: " supports ", context: " useful context ", createdAt: "2026-01-02T00:00:00.000Z",
  });
  assert.equal(validated.id, "rel-2");
  assert.equal(validated.projectId, "project-1");
  assert.equal(validated.relation, "supports");
});

test("relationship sets reject dangling, cross-project, duplicate, and nonchronological edges", () => {
  const source = memory("source");
  const target = memory("target");

  assert.throws(() => validateMemoryRelationshipSet([relationship({ targetMemoryId: "missing" })], [source, target], "project-1"), /missing target memory/i);
  assert.throws(() => validateMemoryRelationshipSet([relationship({ projectId: "project-2" })], [source, target], "project-1"), /another project/i);
  assert.throws(() => validateMemoryRelationshipSet([relationship(), relationship({ targetMemoryId: "source" })], [source, target], "project-1"), /cannot relate to itself/i);
  assert.throws(() => validateMemoryRelationshipSet([relationship(), relationship({ id: "rel-1", relation: "causes" })], [source, target], "project-1"), /duplicate memory relationship id/i);
  assert.throws(() => validateMemoryRelationshipSet([relationship(), relationship({ id: "rel-2", relation: "  SUPPORTS  " })], [source, target], "project-1"), /duplicate semantic memory relationship/i);
  assert.throws(() => validateMemoryRelationshipSet([relationship({ createdAt: "2025-12-31T23:59:59.000Z" })], [source, target], "project-1"), /predates one of its memory endpoints/i);
});

test("relationship service validates a complete project graph before downstream use", () => {
  const source = memory("source");
  const target = memory("target");
  const service = new RelationshipMemoryService();
  const result = service.validateSet([
    relationship(),
    relationship({ id: "rel-2", sourceMemoryId: "target", targetMemoryId: "source", relation: "is-resolved-by" }),
  ], [source, target], "project-1");

  assert.equal(result.length, 2);
  assert.deepEqual(result.map((item) => item.id), ["rel-1", "rel-2"]);
  assert.ok(Object.isFrozen(result[0]));
});

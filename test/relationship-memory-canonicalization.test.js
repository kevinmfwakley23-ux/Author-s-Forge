const assert = require("node:assert/strict");
const test = require("node:test");
const { createMemoryRelationship, validateMemoryRelationship } = require("../.forge-build/domain/relationship-memory.js");

test("memory relationships omit absent optional significance so JSON round-trips preserve canonical shape", () => {
  const relationship = createMemoryRelationship({
    id: "relation-1",
    projectId: "project-1",
    sourceMemoryId: "memory-a",
    targetMemoryId: "memory-b",
    relation: "same-scene",
    context: "The compass appears at the lighthouse.",
    createdAt: "2026-08-31T05:00:00.000Z",
  });

  assert.equal(Object.hasOwn(relationship, "significance"), false);
  const restored = validateMemoryRelationship(JSON.parse(JSON.stringify(relationship)));
  assert.deepEqual(restored, relationship);
});

test("memory relationships trim meaningful significance and reject blank persisted significance", () => {
  const relationship = createMemoryRelationship({
    id: "relation-2",
    projectId: "project-1",
    sourceMemoryId: "memory-a",
    targetMemoryId: "memory-b",
    relation: "foreshadows",
    context: "The detail matters later.",
    significance: "  establishes the recurring clue  ",
    createdAt: "2026-08-31T05:00:00.000Z",
  });

  assert.equal(relationship.significance, "establishes the recurring clue");
  assert.throws(
    () => validateMemoryRelationship({ ...relationship, significance: "   " }),
    /Invalid memory relationship significance/
  );
});

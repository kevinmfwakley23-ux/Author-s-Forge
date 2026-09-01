const test = require("node:test");
const assert = require("node:assert/strict");

const {
  MEMORY_CLASSES,
  MEMORY_AUTHORITIES,
  MEMORY_PROVENANCE_KINDS,
  isMemoryClass,
  isMemoryAuthority,
  isMemoryProvenanceKind,
  validateMemoryRecord,
} = require("../.forge-build/domain/memory.js");

const EXPECTED_CLASSES = [
  "author-memory", "project-memory", "story-canon", "character-memory", "relationship-memory",
  "location-memory", "timeline-memory", "style-memory", "research-memory", "creative-note",
  "working-draft", "hypothesis", "open-thread", "visual-identity", "production-memory",
  "publishing-memory", "marketing-memory", "generated-alternative", "decision-memory",
];
const EXPECTED_AUTHORITIES = ["proposed", "working", "verified", "authoritative", "superseded", "archived"];
const EXPECTED_PROVENANCE_KINDS = ["source", "author", "system"];

test("memory runtime allowlists are canonical, frozen, and accepted by their guards", () => {
  assert.deepEqual([...MEMORY_CLASSES], EXPECTED_CLASSES);
  assert.deepEqual([...MEMORY_AUTHORITIES], EXPECTED_AUTHORITIES);
  assert.deepEqual([...MEMORY_PROVENANCE_KINDS], EXPECTED_PROVENANCE_KINDS);

  assert.equal(Object.isFrozen(MEMORY_CLASSES), true);
  assert.equal(Object.isFrozen(MEMORY_AUTHORITIES), true);
  assert.equal(Object.isFrozen(MEMORY_PROVENANCE_KINDS), true);

  assert.equal(MEMORY_CLASSES.every(isMemoryClass), true);
  assert.equal(MEMORY_AUTHORITIES.every(isMemoryAuthority), true);
  assert.equal(MEMORY_PROVENANCE_KINDS.every(isMemoryProvenanceKind), true);
});

test("memory runtime contracts cannot be mutated by JavaScript consumers", () => {
  assert.throws(() => MEMORY_CLASSES.push("accidental-memory"), TypeError);
  assert.throws(() => MEMORY_AUTHORITIES.push("trusted-by-accident"), TypeError);
  assert.throws(() => MEMORY_PROVENANCE_KINDS.push("unknown-source"), TypeError);

  assert.equal(isMemoryClass("accidental-memory"), false);
  assert.equal(isMemoryAuthority("trusted-by-accident"), false);
  assert.equal(isMemoryProvenanceKind("unknown-source"), false);
});

test("runtime validation rejects values outside the single-source contracts", () => {
  const valid = {
    id: "memory-contract",
    projectId: "project-1",
    class: "story-canon",
    authority: "authoritative",
    summary: "Canonical fact",
    content: "The canonical memory remains valid.",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    provenance: [{ kind: "author", reference: "author-approved", recordedAt: "2026-09-01T00:00:00.000Z" }],
    relatedMemoryIds: [],
    relevanceTags: [],
  };

  assert.doesNotThrow(() => validateMemoryRecord(valid));
  assert.throws(() => validateMemoryRecord({ ...valid, class: "accidental-memory" }), /unsupported memory class/i);
  assert.throws(() => validateMemoryRecord({ ...valid, authority: "trusted-by-accident" }), /unsupported memory authority/i);
  assert.throws(() => validateMemoryRecord({ ...valid, provenance: [{ ...valid.provenance[0], kind: "unknown-source" }] }), /provenance kind is invalid/i);
});

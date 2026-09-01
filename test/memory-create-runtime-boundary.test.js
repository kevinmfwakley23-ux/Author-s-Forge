const test = require("node:test");
const assert = require("node:assert/strict");

const { createMemoryRecord } = require("../.forge-build/domain/memory.js");

function base(overrides = {}) {
  return {
    id: "memory-1",
    projectId: "project-1",
    class: "creative-note",
    authority: "working",
    summary: "Working note",
    content: "Useful durable context.",
    now: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

test("memory creation rejects malformed top-level runtime input deliberately", () => {
  assert.throws(() => createMemoryRecord(null), /memory input object is required/i);
  assert.throws(() => createMemoryRecord([]), /memory input object is required/i);
  assert.throws(() => createMemoryRecord("memory"), /memory input object is required/i);

  assert.throws(() => createMemoryRecord(base({ id: 17 })), /memory id is required/i);
  assert.throws(() => createMemoryRecord(base({ projectId: {} })), /memory project id is required/i);
  assert.throws(() => createMemoryRecord(base({ summary: null })), /memory summary is required/i);
  assert.throws(() => createMemoryRecord(base({ content: false })), /memory content is required/i);
  assert.throws(() => createMemoryRecord(base({ class: "future-memory" })), /unsupported memory class/i);
  assert.throws(() => createMemoryRecord(base({ authority: "implicitly-trusted" })), /unsupported memory authority/i);
});

test("memory creation validates nested collections before normalization", () => {
  assert.throws(() => createMemoryRecord(base({ provenance: "author" })), /memory provenance must be an array/i);
  assert.throws(() => createMemoryRecord(base({ provenance: [null] })), /provenance entry must be an object/i);
  assert.throws(() => createMemoryRecord(base({ provenance: [{ kind: "mystery", reference: "x", recordedAt: "2026-09-01T00:00:00.000Z" }] })), /provenance kind is invalid/i);
  assert.throws(() => createMemoryRecord(base({ provenance: [{ kind: "source", reference: 7, recordedAt: "2026-09-01T00:00:00.000Z" }] })), /provenance reference is required/i);
  assert.throws(() => createMemoryRecord(base({ provenance: [{ kind: "source", reference: "source", recordedAt: "not-a-date" }] })), /provenance recordedAt must be a valid timestamp/i);

  assert.throws(() => createMemoryRecord(base({ relatedMemoryIds: "memory-2" })), /related ids must be an array/i);
  assert.throws(() => createMemoryRecord(base({ relatedMemoryIds: ["memory-2", 3] })), /related ids must contain strings/i);
  assert.throws(() => createMemoryRecord(base({ relevanceTags: {} })), /relevance tags must be an array/i);
  assert.throws(() => createMemoryRecord(base({ relevanceTags: ["scene", null] })), /relevance tags must contain strings/i);
  assert.throws(() => createMemoryRecord(base({ supersedes: 123 })), /memory supersedes must be a string/i);
});

test("memory creation preserves deliberate normalization for valid runtime input", () => {
  const record = createMemoryRecord(base({
    id: "  memory-1  ",
    projectId: " project-1 ",
    summary: " Working note ",
    content: " Useful durable context. ",
    supersedes: " prior-memory ",
    relatedMemoryIds: [" memory-3 ", "memory-2", "memory-3", "   "],
    relevanceTags: [" continuity ", "scene", "scene", ""],
    provenance: [{ kind: "author", reference: " author-approved ", recordedAt: "2026-09-01T00:00:00.000Z" }],
  }));

  assert.equal(record.id, "memory-1");
  assert.equal(record.projectId, "project-1");
  assert.equal(record.summary, "Working note");
  assert.equal(record.content, "Useful durable context.");
  assert.equal(record.supersedes, "prior-memory");
  assert.deepEqual(record.relatedMemoryIds, ["memory-2", "memory-3"]);
  assert.deepEqual(record.relevanceTags, ["continuity", "scene"]);
  assert.deepEqual(record.provenance, [{ kind: "author", reference: "author-approved", recordedAt: "2026-09-01T00:00:00.000Z" }]);
});

test("memory creation rejects malformed creation timestamps before persistence", () => {
  assert.throws(() => createMemoryRecord(base({ now: 123 })), /memory createdAt must be a valid timestamp/i);
  assert.throws(() => createMemoryRecord(base({ now: "not-a-date" })), /memory createdAt must be a valid timestamp/i);
});

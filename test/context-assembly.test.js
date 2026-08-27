const test = require("node:test");
const assert = require("node:assert/strict");
const { createProject, createMemoryRecord, assembleWritingContext } = require("../dist");

test("writing context assembles relevant memory by inclusion mode and preserves provenance", () => {
  const project = createProject({ id: "context-001", title: "Context Test", now: "2026-01-01T00:00:00.000Z" });
  const canon = createMemoryRecord({
    id: "canon-1", projectId: project.metadata.id, class: "story-canon", authority: "authoritative",
    summary: "Opening setting", content: "The story opens at the old watchtower beside Pineview Reservoir.",
    provenance: [{ kind: "author", reference: "chapter-1-notes", recordedAt: "2026-01-01T00:00:00.000Z" }],
    relatedMemoryIds: [], relevanceTags: ["setting"]
  });
  const thread = createMemoryRecord({
    id: "thread-1", projectId: project.metadata.id, class: "open-thread", authority: "working",
    summary: "Unresolved signal", content: "A repeating light appears beyond the reservoir after midnight.",
    provenance: [{ kind: "author", reference: "chapter-4-notes", recordedAt: "2026-01-01T00:00:00.000Z" }],
    relatedMemoryIds: ["canon-1"], relevanceTags: ["mystery"]
  });
  const result = assembleWritingContext({ ...project, memories: [canon, thread] }, { projectId: project.metadata.id });
  assert.equal(result.projectId, project.metadata.id);
  assert.equal(result.sections.some((section) => section.key === "canon" && section.sourceIds.includes("canon-1")), true);
  assert.equal(result.sections.some((section) => section.key === "unresolved-threads" && section.sourceIds.includes("thread-1")), true);
  assert.equal(result.sourceIds.includes("canon-1"), true);
  assert.equal(result.sourceIds.includes("thread-1"), true);
});

test("off context sections never enter the assembled request", () => {
  const project = createProject({ id: "context-002", title: "Context Test" });
  const memory = createMemoryRecord({
    id: "canon-2", projectId: project.metadata.id, class: "story-canon", authority: "authoritative",
    summary: "Secret", content: "This canon detail must remain excluded.",
    provenance: [{ kind: "author", reference: "test", recordedAt: new Date().toISOString() }],
    relatedMemoryIds: [], relevanceTags: []
  });
  const result = assembleWritingContext({ ...project, memories: [memory] }, { projectId: project.metadata.id, policies: [{ key: "canon", mode: "off" }] });
  assert.deepEqual(result.sections, []);
  assert.deepEqual(result.sourceIds, []);
});

const assert = require("node:assert/strict");
const test = require("node:test");
const { createMemoryRecord } = require("../.forge-build/domain/memory.js");
const { ProjectMemoryStore } = require("../.forge-build/application/project-memory-store.js");
const { assembleProjectBrainContext } = require("../.forge-build/application/project-brain.js");

test("rejects duplicate memory identifiers", () => {
  const store = new ProjectMemoryStore();
  const memory = createMemoryRecord({ id: "m1", projectId: "p1", class: "story-canon", authority: "working", summary: "A fact", content: "Daniel is 37." });
  store.register(memory);
  assert.throws(() => store.register(memory), /Duplicate memory id/);
});

test("requires provenance for authoritative memory", () => {
  assert.throws(() => createMemoryRecord({ id: "m2", projectId: "p1", class: "story-canon", authority: "authoritative", summary: "A fact", content: "Daniel is 37." }), /requires provenance/);
});

test("only author authority can promote proposed or working memory", () => {
  const store = new ProjectMemoryStore();
  store.register(createMemoryRecord({ id: "m3", projectId: "p1", class: "story-canon", authority: "working", summary: "A fact", content: "Daniel is 37.", provenance: [{ kind: "author", reference: "author-note-1", recordedAt: "2026-01-01T00:00:00.000Z" }] }));
  assert.throws(() => store.promote("m3", "system", "automated confidence"), /requires author authority/);
  const decision = store.promote("m3", "author", "Author approved canon.");
  assert.equal(decision.to, "authoritative");
  assert.equal(store.get("m3")?.authority, "authoritative");
});

test("refuses promotion without provenance and from archived or superseded states", () => {
  const store = new ProjectMemoryStore();
  store.register(createMemoryRecord({ id: "no-source", projectId: "p1", class: "story-canon", authority: "working", summary: "No source", content: "Unknown." }));
  assert.throws(() => store.promote("no-source", "author", "approve"), /without provenance/);
  store.register(createMemoryRecord({ id: "archived", projectId: "p1", class: "story-canon", authority: "archived", summary: "Archived", content: "Old.", provenance: [{ kind: "author", reference: "archive", recordedAt: "2026-01-01T00:00:00.000Z" }] }));
  assert.throws(() => store.promote("archived", "author", "approve"), /cannot be promoted/);
});

test("preserves superseded history and explicit audit links", () => {
  const store = new ProjectMemoryStore();
  store.register(createMemoryRecord({ id: "old", projectId: "p1", class: "story-canon", authority: "authoritative", summary: "Old age", content: "Daniel is 37.", provenance: [{ kind: "author", reference: "canon", recordedAt: "2026-01-01T00:00:00.000Z" }] }));
  store.register(createMemoryRecord({ id: "new", projectId: "p1", class: "story-canon", authority: "authoritative", summary: "New age", content: "Daniel is 38.", provenance: [{ kind: "author", reference: "canon-update", recordedAt: "2026-02-01T00:00:00.000Z" }] }));
  store.register(createMemoryRecord({ id: "other", projectId: "p2", class: "story-canon", authority: "authoritative", summary: "Other", content: "Unrelated.", provenance: [{ kind: "author", reference: "other", recordedAt: "2026-01-01T00:00:00.000Z" }] }));
  store.supersede("old", "new", "2026-03-01T00:00:00.000Z");
  assert.equal(store.get("old")?.authority, "superseded");
  assert.equal(store.get("old")?.content, "Daniel is 37.");
  assert.equal(store.get("old")?.supersededBy, "new");
  assert.equal(store.get("new")?.supersedes, "old");
  assert.throws(() => store.supersede("old", "other"), /same project/);
});

test("retrieval filters by project, class, authority, relationship, relevance, and change time", () => {
  const store = new ProjectMemoryStore();
  store.register(createMemoryRecord({ id: "canon", projectId: "p1", class: "story-canon", authority: "authoritative", summary: "Canon", content: "Canon.", provenance: [{ kind: "author", reference: "canon", recordedAt: "2026-01-01T00:00:00.000Z" }], relatedMemoryIds: ["character"], relevanceTags: ["draft", "opening"], now: "2026-02-01T00:00:00.000Z" }));
  store.register(createMemoryRecord({ id: "character", projectId: "p1", class: "character-memory", authority: "working", summary: "Character", content: "Character.", relatedMemoryIds: ["canon"], relevanceTags: ["draft"], now: "2026-02-02T00:00:00.000Z" }));
  store.register(createMemoryRecord({ id: "research", projectId: "p1", class: "research-memory", authority: "verified", summary: "Research", content: "Research.", relevanceTags: ["research"], now: "2026-03-01T00:00:00.000Z" }));
  store.register(createMemoryRecord({ id: "other-project", projectId: "p2", class: "story-canon", authority: "authoritative", summary: "Other", content: "Other.", provenance: [{ kind: "author", reference: "other", recordedAt: "2026-01-01T00:00:00.000Z" }], relevanceTags: ["draft"] }));
  assert.deepEqual(store.query({ projectId: "p1", class: "story-canon" }).map((m) => m.id), ["canon"]);
  assert.deepEqual(store.query({ projectId: "p1", authority: "working" }).map((m) => m.id), ["character"]);
  assert.deepEqual(store.query({ relatedMemoryId: "canon" }).map((m) => m.id), ["character"]);
  assert.deepEqual(store.query({ projectId: "p1", relevanceTags: ["draft"] }).map((m) => m.id), ["canon", "character"]);
  assert.deepEqual(store.query({ projectId: "p1", changedSince: "2026-02-01T00:00:00.000Z" }).map((m) => m.id), ["character", "research"]);
});

test("Project Brain assembles task-relevant authoritative and working context without unrelated project state", () => {
  const store = new ProjectMemoryStore();
  store.register(createMemoryRecord({ id: "canon", projectId: "p1", class: "story-canon", authority: "authoritative", summary: "Age", content: "Daniel is 37.", provenance: [{ kind: "author", reference: "canon", recordedAt: "2026-01-01T00:00:00.000Z" }], relevanceTags: ["draft"] }));
  store.register(createMemoryRecord({ id: "note", projectId: "p1", class: "creative-note", authority: "working", summary: "Possible clue", content: "The lake may matter later.", relevanceTags: ["draft"] }));
  store.register(createMemoryRecord({ id: "research", projectId: "p1", class: "research-memory", authority: "verified", summary: "Research", content: "Research note.", relevanceTags: ["research"] }));
  store.register(createMemoryRecord({ id: "other", projectId: "p2", class: "story-canon", authority: "authoritative", summary: "Other book", content: "Unrelated.", provenance: [{ kind: "author", reference: "other", recordedAt: "2026-01-01T00:00:00.000Z" }] }));
  const context = assembleProjectBrainContext(store, { projectId: "p1", taskMemoryClasses: ["story-canon", "creative-note"], relevanceTags: ["draft"], includeWorkingState: true });
  assert.deepEqual(context.authoritative.map((m) => m.id), ["canon"]);
  assert.deepEqual(context.working.map((m) => m.id), ["note"]);
  assert.deepEqual(context.changed.map((m) => m.id), ["canon", "note"]);
});

test("Project Brain exposes changed state through changedSince", () => {
  const store = new ProjectMemoryStore();
  store.register(createMemoryRecord({ id: "old", projectId: "p1", class: "story-canon", authority: "authoritative", summary: "Old", content: "Old.", provenance: [{ kind: "author", reference: "old", recordedAt: "2026-01-01T00:00:00.000Z" }], now: "2026-01-02T00:00:00.000Z" }));
  store.register(createMemoryRecord({ id: "new", projectId: "p1", class: "story-canon", authority: "authoritative", summary: "New", content: "New.", provenance: [{ kind: "author", reference: "new", recordedAt: "2026-01-01T00:00:00.000Z" }], now: "2026-02-02T00:00:00.000Z" }));
  const context = assembleProjectBrainContext(store, { projectId: "p1", changedSince: "2026-02-01T00:00:00.000Z" });
  assert.deepEqual(context.changed.map((m) => m.id), ["new"]);
  assert.deepEqual(context.authoritative.map((m) => m.id), ["new"]);
});

test("portable memory snapshot restores identity, authority, provenance, lifecycle, and project isolation", () => {
  const store = new ProjectMemoryStore();
  const memory = createMemoryRecord({ id: "snapshot", projectId: "p1", class: "timeline-memory", authority: "authoritative", summary: "Winter", content: "The story begins in winter.", provenance: [{ kind: "author", reference: "timeline", recordedAt: "2026-01-01T00:00:00.000Z" }], relevanceTags: ["opening"], now: "2026-01-02T00:00:00.000Z" });
  store.register(memory);
  const snapshot = store.createSnapshot("p1");
  const restored = new ProjectMemoryStore();
  restored.restoreSnapshot(snapshot);
  assert.deepEqual(restored.get("snapshot"), memory);
  assert.throws(() => restored.restoreSnapshot({ ...snapshot, projectId: "p2" }), /another project|project id/);
});

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
  store.register(createMemoryRecord({ id: "old", projectId: "p1", class: "story-canon", authority: "authoritative", summary: "Old age", content: "Daniel is 37.", provenance: [{ kind: "author", reference: "canon", recordedAt: "2026-01-01T00:00:00.000Z" }], now: "2026-01-01T00:00:00.000Z" }));
  store.register(createMemoryRecord({ id: "new", projectId: "p1", class: "story-canon", authority: "authoritative", summary: "New age", content: "Daniel is 38.", provenance: [{ kind: "author", reference: "canon-update", recordedAt: "2026-02-01T00:00:00.000Z" }], now: "2026-02-01T00:00:00.000Z" }));
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
  assert.deepEqual(context.changed, []);
});

test("Project Brain never feeds archived or superseded history into live or changed context", () => {
  const store = new ProjectMemoryStore();
  store.register(createMemoryRecord({ id: "active", projectId: "p1", class: "story-canon", authority: "authoritative", summary: "Current age", content: "Daniel is 38.", provenance: [{ kind: "author", reference: "canon-current", recordedAt: "2026-03-01T00:00:00.000Z" }], relevanceTags: ["draft"], now: "2026-03-01T00:00:00.000Z" }));
  store.register(createMemoryRecord({ id: "archived", projectId: "p1", class: "story-canon", authority: "archived", summary: "Archived age", content: "Daniel is 36.", provenance: [{ kind: "author", reference: "archive", recordedAt: "2025-01-01T00:00:00.000Z" }], relevanceTags: ["draft"], now: "2026-03-02T00:00:00.000Z" }));
  store.register(createMemoryRecord({ id: "superseded", projectId: "p1", class: "story-canon", authority: "working", summary: "Old age", content: "Daniel is 37.", provenance: [{ kind: "author", reference: "canon-old", recordedAt: "2026-02-01T00:00:00.000Z" }], relevanceTags: ["draft"], now: "2026-02-01T00:00:00.000Z" }));
  store.supersede("superseded", "active", "2026-03-03T00:00:00.000Z");

  const normal = assembleProjectBrainContext(store, { projectId: "p1", relevanceTags: ["draft"], includeWorkingState: true });
  assert.deepEqual(normal.authoritative.map((memory) => memory.id), ["active"]);
  assert.deepEqual(normal.working, []);
  assert.deepEqual(normal.changed, []);
  assert.deepEqual(normal.evidence.map((item) => item.memoryId), ["active"]);

  const changed = assembleProjectBrainContext(store, { projectId: "p1", relevanceTags: ["draft"], includeWorkingState: true, changedSince: "2026-02-15T00:00:00.000Z" });
  assert.deepEqual(changed.authoritative.map((memory) => memory.id), ["active"]);
  assert.deepEqual(changed.changed.map((memory) => memory.id), ["active"]);
  assert.deepEqual(changed.evidence.map((item) => item.memoryId), ["active"]);
});

test("Project Brain ranks salient memory before unrelated memory under a tight limit", () => {
  const store = new ProjectMemoryStore();
  store.register(createMemoryRecord({ id: "a-unrelated", projectId: "p1", class: "story-canon", authority: "authoritative", summary: "Weather", content: "It is raining.", provenance: [{ kind: "author", reference: "canon-weather", recordedAt: "2026-01-01T00:00:00.000Z" }], relevanceTags: ["weather"] }));
  store.register(createMemoryRecord({ id: "z-opening", projectId: "p1", class: "story-canon", authority: "authoritative", summary: "Opening confrontation", content: "Daniel confronts Elias at the warehouse.", provenance: [{ kind: "author", reference: "canon-opening", recordedAt: "2026-01-01T00:00:00.000Z" }], relevanceTags: ["opening", "warehouse"] }));

  const context = assembleProjectBrainContext(store, { projectId: "p1", relevanceTags: ["opening", "missing-tag"], queryTerms: ["Elias"], limit: 1 });

  assert.deepEqual(context.authoritative.map((m) => m.id), ["z-opening"]);
  assert.equal(context.evidence[0].memoryId, "z-opening");
  assert.ok(context.evidence[0].reasons.some((reason) => reason.includes("tags:opening")));
  assert.ok(context.evidence[0].reasons.some((reason) => reason.includes("terms:elias")));
});

test("Project Brain excludes authoritative but irrelevant memory from explicit salient queries", () => {
  const store = new ProjectMemoryStore();
  store.register(createMemoryRecord({ id: "canon-weather", projectId: "p1", class: "story-canon", authority: "authoritative", summary: "Storm", content: "A storm arrives overnight.", provenance: [{ kind: "author", reference: "weather-canon", recordedAt: "2026-01-01T00:00:00.000Z" }], relevanceTags: ["weather"] }));
  store.register(createMemoryRecord({ id: "working-evidence", projectId: "p1", class: "creative-note", authority: "working", summary: "Warehouse clue", content: "Elias left the brass key in the warehouse.", relevanceTags: ["warehouse"] }));

  const context = assembleProjectBrainContext(store, { projectId: "p1", relevanceTags: ["warehouse"], queryTerms: ["Elias"], includeWorkingState: true });

  assert.deepEqual(context.authoritative, []);
  assert.deepEqual(context.working.map((m) => m.id), ["working-evidence"]);
  assert.deepEqual(context.evidence.map((item) => item.memoryId), ["working-evidence"]);
});

test("Project Brain uses related-memory links as a saliency signal", () => {
  const store = new ProjectMemoryStore();
  store.register(createMemoryRecord({ id: "character", projectId: "p1", class: "character-memory", authority: "working", summary: "Daniel", content: "Daniel distrusts Elias.", relatedMemoryIds: ["scene-7"] }));
  store.register(createMemoryRecord({ id: "location", projectId: "p1", class: "location-memory", authority: "working", summary: "Warehouse", content: "The warehouse is abandoned.", relatedMemoryIds: ["scene-2"] }));

  const context = assembleProjectBrainContext(store, { projectId: "p1", relatedMemoryIds: ["scene-7"], includeWorkingState: true, limit: 1 });

  assert.deepEqual(context.working.map((m) => m.id), ["character"]);
  assert.ok(context.evidence[0].reasons.some((reason) => reason.includes("related:scene-7")));
});

test("Project Brain exposes changed state through changedSince", () => {
  const store = new ProjectMemoryStore();
  store.register(createMemoryRecord({ id: "old", projectId: "p1", class: "story-canon", authority: "authoritative", summary: "Old", content: "Old.", provenance: [{ kind: "author", reference: "old", recordedAt: "2026-01-01T00:00:00.000Z" }], now: "2026-01-02T00:00:00.000Z" }));
  store.register(createMemoryRecord({ id: "new", projectId: "p1", class: "story-canon", authority: "authoritative", summary: "New", content: "New.", provenance: [{ kind: "author", reference: "new", recordedAt: "2026-01-01T00:00:00.000Z" }], now: "2026-02-02T00:00:00.000Z" }));
  const context = assembleProjectBrainContext(store, { projectId: "p1", changedSince: "2026-02-01T00:00:00.000Z" });
  assert.deepEqual(context.changed.map((m) => m.id), ["new"]);
  assert.deepEqual(context.authoritative.map((m) => m.id), ["new"]);
});

test("Project Brain rejects invalid changedSince timestamps", () => {
  const store = new ProjectMemoryStore();
  assert.throws(() => assembleProjectBrainContext(store, { projectId: "p1", changedSince: "not-a-date" }), /valid timestamp/);
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


test("memory creation rejects invalid lifecycle and provenance timestamps", () => {
  assert.throws(() => createMemoryRecord({ id: "bad-now", projectId: "p1", class: "story-canon", authority: "working", summary: "Bad", content: "Bad.", now: "not-a-date" }), /valid timestamp/);
  assert.throws(() => createMemoryRecord({ id: "bad-source-time", projectId: "p1", class: "story-canon", authority: "authoritative", summary: "Bad source", content: "Bad.", provenance: [{ kind: "author", reference: "note", recordedAt: "yesterday-ish" }] }), /valid timestamp/);
});

test("memory restore is atomic when imported records are duplicated or malformed", () => {
  const store = new ProjectMemoryStore();
  const current = createMemoryRecord({ id: "current", projectId: "p1", class: "story-canon", authority: "authoritative", summary: "Current canon", content: "The valid state must survive.", provenance: [{ kind: "author", reference: "current", recordedAt: "2026-01-01T00:00:00.000Z" }], now: "2026-01-01T00:00:00.000Z" });
  const incoming = createMemoryRecord({ id: "incoming", projectId: "p1", class: "creative-note", authority: "working", summary: "Incoming", content: "Candidate restore.", now: "2026-02-01T00:00:00.000Z" });
  store.register(current);

  assert.throws(() => store.restore([incoming, incoming]), /Duplicate memory id/);
  assert.deepEqual(store.list(), [current]);

  const malformed = { ...incoming, id: "malformed", updatedAt: "not-a-date" };
  assert.throws(() => store.restore([incoming, malformed]), /valid timestamp/);
  assert.deepEqual(store.list(), [current]);
});

test("snapshot restore validates imported runtime shape before replacing current state", () => {
  const store = new ProjectMemoryStore();
  const current = createMemoryRecord({ id: "safe", projectId: "p1", class: "project-memory", authority: "working", summary: "Safe state", content: "Preserve me.", now: "2026-01-01T00:00:00.000Z" });
  store.register(current);
  const invalidSnapshot = {
    formatVersion: 1,
    projectId: "p1",
    memories: [{ ...current, id: "invalid", authority: "invented-authority" }],
  };

  assert.throws(() => store.restoreSnapshot(invalidSnapshot), /Unsupported memory authority/);
  assert.deepEqual(store.list(), [current]);
});

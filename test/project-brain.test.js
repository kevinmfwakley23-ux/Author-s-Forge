import { strict as assert } from "node:assert";
import test from "node:test";
import { createMemoryRecord } from "../.forge-build/domain/memory.js";
import { ProjectMemoryStore } from "../.forge-build/application/project-memory-store.js";
import { assembleProjectBrainContext } from "../.forge-build/application/project-brain.js";

test("rejects duplicate memory identifiers", () => {
  const store = new ProjectMemoryStore();
  const memory = createMemoryRecord({ id: "m1", projectId: "p1", class: "story-canon", authority: "working", summary: "A fact", content: "Daniel is 37." });
  store.register(memory);
  assert.throws(() => store.register(memory), /Duplicate memory id/);
});

test("requires provenance for authoritative memory", () => {
  assert.throws(() => createMemoryRecord({ id: "m2", projectId: "p1", class: "story-canon", authority: "authoritative", summary: "A fact", content: "Daniel is 37." }), /requires provenance/);
});

test("only author authority can promote a sourced memory", () => {
  const store = new ProjectMemoryStore();
  store.register(createMemoryRecord({
    id: "m3",
    projectId: "p1",
    class: "story-canon",
    authority: "working",
    summary: "A fact",
    content: "Daniel is 37.",
    provenance: [{ kind: "author", reference: "author-note-1", recordedAt: "2026-01-01T00:00:00.000Z" }]
  }));
  assert.throws(() => store.promote("m3", "system", "automated confidence"), /requires author authority/);
  const decision = store.promote("m3", "author", "Author approved canon.");
  assert.equal(decision.to, "authoritative");
  assert.equal(store.get("m3")?.authority, "authoritative");
});

test("preserves superseded history", () => {
  const store = new ProjectMemoryStore();
  store.register(createMemoryRecord({ id: "old", projectId: "p1", class: "story-canon", authority: "authoritative", summary: "Old age", content: "Daniel is 37.", provenance: [{ kind: "author", reference: "canon", recordedAt: "2026-01-01T00:00:00.000Z" }] }));
  store.register(createMemoryRecord({ id: "new", projectId: "p1", class: "story-canon", authority: "authoritative", summary: "New age", content: "Daniel is 38.", provenance: [{ kind: "author", reference: "canon-update", recordedAt: "2026-02-01T00:00:00.000Z" }] }));
  store.supersede("old", "new");
  assert.equal(store.get("old")?.authority, "superseded");
  assert.equal(store.get("old")?.content, "Daniel is 37.");
});

test("project brain retrieves authoritative context separately from working context", () => {
  const store = new ProjectMemoryStore();
  store.register(createMemoryRecord({ id: "canon", projectId: "p1", class: "story-canon", authority: "authoritative", summary: "Age", content: "Daniel is 37.", provenance: [{ kind: "author", reference: "canon", recordedAt: "2026-01-01T00:00:00.000Z" }] }));
  store.register(createMemoryRecord({ id: "note", projectId: "p1", class: "creative-note", authority: "working", summary: "Possible clue", content: "The lake may matter later." }));
  store.register(createMemoryRecord({ id: "other", projectId: "p2", class: "story-canon", authority: "authoritative", summary: "Other book", content: "Unrelated.", provenance: [{ kind: "author", reference: "other", recordedAt: "2026-01-01T00:00:00.000Z" }] }));

  const context = assembleProjectBrainContext(store, { projectId: "p1", includeWorkingState: true });
  assert.deepEqual(context.authoritative.map((m) => m.id), ["canon"]);
  assert.deepEqual(context.working.map((m) => m.id), ["note"]);
});

test("portable state can restore the same memory brain", () => {
  const store = new ProjectMemoryStore();
  const memory = createMemoryRecord({ id: "snapshot", projectId: "p1", class: "timeline-memory", authority: "authoritative", summary: "Winter", content: "The story begins in winter.", provenance: [{ kind: "author", reference: "timeline", recordedAt: "2026-01-01T00:00:00.000Z" }] });
  store.register(memory);
  const snapshot = store.toPortableState();

  const restored = new ProjectMemoryStore();
  restored.restore(snapshot);
  assert.deepEqual(restored.get("snapshot"), memory);
});

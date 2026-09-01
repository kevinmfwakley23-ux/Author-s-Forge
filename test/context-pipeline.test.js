import test from "node:test";
import assert from "node:assert/strict";
import { ProjectMemoryStore } from "../dist/application/project-memory-store.js";
import { createMemoryRecord } from "../dist/domain/memory.js";
import { buildProjectContext } from "../dist/application/context-pipeline.js";

function memory(id, authority, content, now = "2026-01-01T00:00:00.000Z") {
  return createMemoryRecord({ id, projectId: "p1", class: "story-canon", authority, summary: id, content, provenance: [{ kind: "author", reference: id, recordedAt: now }], now });
}

test("context pipeline retrieves, budgets, and optimizes project brain context", () => {
  const store = new ProjectMemoryStore();
  store.register(memory("canon", "authoritative", "The lighthouse is permanently located on the north shore."));
  store.register(memory("verified", "verified", "The keeper arrives before sunrise every morning."));
  store.register(memory("working", "working", "A possible storm may interrupt the next chapter."));

  const result = buildProjectContext(store, { query: { projectId: "p1", includeWorkingState: true }, budget: 30 });
  assert.ok(result.selectedMemoryIds.includes("canon"));
  assert.ok(result.strategies.includes("project-brain-retrieval"));
  assert.ok(result.strategies.includes("priority-context-budget"));
  assert.ok(result.originalEstimatedTokens > result.optimizedEstimatedTokens);
  assert.equal(result.tokensSaved, result.originalEstimatedTokens - result.optimizedEstimatedTokens);
  assert.ok(result.strategies.includes("provenance-attached"));
  assert.match(result.system, /Provenance:/);
});

test("context pipeline never crosses project boundaries", () => {
  const store = new ProjectMemoryStore();
  store.register(memory("local", "authoritative", "Local canon."));
  const foreign = createMemoryRecord({ id: "foreign", projectId: "p2", class: "story-canon", authority: "authoritative", summary: "Foreign", content: "Should never enter p1.", provenance: [{ kind: "author", reference: "foreign", recordedAt: "2026-01-01T00:00:00.000Z" }] });
  store.register(foreign);
  const result = buildProjectContext(store, { query: { projectId: "p1" }, budget: 1000 });
  assert.deepEqual(result.selectedMemoryIds, ["local"]);
});


test("context pipeline exposes source provenance and truthful pre-budget savings", () => {
  const store = new ProjectMemoryStore();
  store.register(createMemoryRecord({
    id: "canon-source", projectId: "p1", class: "story-canon", authority: "authoritative",
    summary: "Canon source", content: "The lighthouse stands on the north shore.",
    provenance: [{ kind: "author", reference: "author-note-7", recordedAt: "2026-01-01T00:00:00.000Z" }],
    now: "2026-01-01T00:00:00.000Z",
  }));
  store.register(createMemoryRecord({
    id: "verified-source", projectId: "p1", class: "research-memory", authority: "verified",
    summary: "Verified source", content: "The keeper arrives before sunrise every day.",
    provenance: [{ kind: "source", reference: "https://example.test/keeper", recordedAt: "2026-01-02T00:00:00.000Z" }],
    now: "2026-01-02T00:00:00.000Z",
  }));
  store.register(createMemoryRecord({
    id: "working-source", projectId: "p1", class: "creative-note", authority: "working",
    summary: "Working note", content: "A storm may interrupt the next scene.",
    provenance: [{ kind: "system", reference: "brain-synthesis-1", recordedAt: "2026-01-03T00:00:00.000Z" }],
    now: "2026-01-03T00:00:00.000Z",
  }));

  const result = buildProjectContext(store, { query: { projectId: "p1", includeWorkingState: true }, budget: 20 });
  assert.match(result.system, /Provenance: author:author-note-7/);
  assert.equal(result.originalEstimatedTokens - result.optimizedEstimatedTokens, result.tokensSaved);
  assert.ok(result.omittedMemoryIds.length > 0);
  assert.ok(result.originalEstimatedTokens > result.optimizedEstimatedTokens);
});

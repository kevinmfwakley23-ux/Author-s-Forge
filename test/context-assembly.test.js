const test = require("node:test");
const assert = require("node:assert/strict");
const { createProject, createMemoryRecord, createCharacter, assembleWritingContext } = require("../dist");

function character(id, overrides = {}) {
  return createCharacter({ id, projectId: "context-003", now: "2026-01-01T00:00:00.000Z", profile: {
    name: id === "mara-1" ? "Mara Voss" : "Eli Voss", age: 31, birthDate: "1995-04-12", physicalAppearance: "Lean and weathered.", height: "5 ft 7 in", build: "Lean", hair: "Dark brown", eyes: "Gray-green", skin: "Olive", clothing: "Dark field jacket", voice: "Low and controlled", speechPatterns: ["Short declarative sentences"], personality: id === "mara-1" ? "Guarded investigator" : "Calm mechanic", values: ["Loyalty"], fears: ["Abandonment"], secrets: [], goals: id === "mara-1" ? ["Find the missing witness"] : ["Repair the boat"], motivations: ["Protect people"], relationships: [], history: "Mountain town upbringing.", knowledge: id === "mara-1" ? ["Knows the old reservoir access roads"] : ["Knows the harbor",], skills: ["Investigation"], weaknesses: ["Distrusts authority"], characterArc: "Learns to trust", importantObjects: ["Compass"], currentEmotionalState: id === "mara-1" ? "Watchful" : "Calm", currentLocation: id === "mara-1" ? "North shoreline" : "Harbor", currentInjuries: [], ...overrides
  }});
}

test("writing context assembles relevant memory by inclusion mode and preserves provenance", () => {
  const project = createProject({ id: "context-001", title: "Context Test", now: "2026-01-01T00:00:00.000Z" });
  const canon = createMemoryRecord({ id: "canon-1", projectId: project.metadata.id, class: "story-canon", authority: "authoritative", summary: "Opening setting", content: "The story opens at the old watchtower beside Pineview Reservoir.", provenance: [{ kind: "author", reference: "chapter-1-notes", recordedAt: "2026-01-01T00:00:00.000Z" }], relatedMemoryIds: [], relevanceTags: ["setting"] });
  const thread = createMemoryRecord({ id: "thread-1", projectId: project.metadata.id, class: "open-thread", authority: "working", summary: "Unresolved signal", content: "A repeating light appears beyond the reservoir after midnight.", provenance: [{ kind: "author", reference: "chapter-4-notes", recordedAt: "2026-01-01T00:00:00.000Z" }], relatedMemoryIds: ["canon-1"], relevanceTags: ["mystery"] });
  const result = assembleWritingContext({ ...project, memories: [canon, thread] }, { projectId: project.metadata.id });
  assert.equal(result.projectId, project.metadata.id); assert.equal(result.sections.some((section) => section.key === "canon" && section.sourceIds.includes("canon-1")), true); assert.equal(result.sections.some((section) => section.key === "unresolved-threads" && section.sourceIds.includes("thread-1")), true); assert.equal(result.sourceIds.includes("canon-1"), true); assert.equal(result.sourceIds.includes("thread-1"), true); assert.ok(Array.isArray(result.evidence));
});

test("off context sections never enter the assembled request", () => {
  const project = createProject({ id: "context-002", title: "Context Test" });
  const memory = createMemoryRecord({ id: "canon-2", projectId: project.metadata.id, class: "story-canon", authority: "authoritative", summary: "Secret", content: "This canon detail must remain excluded.", provenance: [{ kind: "author", reference: "test", recordedAt: new Date().toISOString() }], relatedMemoryIds: [], relevanceTags: [] });
  const result = assembleWritingContext({ ...project, memories: [memory] }, { projectId: project.metadata.id, policies: [{ key: "canon", mode: "off" }] });
  assert.deepEqual(result.sections, []); assert.deepEqual(result.sourceIds, []); assert.deepEqual(result.evidence, []);
});

test("character context uses saliency retrieval instead of dumping every character", () => {
  const project = createProject({ id: "context-003", title: "Character Context", now: "2026-01-01T00:00:00.000Z" });
  const mara = character("mara-1"); const eli = character("eli-1");
  const result = assembleWritingContext({ ...project, characters: [mara, eli] }, { projectId: project.metadata.id, query: "missing witness", characterMemoryLimit: 1 });
  const section = result.sections.find((item) => item.key === "characters");
  assert.ok(section); assert.deepEqual(section.sourceIds, ["mara-1"]); assert.match(section.text, /Mara Voss/); assert.match(section.text, /missing witness/i);
});

test("character context can target explicit characters and reconstruct a historical state", () => {
  const project = createProject({ id: "context-003", title: "Character Context", now: "2026-01-01T00:00:00.000Z" });
  const mara = character("mara-1"); const eli = character("eli-1");
  const result = assembleWritingContext({ ...project, characters: [mara, eli] }, { projectId: project.metadata.id, characterIds: ["eli-1"], characterAsOf: "2026-01-01T00:00:00.000Z" });
  const section = result.sections.find((item) => item.key === "characters");
  assert.ok(section); assert.deepEqual(section.sourceIds, ["eli-1"]); assert.match(section.text, /Eli Voss/); assert.match(section.text, /Repair the boat/);
});

test("natural-language context queries match salient terms instead of requiring the whole instruction substring", () => {
  const project = createProject({ id: "context-004", title: "Natural Query", now: "2026-01-01T00:00:00.000Z" });
  const warehouse = createMemoryRecord({ id: "canon-warehouse", projectId: project.metadata.id, class: "story-canon", authority: "authoritative", summary: "Warehouse confrontation", content: "Elias corners Daniel beside the loading bay.", provenance: [{ kind: "author", reference: "chapter-card", recordedAt: "2026-01-01T00:00:00.000Z" }], relatedMemoryIds: [], relevanceTags: ["warehouse", "elias"] });
  const weather = createMemoryRecord({ id: "canon-weather", projectId: project.metadata.id, class: "story-canon", authority: "authoritative", summary: "Weather", content: "Snow starts before dawn.", provenance: [{ kind: "author", reference: "weather", recordedAt: "2026-01-01T00:00:00.000Z" }], relatedMemoryIds: [], relevanceTags: ["snow"] });
  const result = assembleWritingContext({ ...project, memories: [weather, warehouse] }, { projectId: project.metadata.id, query: "Continue the warehouse confrontation with Elias" });
  const canon = result.sections.find((section) => section.key === "canon");
  assert.ok(canon); assert.deepEqual(canon.sourceIds, ["canon-warehouse"]); assert.equal(result.sourceIds.includes("canon-weather"), false);
  const evidence = result.evidence.find((item) => item.sourceId === "canon-warehouse");
  assert.ok(evidence); assert.ok(evidence.reasons.some((reason) => reason.includes("warehouse") || reason.includes("elias")));
});

test("superseded and archived memories never enter live writing context", () => {
  const project = createProject({ id: "context-005", title: "Lifecycle Context", now: "2026-01-01T00:00:00.000Z" });
  const active = createMemoryRecord({ id: "canon-active", projectId: project.metadata.id, class: "story-canon", authority: "authoritative", summary: "Current age", content: "Daniel is 38.", provenance: [{ kind: "author", reference: "current", recordedAt: "2026-02-01T00:00:00.000Z" }], relatedMemoryIds: [], relevanceTags: ["daniel"] });
  const superseded = { ...createMemoryRecord({ id: "canon-old", projectId: project.metadata.id, class: "story-canon", authority: "authoritative", summary: "Old age", content: "Daniel is 37.", provenance: [{ kind: "author", reference: "old", recordedAt: "2026-01-01T00:00:00.000Z" }], relatedMemoryIds: [], relevanceTags: ["daniel"] }), authority: "superseded" };
  const archived = createMemoryRecord({ id: "canon-archive", projectId: project.metadata.id, class: "story-canon", authority: "archived", summary: "Discarded note", content: "Daniel is 36.", provenance: [{ kind: "author", reference: "archive", recordedAt: "2025-12-01T00:00:00.000Z" }], relatedMemoryIds: [], relevanceTags: ["daniel"] });
  const result = assembleWritingContext({ ...project, memories: [superseded, archived, active] }, { projectId: project.metadata.id, query: "Daniel" });
  assert.deepEqual(result.sourceIds, ["canon-active"]);
});

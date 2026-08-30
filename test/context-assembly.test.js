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
  assert.equal(result.projectId, project.metadata.id); assert.equal(result.sections.some((section) => section.key === "canon" && section.sourceIds.includes("canon-1")), true); assert.equal(result.sections.some((section) => section.key === "unresolved-threads" && section.sourceIds.includes("thread-1")), true); assert.equal(result.sourceIds.includes("canon-1"), true); assert.equal(result.sourceIds.includes("thread-1"), true);
});

test("off context sections never enter the assembled request", () => {
  const project = createProject({ id: "context-002", title: "Context Test" });
  const memory = createMemoryRecord({ id: "canon-2", projectId: project.metadata.id, class: "story-canon", authority: "authoritative", summary: "Secret", content: "This canon detail must remain excluded.", provenance: [{ kind: "author", reference: "test", recordedAt: new Date().toISOString() }], relatedMemoryIds: [], relevanceTags: [] });
  const result = assembleWritingContext({ ...project, memories: [memory] }, { projectId: project.metadata.id, policies: [{ key: "canon", mode: "off" }] });
  assert.deepEqual(result.sections, []); assert.deepEqual(result.sourceIds, []);
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

const test = require("node:test");
const assert = require("node:assert/strict");
const { createProject, createMemoryRecord, assembleWritingContext } = require("../dist");

const at = "2026-08-31T00:00:00.000Z";
function memory(projectId, id, klass, authority, summary, content, tags = []) {
  return createMemoryRecord({
    id,
    projectId,
    class: klass,
    authority,
    summary,
    content,
    relevanceTags: tags,
    provenance: [{ kind: "author", reference: `fixture:${id}`, recordedAt: at }],
    now: at,
  });
}

test("Mission 059 ranks salient project memories across context sections and respects per-section limits", () => {
  const project = createProject({ id: "saliency-1", title: "Saliency", now: at });
  const memories = [
    memory(project.metadata.id, "canon-reservoir", "story-canon", "authoritative", "Reservoir crime scene", "Mara finds the missing witness near the north reservoir road.", ["witness", "reservoir"]),
    memory(project.metadata.id, "canon-city", "story-canon", "authoritative", "City apartment", "The apartment has a broken radiator.", ["apartment"]),
    memory(project.metadata.id, "timeline-witness", "timeline-memory", "verified", "Witness disappearance", "The witness vanished at 11:40 PM beside the reservoir.", ["witness"]),
    memory(project.metadata.id, "timeline-breakfast", "timeline-memory", "authoritative", "Breakfast", "Mara ate before sunrise.", ["breakfast"]),
    memory(project.metadata.id, "research-road", "research-memory", "verified", "Reservoir access", "The north access road closes during heavy snow.", ["reservoir", "road"]),
    memory(project.metadata.id, "research-coffee", "research-memory", "authoritative", "Coffee notes", "The diner serves coffee all night.", ["diner"]),
  ];
  const result = assembleWritingContext({ ...project, memories }, {
    projectId: project.metadata.id,
    query: "Continue the missing witness search along the reservoir road",
    memoryLimitPerSection: 1,
  });
  assert.deepEqual(result.sections.find((section) => section.key === "canon").sourceIds, ["canon-reservoir"]);
  assert.deepEqual(result.sections.find((section) => section.key === "timeline").sourceIds, ["timeline-witness"]);
  assert.deepEqual(result.sections.find((section) => section.key === "research").sourceIds, ["research-road"]);
  assert.equal(result.sourceIds.includes("canon-city"), false);
  assert.equal(result.sourceIds.includes("timeline-breakfast"), false);
  assert.equal(result.sourceIds.includes("research-coffee"), false);
  for (const id of ["canon-reservoir", "timeline-witness", "research-road"]) {
    const evidence = result.evidence.find((item) => item.sourceId === id);
    assert.ok(evidence);
    assert.ok(evidence.reasons.some((reason) => reason.startsWith("saliency-score:")));
  }
});

test("Mission 059 relevance tags outrank plain text matches when they directly classify the writing task", () => {
  const project = createProject({ id: "saliency-2", title: "Tag Saliency", now: at });
  const memories = [
    memory(project.metadata.id, "canon-text", "story-canon", "authoritative", "Witness", "A witness once crossed the square.", []),
    memory(project.metadata.id, "canon-tag", "story-canon", "verified", "North road", "Mara follows tire marks into the snow.", ["witness"]),
  ];
  const result = assembleWritingContext({ ...project, memories }, { projectId: project.metadata.id, query: "witness", memoryLimitPerSection: 1 });
  const canon = result.sections.find((section) => section.key === "canon");
  assert.ok(canon);
  assert.deepEqual(canon.sourceIds, ["canon-tag"]);
  const evidence = result.evidence.find((item) => item.sourceId === "canon-tag");
  assert.ok(evidence.reasons.includes("tags:witness"));
});

test("Mission 059 falls back to strongest live authority when a task query has no lexical match", () => {
  const project = createProject({ id: "saliency-3", title: "Fallback", now: at });
  const memories = [
    memory(project.metadata.id, "canon-working", "story-canon", "working", "Lamp", "A brass lamp sits on the desk."),
    memory(project.metadata.id, "canon-authoritative", "story-canon", "authoritative", "Door", "The cellar door is permanently locked."),
  ];
  const result = assembleWritingContext({ ...project, memories }, { projectId: project.metadata.id, query: "spaceship orbit", memoryLimitPerSection: 1 });
  const canon = result.sections.find((section) => section.key === "canon");
  assert.ok(canon);
  assert.deepEqual(canon.sourceIds, ["canon-authoritative"]);
  const evidence = result.evidence.find((item) => item.sourceId === "canon-authoritative");
  assert.ok(evidence.reasons.includes("fallback:authority"));
});

test("Mission 059 excludes archived and superseded memory before saliency scoring", () => {
  const project = createProject({ id: "saliency-4", title: "Lifecycle", now: at });
  const current = memory(project.metadata.id, "research-current", "research-memory", "verified", "Current reservoir depth", "Reservoir depth is the verified current figure.", ["reservoir"]);
  const archived = { ...memory(project.metadata.id, "research-archived", "research-memory", "authoritative", "Old reservoir depth", "Reservoir depth is an obsolete figure.", ["reservoir"]), authority: "archived" };
  const superseded = { ...memory(project.metadata.id, "research-old", "research-memory", "authoritative", "Superseded reservoir depth", "Reservoir depth is another obsolete figure.", ["reservoir"]), authority: "superseded" };
  const result = assembleWritingContext({ ...project, memories: [archived, superseded, current] }, { projectId: project.metadata.id, query: "reservoir", memoryLimitPerSection: 4 });
  assert.deepEqual(result.sourceIds, ["research-current"]);
});

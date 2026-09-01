const test = require("node:test");
const assert = require("node:assert/strict");

const { createMemoryRecord } = require("../.forge-build/domain/memory.js");
const { ProjectMemoryStore } = require("../.forge-build/application/project-memory-store.js");
const { assembleProjectBrainContext } = require("../.forge-build/application/project-brain.js");

function memory(id, summary, content, relevanceTags = []) {
  return createMemoryRecord({
    id,
    projectId: "project-1",
    class: "story-canon",
    authority: "authoritative",
    summary,
    content,
    relevanceTags,
    provenance: [{ kind: "author", reference: `canon:${id}`, recordedAt: "2026-09-01T00:00:00.000Z" }],
    now: "2026-09-01T00:00:00.000Z",
  });
}

function storeWith(...memories) {
  const store = new ProjectMemoryStore();
  for (const item of memories) store.register(item);
  return store;
}

test("entity match exclusions suppress ambiguous phrases without hiding a valid occurrence elsewhere", () => {
  const store = storeWith(
    memory("false-positive", "Question", "May I leave before the meeting ends?"),
    memory("real-character", "May Parker arrives", "May I ask you something? May Parker closes the door."),
  );

  const result = assembleProjectBrainContext(store, {
    projectId: "project-1",
    entityMatchRules: [{
      entityId: "character-may",
      aliases: ["May"],
      excludedPhrases: ["May I"],
    }],
  });

  assert.deepEqual(result.authoritative.map((item) => item.id), ["real-character"]);
  assert.equal(result.evidence.length, 1);
  assert.ok(result.evidence[0].reasons.includes("entity:character-may:May"));
});

test("case-sensitive entity rules distinguish a proper name from an ordinary lowercase word", () => {
  const store = storeWith(
    memory("lowercase", "Spring note", "The month may bring rain."),
    memory("proper-name", "Character entrance", "May brings the sealed letter."),
  );

  const result = assembleProjectBrainContext(store, {
    projectId: "project-1",
    entityMatchRules: [{ entityId: "character-may", aliases: ["May"], caseSensitive: true }],
  });

  assert.deepEqual(result.authoritative.map((item) => item.id), ["proper-name"]);
});

test("entity aliases match as one saliency signal and expose the alias used as evidence", () => {
  const store = storeWith(
    memory("elias", "Warehouse", "Detective Rowe checks the brass key while Elias Rowe watches the corridor."),
  );

  const result = assembleProjectBrainContext(store, {
    projectId: "project-1",
    entityMatchRules: [{ entityId: "character-elias", aliases: ["Elias Rowe", "Detective Rowe"] }],
  });

  assert.deepEqual(result.authoritative.map((item) => item.id), ["elias"]);
  assert.equal(result.evidence[0].score, 52);
  assert.equal(result.evidence[0].reasons.filter((reason) => reason.startsWith("entity:character-elias:")).length, 1);
  assert.ok(result.evidence[0].reasons.includes("entity:character-elias:Elias Rowe"));
});

test("entity rule normalization deduplicates aliases according to matching policy", () => {
  const store = storeWith(memory("may", "Character", "MAY waits beside the gate."));

  const result = assembleProjectBrainContext(store, {
    projectId: "project-1",
    entityMatchRules: [{ entityId: "character-may", aliases: ["May", " may ", "MAY"] }],
  });

  assert.equal(result.authoritative.length, 1);
  assert.equal(result.evidence[0].score, 52);
  assert.ok(result.evidence[0].reasons.includes("entity:character-may:May"));
});

test("Project Brain rejects malformed runtime entity match policies before retrieval", () => {
  const store = storeWith(memory("one", "Character", "May enters."));

  assert.throws(() => assembleProjectBrainContext(store, {
    projectId: "project-1",
    entityMatchRules: "May",
  }), /entity match rules must be an array/i);

  assert.throws(() => assembleProjectBrainContext(store, {
    projectId: "project-1",
    entityMatchRules: [null],
  }), /entity match rule must be an object/i);

  assert.throws(() => assembleProjectBrainContext(store, {
    projectId: "project-1",
    entityMatchRules: [{ entityId: "character-may", aliases: [] }],
  }), /aliases must be a non-empty array/i);

  assert.throws(() => assembleProjectBrainContext(store, {
    projectId: "project-1",
    entityMatchRules: [{ entityId: "character-may", aliases: ["May"], caseSensitive: "yes" }],
  }), /caseSensitive must be a boolean/i);

  assert.throws(() => assembleProjectBrainContext(store, {
    projectId: "project-1",
    entityMatchRules: [{ entityId: "character-may", aliases: ["May"], excludedPhrases: [7] }],
  }), /excluded phrases must contain non-empty strings/i);

  assert.throws(() => assembleProjectBrainContext(store, {
    projectId: "project-1",
    entityMatchRules: [
      { entityId: "character-may", aliases: ["May"] },
      { entityId: "character-may", aliases: ["May Parker"] },
    ],
  }), /rule id .* is duplicated/i);
});

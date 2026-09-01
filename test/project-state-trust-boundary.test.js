const assert = require("node:assert/strict");
const { mkdtemp, readFile, writeFile, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const test = require("node:test");
const { createProject, createMemoryRecord, withProjectMemories, FileProjectStore } = require("../.forge-build/index.js");

function canon(projectId) {
  return createMemoryRecord({
    id: "canon-1",
    projectId,
    class: "story-canon",
    authority: "authoritative",
    summary: "Opening location",
    content: "The story opens in Ogden.",
    provenance: [{ kind: "author", reference: "author-note", recordedAt: "2026-01-01T00:00:00.000Z" }],
    now: "2026-01-01T00:00:00.000Z",
  });
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "forge-project-trust-"));
  const store = new FileProjectStore(root);
  const base = createProject({ id: "trust-project", title: "Trust Boundary", now: "2026-01-01T00:00:00.000Z" });
  const project = withProjectMemories(base, [canon(base.metadata.id)], "2026-01-01T00:00:01.000Z");
  await store.create(project);
  const path = join(root, "projects", project.metadata.id, "project.json");
  return { root, store, project, path };
}

test("FileProjectStore rejects malformed canonical memory on load instead of trusting persisted shape", async () => {
  const { root, store, path } = await fixture();
  try {
    const raw = JSON.parse(await readFile(path, "utf8"));
    raw.memories[0].authority = "trusted-by-accident";
    await writeFile(path, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
    await assert.rejects(() => store.load("trust-project"), /unsupported memory authority/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("FileProjectStore validates extended ProjectState domains at the durable trust boundary", async () => {
  const { root, store, path } = await fixture();
  try {
    const original = JSON.parse(await readFile(path, "utf8"));

    const invalidPolicy = structuredClone(original);
    invalidPolicy.aiCollaborationPolicy = { mode: "unbounded-agent" };
    await writeFile(path, `${JSON.stringify(invalidPolicy, null, 2)}\n`, "utf8");
    await assert.rejects(() => store.load("trust-project"), /unsupported ai collaboration mode/i);

    const invalidRelationship = structuredClone(original);
    invalidRelationship.memoryRelationships = [{ formatVersion: 1, id: "rel-1", projectId: "trust-project", sourceMemoryId: "canon-1", targetMemoryId: "other", relation: "supports", context: "context", createdAt: "not-a-date" }];
    await writeFile(path, `${JSON.stringify(invalidRelationship, null, 2)}\n`, "utf8");
    await assert.rejects(() => store.load("trust-project"), /memory relationship createdat must be a valid timestamp/i);

    const invalidCharacterState = structuredClone(original);
    invalidCharacterState.characterStateMemories = [{ formatVersion: 1, characterId: "missing-character", projectId: "trust-project", snapshots: [] }];
    await writeFile(path, `${JSON.stringify(invalidCharacterState, null, 2)}\n`, "utf8");
    await assert.rejects(() => store.load("trust-project"), /references missing character/i);

    const invalidVoice = structuredClone(original);
    invalidVoice.voiceProfiles = [{
      id: "voice-1", projectId: "trust-project", authorId: "author-1", createdAt: "2026-01-01T00:00:00.000Z", sampleIds: ["sample-1"],
      fingerprint: { sentenceLengthMean: 12, sentenceLengthMedian: 11, punctuationRate: 0.2, dialogueRatio: 0.2, vocabularyRichness: 0.5, paragraphLengthMean: 70, narrativeDistance: "third-person", descriptionDensity: 0.4, metaphorDensity: 0.1, pacing: 4, emotionalIntensity: 0.3, sampleWordCount: 500 },
    }];
    await writeFile(path, `${JSON.stringify(invalidVoice, null, 2)}\n`, "utf8");
    await assert.rejects(() => store.load("trust-project"), /invalid ratio metrics/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("FileProjectStore validates before save so rejected runtime state cannot replace durable valid state", async () => {
  const { root, store, project } = await fixture();
  try {
    const malformed = { ...project, memories: [{ ...project.memories[0], class: "not-a-memory-class" }] };
    await assert.rejects(() => store.save(malformed), /unsupported memory class/i);
    assert.deepEqual(await store.load(project.metadata.id), project);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("FileProjectStore rejects impossible project metadata chronology", async () => {
  const { root, store, path } = await fixture();
  try {
    const raw = JSON.parse(await readFile(path, "utf8"));
    raw.metadata.createdAt = "2026-02-01T00:00:00.000Z";
    raw.metadata.updatedAt = "2026-01-01T00:00:00.000Z";
    await writeFile(path, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
    await assert.rejects(() => store.load("trust-project"), /updatedat cannot precede createdat/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

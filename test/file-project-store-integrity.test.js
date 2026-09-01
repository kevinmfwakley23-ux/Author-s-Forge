const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, readFile, readdir, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { FileProjectStore } = require("../.forge-build/infrastructure/file-project-store.js");
const { createProject } = require("../.forge-build/domain/project.js");
const { createMemoryRecord } = require("../.forge-build/domain/memory.js");
const { createBookSnapshot } = require("../.forge-build/domain/book-version-control.js");
const { createAuthorDecision } = require("../.forge-build/domain/author-control.js");
const { createSeries } = require("../.forge-build/domain/series.js");
const { createVoiceProfile } = require("../.forge-build/domain/voice-preservation.js");
const { createAuthorVoiceMemory } = require("../.forge-build/domain/author-voice-memory.js");
const { createAiCollaborationPolicy } = require("../.forge-build/domain/ai-collaboration.js");
const { createProjectHealthReport } = require("../.forge-build/domain/project-health.js");
const { createMemoryRelationship } = require("../.forge-build/domain/relationship-memory.js");
const { createDeliveryAuditReport } = require("../.forge-build/domain/delivery-audit.js");

const VOICE_SAMPLE = "I write with deliberate rhythm and grounded emotion while characters notice small physical details around them. The sentences move naturally between reflection dialogue and concrete action so the story remains clear intimate and unmistakably human.";

function canon(id, projectId, content) {
  return createMemoryRecord({
    id,
    projectId,
    class: "story-canon",
    authority: "authoritative",
    summary: id,
    content,
    provenance: [{ kind: "author", reference: id, recordedAt: "2026-08-31T00:00:00.000Z" }],
    now: "2026-08-31T00:00:00.000Z",
  });
}

function completeProject() {
  const projectId = "integrity-project";
  const base = createProject({ id: projectId, title: "Integrity Project", now: "2026-08-31T00:00:00.000Z" });
  const memoryA = canon("canon-a", projectId, "The lighthouse stands on the north shore.");
  const memoryB = canon("canon-b", projectId, "Mara carries a brass compass.");
  const snapshot = createBookSnapshot({
    id: "version-1",
    projectId,
    bookId: "book-1",
    label: "draft-1",
    name: "First durable draft",
    createdAt: "2026-08-31T01:00:00.000Z",
    manuscript: "Opening manuscript",
    chapters: { "chapter-1": "Opening manuscript" },
  });
  const voiceProfile = createVoiceProfile({
    id: "voice-profile-1",
    projectId,
    authorId: "author-1",
    text: VOICE_SAMPLE,
    sampleIds: ["voice-source-1"],
    createdAt: "2026-08-31T02:00:00.000Z",
  });
  const authorVoiceMemory = createAuthorVoiceMemory({
    id: "author-voice-1",
    projectId,
    authorId: "author-1",
    samples: [{ id: "voice-source-1", label: "Approved sample", text: VOICE_SAMPLE }],
    createdAt: "2026-08-31T02:00:00.000Z",
    updatedAt: "2026-08-31T02:00:00.000Z",
  });
  return {
    ...base,
    memories: [memoryA, memoryB],
    bookVersionHistories: [{ projectId, bookId: "book-1", versions: [snapshot], branches: [] }],
    authorDecisions: [createAuthorDecision({ id: "decision-1", projectId, targetId: "chapter-1", status: "author-approved", content: "Keep the opening in Mara's point of view.", reason: "Author approved the POV.", createdAt: "2026-08-31T03:00:00.000Z" })],
    series: [createSeries({ id: "series-1", projectId, name: "North Shore", bookIds: ["book-1"] })],
    voiceProfiles: [voiceProfile],
    authorVoiceMemory,
    aiCollaborationPolicy: createAiCollaborationPolicy("co-pilot"),
    projectHealthReports: [createProjectHealthReport({ projectId, generatedAt: "2026-08-31T04:00:00.000Z", metrics: { bookCompletionPercent: 25, chaptersComplete: 1, chaptersTotal: 4, wordCount: 12000, wordCountTarget: 48000, criticalCanonConflicts: 0, minorCanonConflicts: 0, unresolvedPlotThreads: 2, characters: 4, locations: 3, researchSources: 6, illustrations: 0, coverStatus: "not-started", marketingCompletionPercent: 0, publishingReadinessPercent: 10 } })],
    memoryRelationships: [createMemoryRelationship({ id: "relation-1", projectId, sourceMemoryId: "canon-a", targetMemoryId: "canon-b", relation: "same-scene", context: "The compass first appears at the lighthouse.", createdAt: "2026-08-31T05:00:00.000Z" })],
    deliveryAudits: [createDeliveryAuditReport({ projectId, generatedAt: "2026-08-31T06:00:00.000Z", checks: [{ id: "audit-1", category: "canon", passed: true, severity: "critical", message: "Canon integrity passed." }] })],
  };
}

test("FileProjectStore round-trips the complete core-owned project state through validation", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-integrity-"));
  try {
    const store = new FileProjectStore(root);
    const project = completeProject();
    await store.create(project);
    const restored = await store.load(project.metadata.id);

    assert.ok(restored);
    assert.deepEqual(restored.bookVersionHistories, project.bookVersionHistories);
    assert.deepEqual(restored.authorDecisions, project.authorDecisions);
    assert.deepEqual(restored.series, project.series);
    assert.deepEqual(restored.voiceProfiles, project.voiceProfiles);
    assert.deepEqual(restored.authorVoiceMemory, project.authorVoiceMemory);
    assert.deepEqual(restored.aiCollaborationPolicy, project.aiCollaborationPolicy);
    assert.deepEqual(restored.projectHealthReports, project.projectHealthReports);
    assert.deepEqual(restored.memoryRelationships, project.memoryRelationships);
    assert.deepEqual(restored.deliveryAudits, project.deliveryAudits);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("FileProjectStore rejects invalid core state before replacing a previously good project", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-prepublish-"));
  try {
    const store = new FileProjectStore(root);
    const project = completeProject();
    await store.create(project);
    const path = join(root, "projects", project.metadata.id, "project.json");
    const before = await readFile(path, "utf8");

    const corrupt = {
      ...project,
      authorDecisions: [{ ...project.authorDecisions[0], projectId: "another-project" }],
    };
    await assert.rejects(() => store.save(corrupt), /belongs to another project/);

    const after = await readFile(path, "utf8");
    assert.equal(after, before);
    const entries = await readdir(join(root, "projects", project.metadata.id));
    assert.deepEqual(entries.filter((entry) => entry.endsWith(".tmp")), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("FileProjectStore rejects dangling memory relationships and duplicate memory ids before publication", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-relations-"));
  try {
    const store = new FileProjectStore(root);
    const project = completeProject();
    await assert.rejects(
      () => store.save({ ...project, memoryRelationships: [{ ...project.memoryRelationships[0], targetMemoryId: "missing-memory" }] }),
      /references missing project memory/
    );
    await assert.rejects(
      () => store.save({ ...project, memories: [project.memories[0], project.memories[0]] }),
      /Duplicate memory id/
    );
    assert.equal(await store.exists(project.metadata.id), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("FileProjectStore rejects malformed author voice state instead of carrying opaque corrupt state forward", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-voice-integrity-"));
  try {
    const store = new FileProjectStore(root);
    const project = completeProject();
    const brokenVoice = {
      ...project.authorVoiceMemory,
      canonicalSampleIds: ["sample-that-does-not-exist"],
    };
    await assert.rejects(() => store.save({ ...project, authorVoiceMemory: brokenVoice }), /Invalid canonical author voice sample ids/);
    assert.equal(await store.exists(project.metadata.id), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

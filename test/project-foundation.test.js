const assert = require("node:assert/strict");
const { mkdtemp, readFile, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const test = require("node:test");
const {
  createProject,
  FileProjectStore,
  PROJECT_FORMAT_VERSION,
  createMemoryRecord,
  withProjectMemories,
  touchProject
} = require("../.forge-build/index.js");

test("creates a canonical project with durable memory state", () => {
  const project = createProject({ id: "better-question", title: "The Better Question", now: "2026-01-01T00:00:00.000Z" });
  assert.equal(project.formatVersion, PROJECT_FORMAT_VERSION);
  assert.equal(project.metadata.title, "The Better Question");
  assert.equal(project.metadata.status, "active");
  assert.deepEqual(project.memories, []);
});

test("persists and restores project metadata and Project Brain memory without hidden process state", async () => {
  const root = await mkdtemp(join(tmpdir(), "authors-forge-"));
  try {
    const store = new FileProjectStore(root);
    const original = createProject({ id: "journal-001", title: "The Better Question — Edition 001", now: "2026-01-01T00:00:00.000Z" });
    const memory = createMemoryRecord({
      id: "canon-1",
      projectId: original.metadata.id,
      class: "story-canon",
      authority: "authoritative",
      summary: "The opening setting",
      content: "The story opens in Ogden.",
      provenance: [{ kind: "author", reference: "author-note-1", recordedAt: "2026-01-01T00:00:00.000Z" }],
      relevanceTags: ["opening", "setting"]
    });
    const enriched = withProjectMemories(original, [memory], "2026-01-01T00:00:01.000Z");
    await store.create(enriched);

    assert.equal(await store.exists(enriched.metadata.id), true);
    const restored = await store.load(enriched.metadata.id);
    assert.deepEqual(restored, enriched);

    const updated = touchProject(enriched, "2026-01-02T00:00:00.000Z");
    await store.save(updated);
    assert.deepEqual(await store.load(enriched.metadata.id), updated);

    const persisted = await readFile(join(root, "projects", "journal-001", "project.json"), "utf8");
    assert.match(persisted, /\"formatVersion\": 4/);
    assert.match(persisted, /\"canon-1\"/);
    assert.doesNotMatch(persisted, new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects unsafe project identifiers", async () => {
  const root = await mkdtemp(join(tmpdir(), "authors-forge-"));
  try {
    const store = new FileProjectStore(root);
    await assert.rejects(() => store.exists("../escape"), /unsupported path characters/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

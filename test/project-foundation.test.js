const assert = require("node:assert/strict");
const { mkdtemp, readFile, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const test = require("node:test");
const {
  createProject,
  FileProjectStore,
  PROJECT_FORMAT_VERSION,
  touchProject
} = require("../.forge-build/index.js");

test("creates a canonical project", () => {
  const project = createProject({ id: "better-question", title: "The Better Question", now: "2026-01-01T00:00:00.000Z" });
  assert.equal(project.formatVersion, PROJECT_FORMAT_VERSION);
  assert.equal(project.metadata.title, "The Better Question");
  assert.equal(project.metadata.status, "active");
});

test("persists and restores a project without hidden process state", async () => {
  const root = await mkdtemp(join(tmpdir(), "authors-forge-"));
  try {
    const store = new FileProjectStore(root);
    const original = createProject({ id: "journal-001", title: "The Better Question — Edition 001", now: "2026-01-01T00:00:00.000Z" });
    await store.create(original);

    assert.equal(await store.exists(original.metadata.id), true);
    const restored = await store.load(original.metadata.id);
    assert.deepEqual(restored, original);

    const updated = touchProject(original, "2026-01-02T00:00:00.000Z");
    await store.save(updated);
    assert.deepEqual(await store.load(original.metadata.id), updated);

    const persisted = await readFile(join(root, "projects", "journal-001", "project.json"), "utf8");
    assert.match(persisted, /\"formatVersion\": 1/);
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

const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, readdir, rm } = require("node:fs/promises");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const { FileProjectStore } = require("../.forge-build/infrastructure/file-project-store.js");
const { createProject } = require("../.forge-build/domain/project.js");

test("overlapping project saves leave one complete project and no orphan temp files", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-project-concurrency-"));
  try {
    const store = new FileProjectStore(root);
    const saves = Array.from({ length: 16 }, (_, index) => store.save(createProject({
      id: "project-1",
      title: `Concurrent version ${index + 1}`,
      now: `2026-09-06T10:${String(index).padStart(2, "0")}:00.000Z`,
    })));
    await Promise.all(saves);

    const loaded = await store.load("project-1");
    assert.ok(loaded);
    assert.match(loaded.metadata.title, /^Concurrent version \d+$/);

    const entries = await readdir(join(root, "projects", "project-1"));
    assert.deepEqual(entries.sort(), ["project.json"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

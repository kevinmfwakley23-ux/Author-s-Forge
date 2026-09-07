const assert = require("node:assert/strict");
const { mkdtemp, readFile, readdir, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const test = require("node:test");
const { createProject, FileProjectStore, touchProject } = require("../.forge-build/index.js");

test("same-project concurrent saves remain valid and leave no orphan temporary files", async () => {
  const root = await mkdtemp(join(tmpdir(), "authors-forge-save-integrity-"));
  try {
    const store = new FileProjectStore(root);
    const project = createProject({ id: "concurrent-save", title: "Concurrent Save", now: "2026-09-07T00:00:00.000Z" });
    await store.create(project);
    const candidates = Array.from({ length: 24 }, (_, index) =>
      touchProject(project, `2026-09-07T00:00:${String(index + 1).padStart(2, "0")}.000Z`)
    );

    await Promise.all(candidates.map((candidate) => store.save(candidate)));

    const restored = await store.load(project.metadata.id);
    assert.ok(restored, "A valid project must remain loadable after overlapping saves.");
    assert.ok(candidates.some((candidate) => candidate.metadata.updatedAt === restored.metadata.updatedAt), "Final state must be one complete submitted save, not a torn mixture.");

    const projectDir = join(root, "projects", project.metadata.id);
    const raw = await readFile(join(projectDir, "project.json"), "utf8");
    assert.doesNotThrow(() => JSON.parse(raw));
    const entries = await readdir(projectDir);
    assert.deepEqual(entries.filter((name) => name.endsWith(".tmp")), [], "Atomic save must clean every sibling temporary file.");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

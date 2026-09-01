const assert = require("node:assert/strict");
const test = require("node:test");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { createProject, withProjectStudioWorkspace } = require("../.forge-build/domain/project.js");
const { createStudioWorkspace, addWorkspaceBook, createWorkspaceBook } = require("../.forge-build/domain/studio-workspace.js");
const { FileProjectStore } = require("../.forge-build/infrastructure/file-project-store.js");
const { ProjectPackageService } = require("../.forge-build/application/project-package.js");
const { StudioProjectRecoveryService } = require("../.forge-build/application/studio-project-recovery.js");

function workspace(bookId) {
  if (!bookId) return createStudioWorkspace();
  return addWorkspaceBook(createStudioWorkspace(), createWorkspaceBook({ id: bookId, title: `Book ${bookId}`, kind: "novel", description: "Recovery test" }));
}

function projectWithWorkspace(title, bookId, now) {
  const project = createProject({ id: "p1", title, now });
  return withProjectStudioWorkspace(project, workspace(bookId), now);
}

async function withStore(run) {
  const root = await mkdtemp(join(tmpdir(), "forge-recovery-"));
  try {
    const store = new FileProjectStore(root);
    await run(store);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("Studio project recovery atomically restores a prior package and returns a rollback package", async () => {
  await withStore(async (store) => {
    const packages = new ProjectPackageService();
    const recovery = new StudioProjectRecoveryService(store, packages);
    const original = projectWithWorkspace("Original", "book-original", "2026-09-01T00:00:00.000Z");
    await store.create(original);
    const originalPackage = packages.exportStudioSnapshot({ projectId: "p1", project: original, studioWorkspace: original.studioWorkspace, exportedAt: "2026-09-01T00:10:00.000Z" });

    const current = projectWithWorkspace("Current", "book-current", "2026-09-01T01:00:00.000Z");
    await store.save(current);

    const result = await recovery.restoreExisting("p1", originalPackage, "2026-09-01T02:00:00.000Z");
    assert.equal(result.restored.metadata.title, "Original");
    assert.equal(result.restored.studioWorkspace.books[0].id, "book-original");
    assert.equal((await store.load("p1")).metadata.title, "Original");
    assert.equal(result.rollbackPackage.manifest.projectId, "p1");
    assert.equal(result.rollbackPackage.projectState.project.metadata.title, "Current");
    assert.equal(result.rollbackPackage.projectState.studioWorkspace.books[0].id, "book-current");

    const rolledBack = await recovery.restoreExisting("p1", result.rollbackPackage, "2026-09-01T03:00:00.000Z");
    assert.equal(rolledBack.restored.metadata.title, "Current");
    assert.equal(rolledBack.restored.studioWorkspace.books[0].id, "book-current");
  });
});

test("canonical ProjectState validation rejects a corrupt incoming package before replacing good durable state", async () => {
  await withStore(async (store) => {
    const packages = new ProjectPackageService();
    const recovery = new StudioProjectRecoveryService(store, packages);
    const current = projectWithWorkspace("Safe Current", "safe-book", "2026-09-01T01:00:00.000Z");
    await store.create(current);

    const corruptProject = { ...current, metadata: { ...current.metadata, status: "corrupt" } };
    const corruptPackage = packages.exportSnapshot({
      projectId: "p1",
      projectState: { project: corruptProject, studioWorkspace: current.studioWorkspace },
      exportedAt: "2026-09-01T02:00:00.000Z",
    });

    await assert.rejects(() => recovery.restoreExisting("p1", corruptPackage), /invalid project status/i);
    const after = await store.load("p1");
    assert.equal(after.metadata.title, "Safe Current");
    assert.equal(after.metadata.status, "active");
    assert.equal(after.studioWorkspace.books[0].id, "safe-book");
  });
});

test("Studio envelope validation rejects cross-project restore before durable mutation", async () => {
  await withStore(async (store) => {
    const packages = new ProjectPackageService();
    const recovery = new StudioProjectRecoveryService(store, packages);
    const current = projectWithWorkspace("Safe Current", "safe-book", "2026-09-01T01:00:00.000Z");
    await store.create(current);

    const other = createProject({ id: "p2", title: "Other project", now: "2026-09-01T00:00:00.000Z" });
    const packageForP2 = packages.exportSnapshot({
      projectId: "p2",
      projectState: { project: other, studioWorkspace: createStudioWorkspace() },
      exportedAt: "2026-09-01T02:00:00.000Z",
    });

    await assert.rejects(() => recovery.restoreExisting("p1", packageForP2), /does not match the restore target/i);
    assert.equal((await store.load("p1")).metadata.title, "Safe Current");
  });
});

test("restoreExisting refuses implicit creation of a missing project", async () => {
  await withStore(async (store) => {
    const packages = new ProjectPackageService();
    const recovery = new StudioProjectRecoveryService(store, packages);
    const missing = projectWithWorkspace("Missing", "book-missing", "2026-09-01T00:00:00.000Z");
    const pkg = packages.exportStudioSnapshot({ projectId: "p1", project: missing, studioWorkspace: missing.studioWorkspace });

    await assert.rejects(() => recovery.restoreExisting("p1", pkg), /does not exist and cannot be restored in place/i);
    assert.equal(await store.load("p1"), null);
  });
});

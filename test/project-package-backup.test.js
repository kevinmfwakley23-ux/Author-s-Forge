const assert = require("node:assert/strict");
const test = require("node:test");
const { mkdtemp, readFile, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { createProject, withProjectStudioWorkspace } = require("../.forge-build/domain/project.js");
const { createStudioWorkspace, addWorkspaceBook, createWorkspaceBook } = require("../.forge-build/domain/studio-workspace.js");
const { createProjectStorageBinding, MemoryStorageProvider } = require("../.forge-build/domain/external-storage.js");
const { FileProjectStore } = require("../.forge-build/infrastructure/file-project-store.js");
const { LocalFileStorageProvider } = require("../.forge-build/infrastructure/local-storage-provider.js");
const { ExternalStorageService } = require("../.forge-build/application/external-storage.js");
const { ProjectPackageService } = require("../.forge-build/application/project-package.js");
const { ProjectPackageBackupService } = require("../.forge-build/application/project-package-backup.js");

function workspace(bookId) {
  if (!bookId) return createStudioWorkspace();
  return addWorkspaceBook(createStudioWorkspace(), createWorkspaceBook({ id: bookId, title: `Book ${bookId}`, kind: "novel", description: "Backup test" }));
}

function projectWithWorkspace(id, title, bookId, now) {
  return withProjectStudioWorkspace(createProject({ id, title, now }), workspace(bookId), now);
}

async function withBackupEnvironment(run) {
  const root = await mkdtemp(join(tmpdir(), "forge-backup-"));
  try {
    const store = new FileProjectStore(root);
    const provider = new MemoryStorageProvider();
    const storage = new ExternalStorageService(provider);
    const packages = new ProjectPackageService();
    const backups = new ProjectPackageBackupService(store, storage, packages);
    await run({ root, store, provider, storage, packages, backups });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("external project backup writes the real Studio package and previews it without mutation", async () => {
  await withBackupEnvironment(async ({ store, backups }) => {
    const project = projectWithWorkspace("p1", "Backup Source", "book-one", "2026-09-01T01:00:00.000Z");
    await store.create(project);
    const binding = createProjectStorageBinding({ projectId: "p1", providerId: "download" });

    const result = await backups.backupExisting("p1", binding, "2026-09-01T02:03:04.005Z", "backup-one");
    assert.equal(result.projectId, "p1");
    assert.equal(result.backupId, "backup-one");
    assert.match(result.key, /^backups\/20260901T020304005Z-backup-one-p1\.forge-project\.json$/);
    assert.equal(result.stored.key, result.key, "application backup metadata must use the same relative key accepted by preview/delete");
    assert.equal(result.stored.mediaType, "application/json");
    assert.equal(result.package.manifest.projectId, "p1");

    const preview = await backups.previewBackup("p1", binding, result.key);
    assert.equal(preview.project.metadata.title, "Backup Source");
    assert.equal(preview.project.studioWorkspace.books[0].id, "book-one");
    assert.equal((await store.load("p1")).metadata.title, "Backup Source");
  });
});

test("backup ids make same-instant backups distinct, listed keys round-trip, and duplicate keys never overwrite", async () => {
  await withBackupEnvironment(async ({ store, storage, backups }) => {
    await store.create(projectWithWorkspace("p1", "Source", "book-one", "2026-09-01T01:00:00.000Z"));
    const binding = createProjectStorageBinding({ projectId: "p1", providerId: "download" });
    const at = "2026-09-01T02:00:00.000Z";

    const first = await backups.backupExisting("p1", binding, at, "one");
    const second = await backups.backupExisting("p1", binding, at, "two");
    assert.notEqual(first.key, second.key);
    await assert.rejects(() => backups.backupExisting("p1", binding, at, "one"), /never overwritten/i);
    await storage.put(binding, "backups/readme.txt", new TextEncoder().encode("not a Forge package"), "text/plain");

    const listed = await backups.listBackups("p1", binding);
    assert.equal(listed.length, 2);
    assert.equal(listed.every((item) => item.key.startsWith("backups/") && item.key.endsWith(".forge-project.json")), true);
    for (const item of listed) {
      const preview = await backups.previewBackup("p1", binding, item.key);
      assert.equal(preview.project.metadata.id, "p1");
    }
  });
});

test("backup boundary rejects missing projects, cross-project bindings and malformed identifiers before storage", async () => {
  await withBackupEnvironment(async ({ store, backups }) => {
    await store.create(projectWithWorkspace("p1", "Source", "book-one", "2026-09-01T01:00:00.000Z"));
    const p1 = createProjectStorageBinding({ projectId: "p1", providerId: "download" });
    const p2 = createProjectStorageBinding({ projectId: "p2", providerId: "download" });

    await assert.rejects(() => backups.backupExisting("missing", createProjectStorageBinding({ projectId: "missing", providerId: "download" })), /does not exist and cannot be backed up/i);
    await assert.rejects(() => backups.backupExisting("p1", p2), /binding does not match/i);
    await assert.rejects(() => backups.backupExisting("p1", p1, "not-a-date", "backup-one"), /must be a valid timestamp/i);
    await assert.rejects(() => backups.backupExisting("p1", p1, "2026-09-01T02:00:00.000Z", "../escape"), /backup id contains unsupported/i);
  });
});

test("preview rejects tampered, cross-project and non-backup external objects", async () => {
  await withBackupEnvironment(async ({ store, storage, packages, backups }) => {
    await store.create(projectWithWorkspace("p1", "Source", "book-one", "2026-09-01T01:00:00.000Z"));
    const p1 = createProjectStorageBinding({ projectId: "p1", providerId: "download" });
    const good = await backups.backupExisting("p1", p1, "2026-09-01T02:00:00.000Z", "good");

    await storage.put(p1, "backups/tampered.forge-project.json", new TextEncoder().encode("{not-json"), "application/json");
    await assert.rejects(() => backups.previewBackup("p1", p1, "backups/tampered.forge-project.json"));
    await assert.rejects(() => backups.previewBackup("p1", p1, "notes/not-a-backup.json"), /must reference a Forge backup object/i);

    const other = projectWithWorkspace("p2", "Other", "book-two", "2026-09-01T01:00:00.000Z");
    const otherPackage = packages.exportStudioSnapshot({ projectId: "p2", project: other, studioWorkspace: other.studioWorkspace, exportedAt: "2026-09-01T02:00:00.000Z" });
    await storage.put(p1, "backups/cross-project.forge-project.json", new TextEncoder().encode(packages.serialize(otherPackage)), "application/json");
    await assert.rejects(() => backups.previewBackup("p1", p1, "backups/cross-project.forge-project.json"), /does not match the restore target/i);

    const stillGood = await backups.previewBackup("p1", p1, good.key);
    assert.equal(stillGood.project.metadata.id, "p1");
  });
});

test("backup deletion is project-scoped and cannot delete arbitrary storage objects", async () => {
  await withBackupEnvironment(async ({ store, storage, backups }) => {
    await store.create(projectWithWorkspace("p1", "Source", "book-one", "2026-09-01T01:00:00.000Z"));
    const binding = createProjectStorageBinding({ projectId: "p1", providerId: "download" });
    await backups.backupExisting("p1", binding, "2026-09-01T02:00:00.000Z", "delete-me");
    await storage.put(binding, "notes/keep.txt", new TextEncoder().encode("keep"), "text/plain");

    const listed = await backups.listBackups("p1", binding);
    assert.equal(listed.length, 1);
    await backups.deleteBackup("p1", binding, listed[0].key);
    await assert.rejects(() => backups.previewBackup("p1", binding, listed[0].key), /was not found/i);
    assert.equal(new TextDecoder().decode(await storage.get(binding, "notes/keep.txt")), "keep");
    await assert.rejects(() => backups.deleteBackup("p1", binding, "notes/keep.txt"), /must reference a Forge backup object/i);
  });
});

test("local-file project backups survive fresh provider and service instances", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "forge-backup-project-"));
  const backupRoot = await mkdtemp(join(tmpdir(), "forge-backup-files-"));
  try {
    const store = new FileProjectStore(projectRoot);
    await store.create(projectWithWorkspace("p1", "Filesystem Source", "book-fs", "2026-09-01T01:00:00.000Z"));
    const binding = createProjectStorageBinding({ projectId: "p1", providerId: "local" });
    const firstStorage = new ExternalStorageService(new LocalFileStorageProvider(backupRoot));
    const firstService = new ProjectPackageBackupService(store, firstStorage, new ProjectPackageService());
    const created = await firstService.backupExisting("p1", binding, "2026-09-01T02:00:00.000Z", "filesystem");

    const physical = join(backupRoot, binding.keyPrefix, ...created.key.split("/"));
    const bytes = await readFile(physical);
    assert.ok(bytes.byteLength > 0, "local provider must write a real durable backup file");

    const freshStorage = new ExternalStorageService(new LocalFileStorageProvider(backupRoot));
    const freshService = new ProjectPackageBackupService(new FileProjectStore(projectRoot), freshStorage, new ProjectPackageService());
    const listed = await freshService.listBackups("p1", binding);
    assert.deepEqual(listed.map((item) => item.key), [created.key]);
    const recovered = await freshService.previewBackup("p1", binding, listed[0].key);
    assert.equal(recovered.project.metadata.title, "Filesystem Source");
    assert.equal(recovered.project.studioWorkspace.books[0].id, "book-fs");
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
    await rm(backupRoot, { recursive: true, force: true });
  }
});

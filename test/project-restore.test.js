const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const { createProject } = require('../dist/domain/project');
const { createStudioWorkspace, createWorkspaceBook, addWorkspaceBook } = require('../dist/domain/studio-workspace');
const { ProjectPackageService } = require('../dist/application/project-package');
const { ProjectRestoreService } = require('../dist/application/project-restore');
const { FileProjectStore } = require('../dist/infrastructure/file-project-store');

test('project restore persists the validated project snapshot and workspace', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'authors-forge-restore-'));
  try {
    const sourceStore = new FileProjectStore(join(dataDir, 'source'));
    const targetStore = new FileProjectStore(join(dataDir, 'target'));
    const project = createProject({ id: 'restore-source', title: 'Restore Source' });
    const workspace = addWorkspaceBook(
      createStudioWorkspace(),
      createWorkspaceBook({ id: 'book-1', title: 'Restored Book', kind: 'novel', description: 'Portable recovery proof.' }),
    );
    await sourceStore.save({ ...project, studioWorkspace: workspace });

    const packages = new ProjectPackageService();
    const pkg = packages.exportSnapshot({
      projectId: project.metadata.id,
      projectState: { project: { ...project, studioWorkspace: workspace }, studioWorkspace: workspace },
    });

    const restore = new ProjectRestoreService(packages);
    const result = await restore.restoreSnapshot({
      targetProjectId: 'restore-source',
      pkg,
      store: targetStore,
    });

    assert.deepEqual(result, {
      projectId: 'restore-source',
      restored: true,
      hadWorkspace: true,
    });

    const persisted = await targetStore.load('restore-source');
    assert.ok(persisted);
    assert.equal(persisted.metadata.title, 'Restore Source');
    assert.equal(persisted.studioWorkspace.books[0].title, 'Restored Book');
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('project restore rejects a package addressed to another project', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'authors-forge-restore-target-'));
  try {
    const store = new FileProjectStore(dataDir);
    const project = createProject({ id: 'restore-source', title: 'Restore Source' });
    const packages = new ProjectPackageService();
    const pkg = packages.exportSnapshot({ projectId: project.metadata.id, projectState: { project } });
    const restore = new ProjectRestoreService(packages);

    await assert.rejects(
      restore.restoreSnapshot({ targetProjectId: 'different-project', pkg, store }),
      /does not match the restore target/,
    );
    assert.equal(await store.exists('different-project'), false);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

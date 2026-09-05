const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, readFile, readdir, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const { createProject } = require('../dist/domain/project');
const { ProjectPackageService } = require('../dist/application/project-package');
const { ProjectRecoveryService } = require('../dist/application/project-recovery');
const { FileProjectStore } = require('../dist/infrastructure/file-project-store');

test('recovery plans a new target without mutation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'authors-forge-recovery-plan-'));
  try {
    const store = new FileProjectStore(join(root, 'data'));
    const project = createProject({ id: 'new-target', title: 'New Target' });
    const packages = new ProjectPackageService();
    const pkg = packages.exportSnapshot({ projectId: project.metadata.id, projectState: { project } });
    const recovery = new ProjectRecoveryService(packages);

    const plan = await recovery.plan({ targetProjectId: 'new-target', pkg, store });

    assert.deepEqual(plan, {
      targetProjectId: 'new-target',
      packageProjectId: 'new-target',
      targetExists: false,
      requiresOverwriteApproval: false,
    });
    assert.equal(await store.exists('new-target'), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('recovery refuses to overwrite an existing project without explicit approval', async () => {
  const root = await mkdtemp(join(tmpdir(), 'authors-forge-recovery-refuse-'));
  try {
    const store = new FileProjectStore(join(root, 'data'));
    await store.save(createProject({ id: 'existing-target', title: 'Keep Me' }));
    const packages = new ProjectPackageService();
    const replacement = createProject({ id: 'existing-target', title: 'Replacement' });
    const pkg = packages.exportSnapshot({ projectId: replacement.metadata.id, projectState: { project: replacement } });
    const recovery = new ProjectRecoveryService(packages);

    await assert.rejects(
      recovery.restore({
        targetProjectId: 'existing-target',
        pkg,
        store,
        backupDirectory: join(root, 'backups'),
      }),
      /Explicit overwrite approval is required/,
    );

    const persisted = await store.load('existing-target');
    assert.equal(persisted.metadata.title, 'Keep Me');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('recovery creates a serialized backup before an approved overwrite', async () => {
  const root = await mkdtemp(join(tmpdir(), 'authors-forge-recovery-overwrite-'));
  try {
    const dataDir = join(root, 'data');
    const backupDir = join(root, 'backups');
    const store = new FileProjectStore(dataDir);
    const current = createProject({ id: 'overwrite-target', title: 'Original Project' });
    await store.save(current);

    const replacement = createProject({ id: 'overwrite-target', title: 'Recovered Project' });
    const packages = new ProjectPackageService();
    const pkg = packages.exportSnapshot({ projectId: replacement.metadata.id, projectState: { project: replacement } });
    const recovery = new ProjectRecoveryService(packages);

    const result = await recovery.restore({
      targetProjectId: 'overwrite-target',
      pkg,
      store,
      backupDirectory: backupDir,
      allowOverwrite: true,
    });

    assert.equal(result.projectId, 'overwrite-target');
    assert.equal(result.overwritten, true);
    assert.ok(result.backupPath);

    const backup = JSON.parse(await readFile(result.backupPath, 'utf8'));
    assert.equal(backup.manifest.projectId, 'overwrite-target');
    assert.equal(backup.projectState.project.metadata.title, 'Original Project');

    const persisted = await store.load('overwrite-target');
    assert.equal(persisted.metadata.title, 'Recovered Project');
    assert.ok((await readdir(backupDir)).length >= 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

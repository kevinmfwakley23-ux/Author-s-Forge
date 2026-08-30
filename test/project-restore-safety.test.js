const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { createProject } = require('../dist/domain/project');
const { ProjectPackageService } = require('../dist/application/project-package');
const { ProjectRestoreSafetyService } = require('../dist/application/project-restore-safety');
const { FileProjectStore } = require('../dist/infrastructure/file-project-store');
const { FileProjectRecoveryBackupStore } = require('../dist/infrastructure/file-project-recovery-backup-store');

test('recovery plan requires explicit approval when target exists', async () => {
  const root = await mkdtemp(join(tmpdir(), 'authors-forge-safety-'));
  try {
    const store = new FileProjectStore(root);
    const project = createProject({ id: 'existing-project', title: 'Existing' });
    await store.save(project);
    const safety = new ProjectRestoreSafetyService();
    assert.deepEqual(await safety.plan({ targetProjectId: project.metadata.id, store }), {
      targetProjectId: 'existing-project', targetExists: true, requiresOverwriteApproval: true, backupRequired: true,
    });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('restore refuses overwrite without approval and does not mutate target', async () => {
  const root = await mkdtemp(join(tmpdir(), 'authors-forge-safety-refuse-'));
  try {
    const store = new FileProjectStore(root);
    const backupStore = new FileProjectRecoveryBackupStore(root);
    const existing = createProject({ id: 'same-project', title: 'Existing' });
    const replacement = createProject({ id: 'same-project', title: 'Replacement' });
    await store.save(existing);
    const pkg = new ProjectPackageService().exportSnapshot({ projectId: replacement.metadata.id, projectState: { project: replacement } });
    const safety = new ProjectRestoreSafetyService();
    await assert.rejects(() => safety.restore({ targetProjectId: existing.metadata.id, pkg, store, backupStore }), /explicit overwrite approval/);
    assert.equal((await store.load('same-project')).metadata.title, 'Existing');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('approved overwrite creates a durable backup before replacement', async () => {
  const root = await mkdtemp(join(tmpdir(), 'authors-forge-safety-approve-'));
  try {
    const store = new FileProjectStore(root);
    const backupStore = new FileProjectRecoveryBackupStore(root);
    const existing = createProject({ id: 'same-project', title: 'Existing' });
    const replacement = createProject({ id: 'same-project', title: 'Replacement' });
    await store.save(existing);
    const pkg = new ProjectPackageService().exportSnapshot({ projectId: replacement.metadata.id, projectState: { project: replacement } });
    const safety = new ProjectRestoreSafetyService();
    const result = await safety.restore({ targetProjectId: existing.metadata.id, pkg, store, backupStore, approveOverwrite: true });
    assert.equal(result.overwritten, true);
    assert.ok(result.backupId);
    assert.equal((await store.load('same-project')).metadata.title, 'Replacement');
    assert.equal((await backupStore.load(result.backupId)).metadata.title, 'Existing');
  } finally { await rm(root, { recursive: true, force: true }); }
});

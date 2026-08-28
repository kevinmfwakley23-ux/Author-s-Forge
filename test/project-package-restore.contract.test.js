const test = require('node:test');
const assert = require('node:assert/strict');
const { ProjectPackageService } = require('../dist/application/project-package.js');

test('ProjectPackageService restores a validated v2 snapshot only for the matching project', () => {
  const service = new ProjectPackageService();
  const state = { metadata: { id: 'restore-project', title: 'Restore Me' }, studioWorkspace: { books: [] } };
  const pkg = service.exportSnapshot({ projectId: 'restore-project', projectState: state, exportedAt: '2026-08-28T00:00:00.000Z' });

  assert.deepEqual(service.restoreSnapshot(pkg, 'restore-project'), state);
  assert.throws(() => service.restoreSnapshot(pkg, 'different-project'), /does not match the restore target/);
});

test('ProjectPackageService restore rejects packages without a canonical state snapshot', () => {
  const service = new ProjectPackageService();
  const pkg = service.export({ projectId: 'no-state', projectState: { metadata: { id: 'no-state' } } });
  assert.throws(() => service.restoreSnapshot(pkg, 'no-state'), /does not contain a UTF-8 project-state\.json snapshot/);
});

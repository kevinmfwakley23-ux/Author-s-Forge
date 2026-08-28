const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { createProjectPackage, serializeProjectPackage, deserializeProjectPackage, PROJECT_PACKAGE_FORMAT_VERSION, PROJECT_PACKAGE_NAME } = require('../dist/domain/project-package.js');

test('project package binds manifest identity to durable project state', () => {
  assert.throws(
    () => createProjectPackage({
      projectId: 'manifest-project',
      projectState: { metadata: { id: 'different-project' } },
    }),
    /metadata id does not match the manifest project id/,
  );

  const pkg = createProjectPackage({
    projectId: 'bound-project',
    projectState: { metadata: { id: 'bound-project' }, studioWorkspace: { books: [] } },
  });
  assert.equal(pkg.manifest.projectId, 'bound-project');
  assert.equal(pkg.projectState.metadata.id, 'bound-project');
});

test('project-state.json is cryptographically and semantically bound to projectState', () => {
  const projectState = { metadata: { id: 'state-bound' }, studioWorkspace: { books: [] } };
  const serializedState = JSON.stringify(projectState, null, 2);
  const sha256 = createHash('sha256').update(serializedState, 'utf8').digest('hex');
  const valid = {
    manifest: {
      formatVersion: PROJECT_PACKAGE_FORMAT_VERSION,
      packageName: PROJECT_PACKAGE_NAME,
      projectId: 'state-bound',
      exportedAt: '2026-08-28T00:00:00.000Z',
      paths: ['project-state.json'],
    },
    projectState,
    files: [{ path: 'project-state.json', content: serializedState, encoding: 'utf8', mediaType: 'application/json', sha256 }],
  };

  assert.deepEqual(deserializeProjectPackage(JSON.stringify(valid)), valid);
  assert.throws(
    () => deserializeProjectPackage(JSON.stringify({ ...valid, projectState: { metadata: { id: 'state-bound' }, studioWorkspace: { books: [{ id: 'tampered' }] } } })),
    /project-state\.json does not match projectState/,
  );
  assert.throws(
    () => deserializeProjectPackage(JSON.stringify({ ...valid, manifest: { ...valid.manifest, projectId: 'wrong-project' } })),
    /metadata id does not match the manifest project id/,
  );
});

test('project package round-trip preserves the strengthened integrity contract', () => {
  const state = { metadata: { id: 'round-trip' }, studioWorkspace: { books: [{ id: 'book-1' }] } };
  const content = JSON.stringify(state, null, 2);
  const sha256 = createHash('sha256').update(content, 'utf8').digest('hex');
  const pkg = createProjectPackage({
    projectId: 'round-trip',
    projectState: state,
    exportedAt: '2026-08-28T00:00:00.000Z',
    files: [{ path: 'project-state.json', content, encoding: 'utf8', mediaType: 'application/json', sha256 }],
  });
  assert.deepEqual(deserializeProjectPackage(serializeProjectPackage(pkg)), pkg);
});

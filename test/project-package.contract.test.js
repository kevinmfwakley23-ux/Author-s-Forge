const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { createProjectPackage, serializeProjectPackage, deserializeProjectPackage, PROJECT_PACKAGE_FORMAT_VERSION, PROJECT_PACKAGE_NAME } = require('../dist/domain/project-package.js');
const { ProjectPackageService } = require('../dist/application/project-package.js');

test('portable project package emits a versioned integrity-checked envelope', () => {
  const content = 'Durable manuscript state.';
  const sha256 = createHash('sha256').update(content, 'utf8').digest('hex');
  const pkg = createProjectPackage({
    projectId: 'package-contract',
    projectState: { metadata: { id: 'package-contract' }, studioWorkspace: { books: [] } },
    exportedAt: '2026-08-28T00:00:00.000Z',
    files: [{ path: 'manuscript/opening.txt', content, encoding: 'utf8', mediaType: 'text/plain', sha256 }],
  });

  assert.equal(pkg.manifest.formatVersion, PROJECT_PACKAGE_FORMAT_VERSION);
  assert.equal(pkg.manifest.packageName, PROJECT_PACKAGE_NAME);
  assert.deepEqual(pkg.manifest.paths, ['manuscript/opening.txt']);
  assert.equal(pkg.files[0].sha256, sha256);

  const restored = deserializeProjectPackage(serializeProjectPackage(pkg));
  assert.deepEqual(restored, pkg);
});

test('portable project package rejects traversal and integrity violations', () => {
  const validContent = 'safe';
  const sha256 = createHash('sha256').update(validContent, 'utf8').digest('hex');
  const base = {
    manifest: {
      formatVersion: PROJECT_PACKAGE_FORMAT_VERSION,
      packageName: PROJECT_PACKAGE_NAME,
      projectId: 'package-contract',
      exportedAt: '2026-08-28T00:00:00.000Z',
      paths: ['safe.txt'],
    },
    projectState: {},
    files: [{ path: 'safe.txt', content: validContent, encoding: 'utf8', mediaType: 'text/plain', sha256 }],
  };

  assert.throws(() => deserializeProjectPackage(JSON.stringify({ ...base, files: [{ ...base.files[0], path: '../escape.txt' }] })), /traversal-safe/);
  assert.throws(() => deserializeProjectPackage(JSON.stringify({ ...base, files: [{ ...base.files[0], content: 'tampered' }] })), /does not match its content/);
  assert.throws(() => deserializeProjectPackage(JSON.stringify({ ...base, manifest: { ...base.manifest, formatVersion: 1 } })), /Unsupported project package format version/);
});

test('ProjectPackageService creates a canonical v2 snapshot with an integrity-checked state file', () => {
  const service = new ProjectPackageService();
  const projectState = { metadata: { id: 'snapshot-contract' }, studioWorkspace: { books: [{ id: 'book-1' }] } };
  const pkg = service.exportSnapshot({ projectId: 'snapshot-contract', projectState, exportedAt: '2026-08-28T00:00:00.000Z' });

  assert.equal(pkg.manifest.formatVersion, 2);
  assert.deepEqual(pkg.manifest.paths, ['project-state.json']);
  assert.equal(pkg.projectState.metadata.id, 'snapshot-contract');
  assert.equal(pkg.files[0].path, 'project-state.json');
  assert.equal(pkg.files[0].mediaType, 'application/json');
  assert.equal(pkg.files[0].sha256, createHash('sha256').update(JSON.stringify(projectState, null, 2), 'utf8').digest('hex'));
  assert.deepEqual(service.import(service.serialize(pkg)), pkg);
});

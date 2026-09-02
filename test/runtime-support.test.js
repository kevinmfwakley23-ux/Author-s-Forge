const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function text(path) { return fs.readFileSync(path, 'utf8'); }

test('Forge has one explicit Node 24 LTS runtime contract', () => {
  const pkg = JSON.parse(text('package.json'));
  const lock = JSON.parse(text('package-lock.json'));
  assert.equal(text('.nvmrc').trim(), '24');
  assert.equal(pkg.engines.node, '>=24 <25');
  assert.equal(lock.packages[''].engines.node, pkg.engines.node);
  assert.equal(Number(process.versions.node.split('.')[0]), 24, `verification must execute on Node 24, got ${process.versions.node}`);
  assert.equal(pkg.scripts.preinstall, 'node scripts/require-node24.js');
  assert.equal(pkg.scripts.prebuild, 'node scripts/require-node24.js');
  assert.equal(pkg.scripts['runtime:check'], 'node scripts/require-node24.js');
  assert.match(text('scripts/require-node24.js'), /major !== 24/);
});

test('GitHub verification and release workflows use current Node-24-capable actions and exact installs', () => {
  for (const path of ['.github/workflows/ci.yml', '.github/workflows/canonical-verification.yml', '.github/workflows/release-bundle.yml']) {
    const workflow = text(path);
    assert.doesNotMatch(workflow, /actions\/checkout@v4/);
    assert.doesNotMatch(workflow, /actions\/setup-node@v4/);
    assert.match(workflow, /actions\/checkout@v7/);
    assert.match(workflow, /actions\/setup-node@v7/);
    assert.match(workflow, /node-version-file:\s*\.nvmrc/);
    assert.match(workflow, /npm ci/);
  }
  const canonical = text('.github/workflows/canonical-verification.yml');
  assert.doesNotMatch(canonical, /run:\s*npm install(?:\s|$)/);
  assert.match(canonical, /run:\s*npm run verify/);
  const release = text('.github/workflows/release-bundle.yml');
  assert.match(release, /cp package\.json package-lock\.json \.nvmrc/);
  assert.match(release, /Node\.js 24 LTS/);
});

test('Android Termux launcher requires the LTS package instead of an unvalidated current Node major', () => {
  const termux = text('scripts/termux-forge.sh');
  assert.match(termux, /pkg install nodejs-lts npm/);
  assert.match(termux, /NODE_MAJOR/);
  assert.match(termux, /\[ "\$NODE_MAJOR" != "24" \]/);
  assert.match(termux, /node scripts\/require-node24\.js/);
  assert.match(termux, /npm ci/);
  assert.doesNotMatch(termux, /Install it with: pkg install nodejs\b/);
});

test('platform contract names Chromebook and Android as Node 24 LTS targets', () => {
  const platform = text('docs/PLATFORM_SUPPORT.md');
  assert.match(platform, /Asus Chromebook/);
  assert.match(platform, /Android phone/);
  assert.match(platform, /Node\.js 24 LTS/);
  assert.match(platform, /nodejs-lts/);
  assert.match(platform, /npm ci/);
});

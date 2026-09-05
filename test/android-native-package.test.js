const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const androidConfig = JSON.parse(fs.readFileSync('src-tauri/tauri.android.conf.json', 'utf8'));
const tauriConfig = JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json', 'utf8'));
const cargo = fs.readFileSync('src-tauri/Cargo.toml', 'utf8');
const nativeShell = fs.readFileSync('native-shell/app.js', 'utf8');
const workflow = fs.readFileSync('.github/workflows/android-native.yml', 'utf8');
const ignore = fs.readFileSync('.gitignore', 'utf8');

test('native Android package keeps a stable application identity and pinned Tauri runtime', () => {
  assert.equal(tauriConfig.identifier, 'com.authorsforge.app');
  assert.equal(tauriConfig.build.frontendDist, '../native-shell');
  assert.equal(androidConfig.bundle.android.minSdkVersion, 24);
  assert.match(cargo, /tauri-build = \{ version = "=2\.6\.3"/);
  assert.match(cargo, /tauri = \{ version = "=2\.11\.5"/);
});

test('Android native gateway is HTTPS-only and rejects credential-bearing remote URLs', () => {
  const csp = androidConfig.app.security.csp;
  assert.match(csp, /navigate-to https:/);
  assert.doesNotMatch(csp, /navigate-to[^;]*http:/, 'Android package must not authorize remote plain HTTP navigation');
  assert.match(nativeShell, /Remote Forge connections must use HTTPS/);
  assert.match(nativeShell, /parsed\.username \|\| parsed\.password/);
});

test('Android packaging workflow produces and verifies a real APK artifact', () => {
  assert.match(workflow, /cargo tauri android init --ci --skip-targets-install/);
  assert.match(workflow, /cargo tauri android build --debug --apk --ci/);
  assert.match(workflow, /cargo tauri icon public\/icon-512\.png/);
  assert.match(workflow, /apksigner/);
  assert.match(workflow, /sha256sum/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
  assert.match(workflow, /if-no-files-found: error/);
});

test('Android signing secrets and generated native state cannot be committed accidentally', () => {
  for (const required of ['src-tauri/gen/', 'src-tauri/target/', '*.jks', '*.keystore', 'keystore.properties']) {
    assert.match(ignore, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

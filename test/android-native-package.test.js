const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const androidConfig = JSON.parse(fs.readFileSync('src-tauri/tauri.android.conf.json', 'utf8'));
const tauriConfig = JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json', 'utf8'));
const cargo = fs.readFileSync('src-tauri/Cargo.toml', 'utf8');
const nativeShell = fs.readFileSync('native-shell/app.js', 'utf8');
const nativeHtml = fs.readFileSync('native-shell/index.html', 'utf8');
const runtimeAssembler = fs.readFileSync('scripts/prepare-android-embedded-runtime.js', 'utf8');
const workflow = fs.readFileSync('.github/workflows/android-native.yml', 'utf8');
const ignore = fs.readFileSync('.gitignore', 'utf8');

test('native Android package keeps a stable application identity and pinned Tauri runtime', () => {
  assert.equal(tauriConfig.identifier, 'com.authorsforge.app');
  assert.equal(tauriConfig.build.frontendDist, '../native-shell');
  assert.equal(androidConfig.bundle.android.minSdkVersion, 24);
  assert.match(cargo, /tauri-build = \{ version = "=2\.6\.3"/);
  assert.match(cargo, /tauri = \{ version = "=2\.11\.5"/);
});

test('Android native boot is locked to the private embedded localhost Forge instead of an arbitrary hosted URL', () => {
  const csp = androidConfig.app.security.csp;
  assert.match(csp, /connect-src[^;]*http:\/\/127\.0\.0\.1:4173/);
  assert.match(csp, /navigate-to[^;]*http:\/\/127\.0\.0\.1:4173/);
  assert.doesNotMatch(csp, /navigate-to[^;]*https:/, 'Standalone Android must not authorize arbitrary hosted navigation');
  assert.doesNotMatch(nativeHtml, /forge\.example\.com|forge-url|Enter the HTTPS address|Enter the Forge/i);
  assert.doesNotMatch(nativeShell, /validateForgeUrl|window\.location\.assign\(target\.href\)|parsed\.username|parsed\.password/);
  assert.match(nativeHtml, /No hosted address and no Termux are required/);
  assert.match(runtimeAssembler, /http:\/\/127\.0\.0\.1:4173\/api\/health/);
  assert.match(runtimeAssembler, /webView\.loadUrl\(STUDIO_URL\)/);
});

test('Android packaging workflow produces and verifies a real standalone APK artifact', () => {
  assert.match(workflow, /cargo tauri android init --ci --skip-targets-install/);
  assert.match(workflow, /prepare-android-embedded-runtime\.js/);
  assert.match(workflow, /android-node18-runtime-smoke\.js/);
  assert.match(workflow, /cargo tauri android build --debug --apk --ci/);
  assert.match(workflow, /assets\/nodejs-project\/dist\/studio-server\.js/);
  assert.match(workflow, /assets\/nodejs-project\/public\/index\.html/);
  assert.match(workflow, /libforge_node_bridge\.so/);
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

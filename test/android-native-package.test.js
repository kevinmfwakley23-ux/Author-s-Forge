const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const androidConfig = JSON.parse(fs.readFileSync('src-tauri/tauri.android.conf.json', 'utf8'));
const tauriConfig = JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json', 'utf8'));
const cargo = fs.readFileSync('src-tauri/Cargo.toml', 'utf8');
const nativeShell = fs.readFileSync('native-shell/app.js', 'utf8');
const nativeHtml = fs.readFileSync('native-shell/index.html', 'utf8');
const runtime = fs.readFileSync('src-tauri/src/runtime.rs', 'utf8');
const officeRuntime = fs.readFileSync('src-tauri/src/office_runtime.rs', 'utf8');
const workflow = fs.readFileSync('.github/workflows/android-native.yml', 'utf8');
const standaloneGate = fs.readFileSync('scripts/verify-android-standalone-contract.js', 'utf8');
const ignore = fs.readFileSync('.gitignore', 'utf8');

test('native Android package keeps a stable application identity and pinned Tauri runtime', () => {
  assert.equal(tauriConfig.identifier, 'com.authorsforge.app');
  assert.equal(tauriConfig.build.frontendDist, '../native-shell');
  assert.equal(androidConfig.bundle.android.minSdkVersion, 24);
  assert.match(cargo, /tauri-build = \{ version = "=2\.6\.3"/);
  assert.match(cargo, /tauri = \{ version = "=2\.11\.5"/);
});

test('Android native shell is device-local and contains no remote Forge gateway bootstrap', () => {
  assert.doesNotMatch(nativeHtml, /id=["']connect-form["']|id=["']forge-url["']|https?:\/\/127\.0\.0\.1:4173|https?:\/\/localhost:4173|hosted-forge/i);
  assert.doesNotMatch(nativeShell, /window\.location\.assign|authors-forge-native-url|validateForgeUrl|localStorage\.(?:getItem|setItem).*forge|sessionStorage\.(?:getItem|setItem).*forge/i);
  assert.match(nativeHtml, /No Chromebook dependency/i);
  assert.match(nativeHtml, /No gateway fallback/i);
  assert.match(nativeShell, /native_runtime_status/);
  assert.match(runtime, /STANDALONE_ANDROID_RUNTIME_READY/);
});

test('native Android runtime declares separate office brains and secure/native platform adapters', () => {
  for (const office of ['studio', 'journal', 'workbooks', 'specialized', 'nft']) {
    assert.match(officeRuntime, new RegExp(`"${office}"`));
  }
  for (const provider of ['omniroute', '9router', 'openai', 'groq', 'mistral', 'gemini', 'anthropic', 'openrouter', 'ollama', 'kings']) {
    assert.match(officeRuntime, new RegExp(`"${provider}"`));
  }
  assert.match(officeRuntime, /broker_instance_id/);
  assert.match(officeRuntime, /credential_namespace/);
  assert.match(officeRuntime, /total_accounted_tokens/);
  assert.match(cargo, /tauri-plugin-store/);
  assert.match(cargo, /tauri-plugin-stronghold/);
  assert.match(cargo, /tauri-plugin-http/);
  assert.match(cargo, /tauri-plugin-fs/);
});

test('Android packaging workflow is blocked by the standalone contract before producing an APK', () => {
  assert.match(workflow, /verify-android-standalone-contract\.js/);
  assert.match(standaloneGate, /STANDALONE_ANDROID_RUNTIME_READY/);
  assert.match(standaloneGate, /No Android artifact from this source may be labeled a standalone\/private-test Forge build/);
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

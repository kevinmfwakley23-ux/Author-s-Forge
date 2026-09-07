const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Android native shell opens the real embedded Forge instead of requesting a hosted URL", () => {
  const html = read("native-shell/index.html");
  const app = read("native-shell/app.js");
  const css = read("native-shell/styles.css");

  assert.match(html, /Opening your Forge/);
  assert.match(html, /Starting the private Forge Core on this device/);
  assert.match(html, /assets\/brand\/kings-authors-forge-official-512\.png/);
  assert.doesNotMatch(html, /forge\.example\.com|forge-url|Enter the HTTPS address|Enter the Forge/i);
  assert.doesNotMatch(app, /authors-forge-native-url|validateForgeUrl|window\.location\.assign\(target\.href\)/);
  assert.match(app, /__forgeNativeBootFailed/);
  assert.match(css, /#f[0-9a-f]{5}|#fff/i);
  assert.match(css, /#9a701b|#a77b22|gold/i);
});

test("Android build assembles a private embedded Node Forge runtime and verifies APK payload", () => {
  const workflow = read(".github/workflows/android-native.yml");
  const prepare = read("scripts/prepare-android-embedded-runtime.js");
  const finalize = read("scripts/finalize-android-native-runtime.js");
  const androidConfig = read("src-tauri/tauri.android.conf.json");

  assert.match(workflow, /NODEJS_MOBILE_VERSION: "18\.20\.4"/);
  assert.match(workflow, /prepare-android-embedded-runtime\.js/);
  assert.match(workflow, /finalize-android-native-runtime\.js/);
  assert.match(workflow, /android-node18-runtime-smoke\.js/);
  assert.match(workflow, /--target aarch64/);
  assert.match(workflow, /--target armv7/);
  assert.match(workflow, /--target x86_64/);
  assert.doesNotMatch(workflow, /--target i686/);
  assert.match(workflow, /assets\/nodejs-project\/public\/index\.html/);
  assert.match(workflow, /libforge_node_bridge\.so/);
  assert.match(workflow, /One place to finish the book/);

  assert.match(prepare, /nodejs-project/);
  assert.match(prepare, /studio-server\.js/);
  assert.match(prepare, /copyTree\(path\.join\(root, "public"\)/);
  assert.match(prepare, /node_modules", "jpeg-js/);
  assert.match(prepare, /node::Start/);
  assert.match(prepare, /System\.loadLibrary\(\"node\"\)/);
  assert.match(prepare, /http:\/\/127\.0\.0\.1:4173\/api\/health/);
  assert.match(prepare, /FORGE_DATA_DIR/);
  assert.match(prepare, /forge_network_security_config/);

  assert.match(finalize, /JSONObject\.quote/);
  assert.match(finalize, /window\.__forgeNativeBootFailed\(\$safe\)/);
  assert.match(finalize, /safe Tauri\/Forge startup order/);

  assert.match(androidConfig, /http:\/\/127\.0\.0\.1:4173/);
  assert.doesNotMatch(androidConfig, /navigate-to https:/);
});

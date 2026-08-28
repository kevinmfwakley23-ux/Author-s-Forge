const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("public/index.html", "utf8");
const script = fs.readFileSync("public/forge-command-center.js", "utf8");

test("Studio exposes a dictation control for author text fields", () => {
  assert.match(html, /forge-command-center\.js/);
  assert.match(script, /querySelectorAll\('\s*textarea, input\[type=\\?['"]text/);
  assert.match(script, /SpeechRecognition/);
  assert.match(script, /webkitSpeechRecognition/);
  assert.match(script, /forge-inline-mic/);
  assert.match(script, /Original transcript captured and editable/);
});

test("Image Lab exposes reference upload and real provider execution", () => {
  assert.match(script, /forge-image-lab/);
  assert.match(script, /forge-image-upload/);
  assert.match(script, /accept=\"image\/png,image\/jpeg,image\/webp\"/);
  assert.match(script, /\/ai\/image/);
  assert.match(script, /referenceImage/);
  assert.match(script, /configured image provider/);
});

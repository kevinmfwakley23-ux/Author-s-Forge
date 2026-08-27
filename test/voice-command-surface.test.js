const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("public/index.html", "utf8");
const script = fs.readFileSync("public/forge-command-center.js", "utf8");

test("Forge Studio exposes the first-class command center script", () => {
  assert.match(html, /forge-command-center\.js/);
  assert.match(script, /Start mic/);
  assert.match(script, /SpeechRecognition/);
  assert.match(script, /webkitSpeechRecognition/);
  assert.match(script, /ai\/draft/);
  assert.match(script, /original transcript/i);
});

test("voice command surface preserves author approval boundary", () => {
  assert.match(script, /candidate/);
  assert.match(script, /NOT been saved/);
  assert.match(script, /has NOT been saved as canon/);
});

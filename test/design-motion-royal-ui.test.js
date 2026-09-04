const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const read = (file) => readFileSync(join(root, file), 'utf8');

const html = read('public/forge-media-studio.html');
const js = read('public/forge-media-studio.js');
const css = read('public/forge-media-studio.css');
const pwa = read('public/forge-pwa.js');
const sw = read('public/sw.js');
const specialized = read('public/specialized-creation-api-state-sync.js');
const specializedRoyal = read('public/specialized-creation-royal.css');
const officeRoyal = read('public/forge-office-royal.css');
const officeRoyalJs = read('public/forge-office-royal.js');

test('Design & Motion exposes all six requested first-class offices', () => {
  for (const mode of ['calendar', 'advertisement', 'daily-planner', 'meme', 'gif', 'stop-motion']) {
    assert.match(html, new RegExp(`data-mode=["']${mode}["']`));
    assert.match(js, new RegExp(`(?:["']${mode}["']|${mode}:)`));
  }
});

test('Design & Motion uses real artifact paths rather than fake download placeholders', () => {
  assert.match(js, /GIF89a/);
  assert.match(js, /MediaRecorder/);
  assert.match(js, /captureStream/);
  assert.match(js, /canvas\.toBlob/);
  assert.match(js, /application\/json/);
  assert.doesNotMatch(js, /TODO[^\n]*(fake|mock)|placeholder artifact/i);
});

test('Design & Motion is integrated into installed Forge shell', () => {
  assert.match(pwa, /forge-media-studio\.html/);
  assert.match(sw, /forge-media-studio\.html/);
  assert.match(sw, /forge-media-studio\.js/);
  assert.match(sw, /forge-media-studio\.css/);
});

test('new creative surfaces use the approved royal marble light-dark system', () => {
  for (const source of [css, specializedRoyal, officeRoyal]) {
    assert.match(source, /gold|#b68a3f|#c49345/i);
    assert.match(source, /data-forge-theme=["\\]?dark|data-forge-theme\\?="dark"/i);
  }
  assert.match(specialized, /specialized-creation-royal\.css/);
  assert.match(specialized, /forge-theme/);
  assert.match(officeRoyalJs, /forge-theme/);
  assert.match(officeRoyalJs, /Switch to/);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('Design & Motion Offices expose all six requested real creation modes', () => {
  const html = fs.readFileSync('public/forge-media-studio.html', 'utf8');
  const source = fs.readFileSync('public/forge-media-studio.js', 'utf8');
  for (const mode of ['calendar', 'advertisement', 'daily-planner', 'meme', 'gif', 'stop-motion']) {
    assert.match(html, new RegExp(`data-mode="${mode}"`));
    assert.ok(source.includes(`${mode}:`) || source.includes(`"${mode}"`), `missing ${mode} runtime mode`);
  }
  assert.match(html, /Calendar Office/);
  assert.match(html, /Advertisement Office/);
  assert.match(html, /Daily Planner Office/);
  assert.match(html, /GIF Office/);
  assert.match(html, /Stop-Motion Video Office/);
});

test('media studio uses real canvas, GIF89a and MediaRecorder output instead of fake artifacts', () => {
  const source = fs.readFileSync('public/forge-media-studio.js', 'utf8');
  assert.match(source, /canvas\.toBlob/);
  assert.match(source, /GIF89a/);
  assert.match(source, /encodeGif89a/);
  assert.match(source, /lzwEncode/);
  assert.match(source, /new MediaRecorder/);
  assert.match(source, /captureStream/);
  assert.match(source, /MediaRecorder\.isTypeSupported/);
  assert.match(source, /Forge will not pretend a video was created/);
  assert.doesNotMatch(source, /fake[- ]?(gif|video|artifact)|placeholder[- ]?(gif|video|artifact)/i);
});

test('media studio persists only working-memory project state and protects oversized local image data', () => {
  const source = fs.readFileSync('public/forge-media-studio.js', 'utf8');
  assert.match(source, /\/api\/projects\/\$\{encodeURIComponent\(id\)\}\/memory/);
  assert.match(source, /class:\s*"creative-note"/);
  assert.match(source, /authority:\s*"working"/);
  assert.match(source, /forge-media-studio/);
  assert.match(source, /350000/);
  assert.match(source, /oversized local image/);
  assert.doesNotMatch(source, /authority:\s*"authoritative"/);
});

test('media studio keeps remote image export honest about CORS and device video capability', () => {
  const source = fs.readFileSync('public/forge-media-studio.js', 'utf8');
  assert.match(source, /crossOrigin = "anonymous"/);
  assert.match(source, /CORS permission/);
  assert.match(source, /browser reports no supported MediaRecorder video format/);
  assert.match(source, /Use GIF export instead/);
});

test('Design & Motion is a main Studio tool and remains available in the offline shell', () => {
  const pwa = fs.readFileSync('public/forge-pwa.js', 'utf8');
  const sw = fs.readFileSync('public/sw.js', 'utf8');
  assert.match(pwa, /function ensureMediaNavigation\(\)\{if\(!isMainStudio\(\)\)return;/);
  assert.match(pwa, /open-design-motion/);
  assert.match(pwa, /forge-media-studio\.html/);
  assert.match(pwa, /Design & Motion/);
  assert.match(pwa, /Main Studio tools/);
  assert.match(sw, /authors-forge-shell-v\d+/);
  assert.match(sw, /forge-media-studio\.html/);
  assert.match(sw, /forge-media-studio\.css/);
  assert.match(sw, /forge-media-studio\.js/);
  assert.match(sw, /forge-brand-studio\.js/);
});

test('Design & Motion client scripts parse as JavaScript', () => {
  const source = fs.readFileSync('public/forge-media-studio.js', 'utf8');
  assert.doesNotThrow(() => new vm.Script(source, { filename: 'forge-media-studio.js' }));
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('public/forge-media-studio.html', 'utf8');
const styles = fs.readFileSync('public/forge-media-studio.css', 'utf8');
const script = fs.readFileSync('public/forge-media-studio.js', 'utf8');

test('Design & Motion Offices expose all six requested real creation modes', () => {
  for (const id of ['image-editor','video-editor','animation-studio','card-designer','cover-designer','poster-designer']) assert.match(html, new RegExp(`data-tool="${id}"`));
  assert.match(html, /Image Editor/);
  assert.match(html, /Video Editor/);
  assert.match(html, /Animation Studio/);
  assert.match(html, /Card Designer/);
  assert.match(html, /Cover Designer/);
  assert.match(html, /Poster Designer/);
});

test('media studio uses real canvas, GIF89a and MediaRecorder output instead of fake artifacts', () => {
  assert.match(script, /canvas\.toBlob/);
  assert.match(script, /GIF89a/);
  assert.match(script, /MediaRecorder/);
  assert.match(script, /new Blob/);
  assert.match(script, /URL\.createObjectURL/);
});

test('media studio persists only working-memory project state and protects oversized local image data', () => {
  assert.match(script, /localStorage/);
  assert.match(script, /working-memory/i);
  assert.match(script, /MAX_LOCAL_IMAGE_BYTES/);
  assert.doesNotMatch(script, /fetch\([^)]*method:\s*["'](?:POST|PUT|PATCH|DELETE)/i);
});

test('media studio keeps remote image export honest about CORS and device video capability', () => {
  const source = fs.readFileSync('public/forge-media-studio.js', 'utf8');
  assert.match(source, /crossOrigin = "anonymous"/);
  assert.match(source, /CORS permission/);
  assert.match(source, /browser reports no supported MediaRecorder video format/);
  assert.match(source, /Use GIF export instead/);
});

test('Design & Motion Offices are wired into the royal PWA launcher and offline shell', () => {
  const pwa = fs.readFileSync('public/forge-pwa.js', 'utf8');
  const sw = fs.readFileSync('public/sw.js', 'utf8');
  assert.match(pwa, /open-design-motion/);
  assert.match(pwa, /forge-media-studio\.html/);
  assert.match(pwa, /Design & Motion Offices/);
  assert.match(sw, /authors-forge-shell-v22/);
  assert.match(sw, /forge-media-studio\.html/);
  assert.match(sw, /forge-media-studio\.css/);
  assert.match(sw, /forge-media-studio\.js/);
});

test('Design & Motion client scripts parse as JavaScript', () => {
  const source = fs.readFileSync('public/forge-media-studio.js', 'utf8');
  assert.doesNotThrow(() => new vm.Script(source, { filename: 'forge-media-studio.js' }));
});

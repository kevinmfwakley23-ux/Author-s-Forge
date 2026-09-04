const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('Specialized Creation activates the approved royal marble skin without replacing its real workplace', () => {
  const html = fs.readFileSync('public/specialized-creation.html', 'utf8');
  const sync = fs.readFileSync('public/specialized-creation-api-state-sync.js', 'utf8');
  const css = fs.readFileSync('public/specialized-creation-royal.css', 'utf8');

  assert.match(html, /specialized-creation-api-state-sync\.js/);
  assert.match(sync, /specialized-creation-royal\.css/);
  assert.match(sync, /dataset\.specializedRoyal/);
  assert.match(sync, /link\[data-specialized-royal\]/);
  assert.match(sync, /forge-theme/);
  assert.match(sync, /sc-royal-theme/);
  assert.match(sync, /window\.forgeSpecializedApi/);
  assert.match(sync, /state\.current=result/);
  assert.match(css, /Cinzel/);
  assert.match(css, /--sc-royal-gold/);
  assert.match(css, /data-forge-theme="dark"/);
  assert.match(css, /sc-canvas-wrap/);
  assert.match(css, /\.sc-card/);
});

test('Specialized Creation royal runtime remains valid JavaScript and preserves project-aware Main Studio navigation', () => {
  const source = fs.readFileSync('public/specialized-creation-api-state-sync.js', 'utf8');
  assert.doesNotThrow(() => new vm.Script(source, { filename: 'specialized-creation-api-state-sync.js' }));
  assert.match(source, /new URLSearchParams\(location\.search\)\.get\("project"\)/);
  assert.match(source, /main\.href=`\/\?project=/);
});

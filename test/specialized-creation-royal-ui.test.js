const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('Specialized Creation cannot inherit the main Studio white-marble skin', () => {
  const html = fs.readFileSync('public/specialized-creation.html', 'utf8');
  const sync = fs.readFileSync('public/specialized-creation-api-state-sync.js', 'utf8');
  const css = fs.readFileSync('public/specialized-creation-royal.css', 'utf8');

  assert.match(html, /specialized-creation-api-state-sync\.js/);
  assert.match(sync, /window\.forgeSpecializedApi/);
  assert.match(sync, /state\.current=result/);
  assert.match(css, /outside the main Author's Forge Studio release/);
  assert.match(css, /white-marble \/ black \/ gold royal shell is reserved for the main Studio/);
  assert.doesNotMatch(css, /linear-gradient|radial-gradient|--sc-royal-gold|Cinzel|sc-canvas-wrap/);
});

test('Specialized Creation runtime remains valid JavaScript and preserves project-aware navigation while UI is independent', () => {
  const source = fs.readFileSync('public/specialized-creation-api-state-sync.js', 'utf8');
  assert.doesNotThrow(() => new vm.Script(source, { filename: 'specialized-creation-api-state-sync.js' }));
  assert.match(source, /new URLSearchParams\(location\.search\)\.get\("project"\)/);
  assert.match(source, /main\.href=`\/\?project=/);
});

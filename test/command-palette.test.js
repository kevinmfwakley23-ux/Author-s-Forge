const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('authoring command palette provides keyboard-first access to every Studio workspace', () => {
  const source = fs.readFileSync('public/forge-command-center.js', 'utf8');
  for (const route of ['dashboard','manuscript','writing','architecture','characters','world','research','editing','voice','art','cover','marketing','publishing','genome','health','versions','settings','governance']) {
    assert.match(source, new RegExp(`['"]${route}['"]`));
  }
  assert.match(source, /Ctrl\/Cmd\+K toggle/);
  assert.match(source, /ArrowDown/);
  assert.match(source, /ArrowUp/);
  assert.match(source, /data-palette-index/);
  assert.match(source, /aria-label="Forge command palette"/);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const mainCompletion = fs.readFileSync('scripts/forge-main-completion.js', 'utf8');

test('main completion evidence inventory tracks every main Studio desktop browser acceptance gate', () => {
  const command = String(packageJson.scripts?.['test:browser'] || '');
  const harnesses = [...command.matchAll(/node\s+(scripts\/[A-Za-z0-9._/-]+-browser-acceptance\.js)/g)]
    .map((match) => match[1]);

  assert.ok(harnesses.length > 0, 'test:browser must execute at least one browser acceptance harness');
  assert.equal(new Set(harnesses).size, harnesses.length, 'test:browser must not execute duplicate browser acceptance harnesses');

  for (const harness of harnesses) {
    assert.match(
      mainCompletion,
      new RegExp(harness.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      `main completion evidence inventory must include ${harness}`,
    );
  }
});

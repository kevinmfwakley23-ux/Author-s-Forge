const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('Forge Agent Workbench is a real governed orchestration surface, not a draft shortcut', () => {
  const html = fs.readFileSync('public/forge-agent.html', 'utf8');
  const source = fs.readFileSync('public/forge-agent.js', 'utf8');

  assert.match(html, /Forge Agent Workbench/);
  assert.match(html, /Collaboration mode/);
  assert.match(html, /id="agent-book"/);
  assert.match(html, /id="agent-chapter"/);
  assert.match(html, /id="agent-scene"/);
  assert.match(html, /Every provider-backed or state-affecting step remains visible and requires a fresh author click/);

  for (const route of [
    '/collaboration',
    '/research/live',
    '/context',
    '/ai/architecture',
    '/ai/writing/generate',
    '/edit',
    '/export',
    '/memory',
  ]) assert.ok(source.includes(route), `missing real Forge route ${route}`);

  assert.doesNotMatch(source, /\/ai\/draft/);
  assert.doesNotMatch(source, /\/ai\/proposals\/[^`'"\s]+\/apply/);
  assert.doesNotMatch(source, /\/workspace\/books\/[^`'"\s]+\/chapters\/[^`'"\s]+\/scenes\/[^`'"\s]+\/content/);
  assert.match(source, /durable proposal ledger/i);
  assert.match(source, /Editor mode does not permit drafting/);
  assert.match(source, /Approve & run this step/);
  assert.match(source, /No additional step ran automatically/);
  assert.match(source, /working creative memory/);
  assert.match(source, /does not claim external publication or retailer acceptance/);
});

test('Agent Workbench is reachable from Studio and cached by the PWA shell', () => {
  const pwa = fs.readFileSync('public/forge-pwa.js', 'utf8');
  const sw = fs.readFileSync('public/sw.js', 'utf8');
  assert.match(pwa, /open-agent-workbench/);
  assert.match(pwa, /forge-agent\.html/);
  assert.match(sw, /authors-forge-shell-v17/);
  assert.match(sw, /forge-agent\.html/);
  assert.match(sw, /forge-agent\.js/);
});

test('Agent Workbench client script parses as JavaScript', () => {
  const source = fs.readFileSync('public/forge-agent.js', 'utf8');
  assert.doesNotThrow(() => new vm.Script(source, { filename: 'forge-agent.js' }));
});

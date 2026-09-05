const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('Forge Agent Workbench v3 plans from server discovery instead of a browser-local workflow planner', () => {
  const html = fs.readFileSync('public/forge-agent.html', 'utf8');
  const source = fs.readFileSync('public/forge-agent-v3.js', 'utf8');

  assert.match(html, /Forge Agent Workbench/);
  assert.match(html, /server planner/i);
  assert.match(html, /id="agent-book"/);
  assert.match(html, /id="agent-chapter"/);
  assert.match(html, /id="agent-scene"/);
  assert.match(html, /forge-agent-v3\.js/);
  assert.doesNotMatch(html, /src="\/forge-agent(?:-v2)?\.js"/);

  assert.match(source, /\/agent\/tools/);
  assert.match(source, /\/agent\/plan/);
  assert.match(source, /pathTemplate/);
  assert.match(source, /Server plan referenced undiscovered Forge tool/);
  assert.doesNotMatch(source, /function buildPlan\s*\(/);
  assert.doesNotMatch(source, /\/ai\/draft/);
  assert.doesNotMatch(source, /\/ai\/proposals\/[^`'"\s]+\/apply/);
  assert.doesNotMatch(source, /\/workspace\/books\/[^`'"\s]+\/chapters\/[^`'"\s]+\/scenes\/[^`'"\s]+\/content/);
});

test('Agent Workbench exposes all twelve registry-backed operation adapters without direct author-owned apply routes', () => {
  const source = fs.readFileSync('public/forge-agent-v3.js', 'utf8');
  for (const toolId of [
    'project.context',
    'research.live',
    'market.kdp.research',
    'architecture.generate',
    'story.chapter-cards.propose',
    'writing.propose',
    'editing.analyze',
    'cover.direction.propose',
    'visual.image.generate',
    'promotion.campaign.propose',
    'production.export',
    'memory.record-working',
  ]) assert.ok(source.includes(`"${toolId}"`), `missing Workbench execution adapter ${toolId}`);

  assert.match(source, /toolPath\(tool\)/);
  assert.match(source, /tool\.pathTemplate/);
  assert.match(source, /undiscovered Forge tool/i);
  assert.match(source, /bookId: book\?\.id, brief: goal/);
  assert.match(source, /"cover-art" : "illustration"/);
  assert.doesNotMatch(source, /proposal\.apply/);
});

test('AI-enhanced planning is opt-in, deterministic remains default, and fallback/provider truth is visible', () => {
  const html = fs.readFileSync('public/forge-agent.html', 'utf8');
  const source = fs.readFileSync('public/forge-agent-v3.js', 'utf8');
  assert.match(html, /id="agent-planner"/);
  assert.match(html, /Deterministic · free\/default/);
  assert.match(html, /AI-enhanced · routed model/);
  assert.match(html, /falls back visibly/i);
  assert.match(source, /plannerInput\?\.value \|\| "deterministic"/);
  assert.match(source, /plannerUsed === "ai"/);
  assert.match(source, /plannerProvider/);
  assert.match(source, /plannerModel/);
  assert.match(source, /deterministic-fallback/);
  assert.match(source, /plannerFallbackReason/);
});

test('Forge Recipes are a real no-code reusable workflow surface backed by the durable Recipe API', () => {
  const html = fs.readFileSync('public/forge-agent.html', 'utf8');
  const source = fs.readFileSync('public/forge-agent-v3.js', 'utf8');
  for (const id of ['agent-recipe-select', 'agent-recipe-name', 'agent-recipe-save', 'agent-recipe-compile', 'agent-recipe-delete']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(source, /\/agent\/recipes/);
  assert.match(source, /Saving durable Forge Recipe/);
  assert.match(source, /append-only tombstone/);
  assert.match(source, /Compile selected Recipe|compileRecipe/);
  assert.match(source, /memory\.record-working/);
});

test('bounded run groups execute only registry-approved read-only no-state-effect steps and stop on failure', () => {
  const source = fs.readFileSync('public/forge-agent-v3.js', 'utf8');
  assert.match(source, /eligibleForApprovedRunGroup/);
  assert.match(source, /Approve & run \$\{safe\.length\} safe read-only steps/);
  assert.match(source, /for \(const step of eligible\)/);
  assert.match(source, /Safe run group stopped at/);
  assert.match(source, /Proposal, artifact, provider-backed state changes, and memory steps still require individual approval/);
});

test('Agent Workbench exposes the existing real Forge AI resource, catalog, pinning and spend-policy controls', () => {
  const html = fs.readFileSync('public/forge-agent.html', 'utf8');
  const routing = fs.readFileSync('public/forge-agent-routing.js', 'utf8');
  assert.match(html, /forge-agent-routing\.js/);
  assert.match(routing, /\/ai\/control/);
  assert.match(routing, /\/ai\/catalog\?provider=/);
  assert.match(routing, /No paid tokens/);
  assert.match(routing, /Budgeted/);
  assert.match(routing, /Unrestricted/);
  assert.match(routing, /economy/);
  assert.match(routing, /balanced/);
  assert.match(routing, /quality/);
  assert.match(routing, /Pin selected model/);
  assert.match(routing, /Clear model pin/);
  for (const provider of ['omniroute', '9router', 'kings', 'ollama', 'groq', 'mistral', 'gemini', 'anthropic', 'openrouter', 'openai']) {
    assert.ok(routing.includes(`"${provider}"`), `missing Agent provider option ${provider}`);
  }
  assert.doesNotMatch(routing, /api[_-]?key/i, 'Agent routing UI must never expose or request provider secrets');
  assert.doesNotThrow(() => new vm.Script(routing, { filename: 'forge-agent-routing.js' }));
});

test('Agent Workbench v3 is reachable from Studio and cached by the PWA shell', () => {
  const pwa = fs.readFileSync('public/forge-pwa.js', 'utf8');
  const sw = fs.readFileSync('public/sw.js', 'utf8');
  assert.match(pwa, /open-agent-workbench/);
  assert.match(pwa, /forge-agent\.html/);
  assert.match(sw, /const CACHE = "authors-forge-shell-v\d+"/);
  assert.match(sw, /forge-agent\.html/);
  assert.match(sw, /forge-agent-v3\.js/);
  assert.match(sw, /forge-agent-routing\.js/);
  assert.doesNotMatch(sw, /"\/forge-agent(?:-v2)?\.js"/);
});

test('Agent Workbench v3 client script parses as JavaScript', () => {
  const source = fs.readFileSync('public/forge-agent-v3.js', 'utf8');
  assert.doesNotThrow(() => new vm.Script(source, { filename: 'forge-agent-v3.js' }));
});
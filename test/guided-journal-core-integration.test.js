const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");
const read = (file) => readFileSync(join(root, file), "utf8");

test("normal Forge launcher treats Studio and Guided Journal as core services", () => {
  const source = read("scripts/start-forge.js");
  assert.match(source, /coreServiceIds\s*=\s*new Set\(\["studio",\s*"journal"\]\)/);
  assert.match(source, /allServices\.filter\(\(service\) => coreServiceIds\.has\(service\.id\)\)/);
  assert.doesNotMatch(source, /only\s*=.*"studio"/);
});

test("hosted Forge gateway exposes Guided Journal in core mode", () => {
  const source = read("scripts/start-forge-web.js");
  assert.match(source, /coreServiceIds\s*=\s*new Set\(\["studio",\s*"journal"\]\)/);
  assert.match(source, /mode:\s*allRequested\s*\?\s*"all-offices"\s*:\s*"forge-core"/);
  assert.match(source, /Guided Journal \/journal\/ are attached/);
});

test("Forge core release gates require Guided Journal implementation and acceptance", () => {
  const baseline = read("scripts/forge-main-baseline-check.js");
  const completion = read("scripts/forge-main-completion.js");
  const pkg = JSON.parse(read("package.json"));
  const mainTests = read("scripts/run-main-tests.js");

  assert.match(baseline, /dist\/guided-journal-server\.js/);
  assert.match(completion, /Guided Journal core office/);
  assert.match(completion, /scripts\/guided-journal-browser-acceptance\.js/);
  assert.match(pkg.scripts["test:browser"], /guided-journal-browser-acceptance\.js/);
  assert.doesNotMatch(pkg.scripts["test:browser:offices"], /guided-journal-browser-acceptance\.js/);
  assert.doesNotMatch(mainTests, /\/guided-journal\/i/);
});

test("Guided Journal keeps shared Forge AI boundary and does not import standalone brain runtime", () => {
  const intelligence = read("src/application/guided-journal-intelligence.ts");
  const server = read("src/guided-journal-server.ts");
  assert.match(intelligence, /generateProjectText/);
  assert.match(intelligence, /Shared-trunk integration boundary/);
  assert.doesNotMatch(server, /guided-journal-ai-router/);
  assert.doesNotMatch(server, /guided-journal-brain/);
});

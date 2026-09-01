const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");

const recovery = readFileSync("public/forge-recovery.js", "utf8");
const workbench = readFileSync("public/forge-workbench.js", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

test("Versions workbench loads the dedicated project recovery client", () => {
  assert.match(workbench, /forge-recovery\.js/);
  assert.match(workbench, /ensureRecoveryClient/);
});

test("recovery client requires deliberate author acknowledgement and uses only the governed restore route", () => {
  assert.match(recovery, /restore-project-file/);
  assert.match(recovery, /restore-project-confirm/);
  assert.match(recovery, /Acknowledge the recovery warning/);
  assert.match(recovery, /window\.confirm/);
  assert.match(recovery, /projectUrl\('\/package\/restore'\)/);
  assert.match(recovery, /authorApproved:\s*true/);
  assert.doesNotMatch(recovery, /FileProjectStore|writeFile|localStorage\.setItem\([^)]*projectState/);
});

test("recovery client preserves the server-generated rollback package as a real download", () => {
  assert.match(recovery, /result\.rollbackPackage/);
  assert.match(recovery, /downloadJson\(result\.rollbackPackage/);
  assert.match(recovery, /forge-rollback/);
  assert.match(recovery, /file\.text\(\)/);
});

test("real recovery browser acceptance is part of the canonical desktop browser gate", () => {
  assert.match(pkg.scripts["test:browser"], /studio-recovery-browser-acceptance\.js/);
});

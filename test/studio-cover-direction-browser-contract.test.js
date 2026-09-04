const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const acceptance = readFileSync("scripts/studio-cover-direction-browser-acceptance.js", "utf8");
const ci = readFileSync(".github/workflows/ci.yml", "utf8");

test("cover direction browser acceptance remains in the canonical browser gate", () => {
  assert.match(pkg.scripts["test:browser"], /studio-cover-direction-browser-acceptance\.js/);
  assert.match(ci, /node --check scripts\/studio-cover-direction-browser-acceptance\.js/);
});

test("cover direction browser acceptance proves author review and single cover-plan ownership", () => {
  assert.match(acceptance, /agent\/cover-direction/);
  assert.match(acceptance, /cover-agent-apply/);
  assert.match(acceptance, /coverPlanRequests, 1/);
  assert.match(acceptance, /project\.bookCoverPlans\.length, 1/);
  assert.match(acceptance, /productionMemories\.length, 1/);
  assert.match(acceptance, /approvalStatus, "draft"/);
});

const test = require("node:test");
const assert = require("node:assert/strict");
const { estimateTokens, optimizeContext } = require("../.forge-build/application/context-optimizer.js");

test("context optimizer reports deterministic token savings", () => {
  const result = optimizeContext({
    system: "System rules.\n\n\nSystem rules.\n",
    user: "Write the scene.\n\n\nWrite the scene.\n\nKeep the character canon intact.",
  });
  assert.equal(result.changed, true);
  assert.ok(result.tokensSaved > 0);
  assert.ok(result.optimizedEstimatedTokens < result.originalEstimatedTokens);
  assert.ok(result.strategy.includes("whitespace-compaction"));
});

test("context optimizer never inflates a request", () => {
  const system = "short";
  const user = "text";
  const result = optimizeContext({ system, user });
  assert.equal(result.tokensSaved, 0);
  assert.equal(result.changed, false);
  assert.equal(result.system, system);
  assert.equal(result.user, user);
});

test("token estimate is deterministic and never returns fractional values", () => {
  assert.equal(estimateTokens(""), 0);
  assert.equal(estimateTokens("1234"), 1);
  assert.equal(Number.isInteger(estimateTokens("a longer request")), true);
});

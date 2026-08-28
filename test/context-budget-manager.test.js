const test = require("node:test");
const assert = require("node:assert/strict");
const { selectContextBudget } = require("../.forge-build/application/context-budget-manager.js");

test("context budget keeps critical sections and fills remaining budget by priority", () => {
  const result = selectContextBudget([
    { id: "canon", content: "The canon rule must always remain true.", priority: "critical", order: 0 },
    { id: "scene", content: "Current scene details that are useful.", priority: "high", order: 1 },
    { id: "research", content: "A large research section that can be omitted when budget is tight.", priority: "normal", order: 2 },
    { id: "history", content: "Older context that is optional.", priority: "optional", order: 3 },
  ], 20);

  assert.equal(result.constrained, true);
  assert.ok(result.includedIds.includes("canon"));
  assert.ok(result.omittedIds.length > 0);
  assert.ok(result.tokensSaved > 0);
  assert.ok(result.sections.every((section) => result.includedIds.includes(section.id)));
});

test("context budget does not silently drop critical sections", () => {
  const result = selectContextBudget([
    { id: "canon", content: "This is a critical canon statement that is larger than the budget.", priority: "critical", order: 0 },
    { id: "optional", content: "Optional context.", priority: "optional", order: 1 },
  ], 2);

  assert.deepEqual(result.includedIds, ["canon"]);
  assert.deepEqual(result.omittedIds, ["optional"]);
  assert.ok(result.selectedEstimatedTokens > result.budget);
});

test("context budget preserves original section order in the returned selection", () => {
  const result = selectContextBudget([
    { id: "optional", content: "Optional.", priority: "optional", order: 2 },
    { id: "critical", content: "Critical.", priority: "critical", order: 0 },
    { id: "high", content: "High priority.", priority: "high", order: 1 },
  ], 100);

  assert.deepEqual(result.includedIds, ["optional", "critical", "high"]);
});

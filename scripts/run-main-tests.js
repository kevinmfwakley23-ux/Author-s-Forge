#!/usr/bin/env node
const { readdirSync } = require("node:fs");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");

const root = join(__dirname, "..");
const testDir = join(root, "test");
const optionalOfficePatterns = [
  /guided-journal/i,
  /educational-/i,
  /specialized-/i,
  /nft-/i,
  /design-motion/i,
  /forge-offices/i,
];

const tests = readdirSync(testDir)
  .filter((name) => name.endsWith(".test.js"))
  .filter((name) => !optionalOfficePatterns.some((pattern) => pattern.test(name)))
  .sort()
  .map((name) => join("test", name));

if (!tests.length) {
  console.error("[Forge main tests] No main Studio tests were discovered.");
  process.exit(1);
}

console.log(`[Forge main tests] Running ${tests.length} main Studio test files.`);
const result = spawnSync(process.execPath, ["--test", ...tests], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});

if (result.error) {
  console.error(`[Forge main tests] Could not launch Node test runner: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);

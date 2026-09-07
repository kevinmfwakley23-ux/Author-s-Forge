#!/usr/bin/env node
const { readdirSync } = require("node:fs");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");

const root = join(__dirname, "..");
const testDir = join(root, "test");
const separateOfficePatterns = [
  /educational-/i,
  /specialized-/i,
  /nft-/i,
  /design-motion/i,
  /forge-offices/i,
];

const tests = readdirSync(testDir)
  .filter((name) => name.endsWith(".test.js"))
  .filter((name) => !separateOfficePatterns.some((pattern) => pattern.test(name)))
  .sort()
  .map((name) => join("test", name));

if (!tests.length) {
  console.error("[Forge core tests] No Studio/Guided Journal tests were discovered.");
  process.exit(1);
}

console.log(`[Forge core tests] Running ${tests.length} Studio + Guided Journal test files.`);
const result = spawnSync(process.execPath, ["--test", ...tests], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});

if (result.error) {
  console.error(`[Forge core tests] Could not launch Node test runner: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);

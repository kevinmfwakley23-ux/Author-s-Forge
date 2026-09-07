#!/usr/bin/env node
const { spawnSync } = require("node:child_process");

const script = process.argv[2];
if (!script) {
  console.error("Usage: node scripts/run-with-optional-offices.js <script> [...args]");
  process.exit(2);
}
const result = spawnSync(process.execPath, [script, ...process.argv.slice(3)], {
  env: { ...process.env, FORGE_ENABLE_OPTIONAL_OFFICES: "1" },
  stdio: "inherit",
});
if (result.error) {
  console.error(result.error.stack || result.error);
  process.exit(1);
}
process.exit(result.status ?? 1);

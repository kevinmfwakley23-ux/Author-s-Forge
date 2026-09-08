const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

test("Creative Agent Runtime V4 passes the real Studio API observation/replan acceptance", () => {
  const result = spawnSync(process.execPath, ["scripts/studio-agent-runtime-api-acceptance.js"], {
    cwd: root,
    env: process.env,
    encoding: "utf8",
    timeout: 45000,
  });
  assert.equal(result.error, undefined, result.error?.stack || result.error?.message);
  assert.equal(result.status, 0, `Agent Runtime V4 API acceptance failed.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  assert.match(result.stdout, /FORGE AGENT RUNTIME V4 API ACCEPTANCE PASSED/);
});

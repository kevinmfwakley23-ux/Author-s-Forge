const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const { join } = require("node:path");
const test = require("node:test");

test("release bundle requires a main-history commit and strongest Forge verification before packaging", async () => {
  const workflow = await readFile(join(__dirname, "..", ".github", "workflows", "release-bundle.yml"), "utf8");

  assert.match(workflow, /fetch-depth:\s*0/);
  assert.match(workflow, /git fetch origin main --no-tags/);
  assert.match(workflow, /git merge-base --is-ancestor \"\$GITHUB_SHA\" origin\/main/);
  assert.match(workflow, /npx playwright install --with-deps chromium/);
  assert.match(workflow, /run: npm run verify/);

  const verifyIndex = workflow.indexOf("run: npm run verify");
  const assembleIndex = workflow.indexOf("name: Assemble Android/Chromebook portable bundle");
  const uploadIndex = workflow.indexOf("name: Upload portable bundle");
  assert.ok(verifyIndex >= 0 && assembleIndex > verifyIndex, "release assembly must happen after exact-ref verification");
  assert.ok(uploadIndex > assembleIndex, "release upload must happen after bundle assembly");

  assert.match(workflow, /sha256sum \"authors-forge-\$\{GITHUB_SHA::12\}\.tar\.gz\"/);
  assert.match(workflow, /if-no-files-found: error/);
});

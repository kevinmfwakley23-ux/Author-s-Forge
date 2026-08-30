import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Writing Desk loads the governed AI proposal UI", async () => {
  const html = await readFile("public/index.html", "utf8");
  const script = await readFile("public/forge-ai-proposals.js", "utf8");
  assert.match(html, /id="ai-proposals"/);
  assert.match(html, /src="\/forge-ai-proposals\.js"/);
  assert.match(script, /\/ai\/writing\/generate/);
  assert.match(script, /\/ai\/proposals\/\$\{encodeURIComponent\(proposalId\)\}\/review/);
  assert.match(script, /\/ai\/proposals\/\$\{encodeURIComponent\(proposalId\)\}\/apply/);
  assert.match(script, /stale/);
  assert.match(script, /deterministicDiff/);
  assert.match(script, /Proposal Review Diff/);
  assert.match(script, /Line-level review/);
  assert.match(script, /addedLines/);
  assert.match(script, /removedLines/);
});

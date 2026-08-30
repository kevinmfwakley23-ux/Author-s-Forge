import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Writing Desk exposes the governed durable AI proposal workflow", async () => {
  const html = await readFile("public/index.html", "utf8");
  const script = await readFile("public/forge-ai-proposals.js", "utf8");
  assert.match(html, /id="ai-proposals"/);
  assert.match(html, /href="\/manifest\.webmanifest"/);
  assert.match(script, /\/ai\/writing\/generate/);
  assert.match(script, /\/ai\/proposals\/\$\{encodeURIComponent\(proposalId\)\}\/review/);
  assert.match(script, /\/ai\/proposals\/\$\{encodeURIComponent\(proposalId\)\}\/apply/);
  assert.match(script, /Source-revision binding active/);
  assert.match(script, /stale-write protection/);
  assert.match(script, /deterministicDiff/);
  assert.match(script, /Proposal Review Diff/);
  assert.match(script, /Line-level review/);
  assert.match(script, /addedLines/);
  assert.match(script, /removedLines/);
  assert.match(script, /forge-editing-proposals\.js/);
});

test("Editing Room is wired into the live shell and service worker", async () => {
  const html = await readFile("public/index.html", "utf8");
  const sw = await readFile("public/sw.js", "utf8");
  assert.match(html, /id="editing"/);
  assert.match(sw, /forge-editing-proposals\.js/);
  assert.match(sw, /authors-forge-shell-v4/);
});

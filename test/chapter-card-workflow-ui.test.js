import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Main Studio replaces legacy full-book direct-write behavior with the approved Chapter Card workflow", async () => {
  const workflow = await readFile("public/forge-chapter-card-workflow.js", "utf8");
  const approval = await readFile("public/forge-chapter-card-approval.js", "utf8");
  const pwa = await readFile("public/forge-pwa.js", "utf8");
  const sw = await readFile("public/sw.js", "utf8");

  assert.match(workflow, /story-map\/chapter-card-workflow\/generate/);
  assert.match(workflow, /story-map\/chapter-card-workflow\/candidates\/.*approve/);
  assert.match(workflow, /\/ai\/writing/);
  assert.match(workflow, /task:\s*"draft"/);
  assert.match(workflow, /stopImmediatePropagation\(\)/, "The workflow must intercept the legacy #book-run shortcut before its old direct-write listener runs.");
  assert.match(workflow, /Existing prose.*preserved|existing prose.*preserved/i);
  assert.doesNotMatch(workflow, /\/content[`'"]/i, "Whole-book Chapter Card drafting must not write provider output directly to scene content.");
  assert.doesNotMatch(workflow, /method:\s*["']PUT["']/i, "Whole-book Chapter Card drafting must stay on the proposal boundary.");

  assert.match(approval, /Approve Current Card/);
  assert.match(approval, /authorApproved:\s*true/);
  assert.match(approval, /chapter-card-workflow\/chapters/);

  assert.match(pwa, /forge-chapter-card-workflow\.js/);
  assert.match(pwa, /forge-chapter-card-approval\.js/);
  assert.match(sw, /forge-chapter-card-workflow\.js/);
  assert.match(sw, /forge-chapter-card-approval\.js/);
});

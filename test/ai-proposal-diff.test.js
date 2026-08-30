import test from "node:test";
import assert from "node:assert/strict";
import { createAiProposalDiff } from "../dist/index.js";

test("AI proposal diff binds base and proposed content and reports changes", () => {
  const diff = createAiProposalDiff("One line.\nKeep this.", "One line.\nChanged this.");
  assert.equal(diff.formatVersion, 1);
  assert.equal(diff.changed, true);
  assert.equal(diff.baseWords, 4);
  assert.equal(diff.proposedWords, 4);
  assert.equal(diff.addedLines, 1);
  assert.equal(diff.removedLines, 1);
  assert.equal(diff.unchangedLines, 1);
  assert.match(diff.baseSha256, /^[a-f0-9]{64}$/);
  assert.match(diff.proposedSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(diff.lines.map((line) => line.kind), ["unchanged", "removed", "added"]);
});

test("AI proposal diff is deterministic and preserves line numbers", () => {
  const input = "Alpha\nBeta\nGamma";
  const diff = createAiProposalDiff(input, input);
  assert.equal(diff.changed, false);
  assert.equal(diff.addedLines, 0);
  assert.equal(diff.removedLines, 0);
  assert.equal(diff.unchangedLines, 3);
  assert.deepEqual(diff.lines.map((line) => [line.lineNumber, line.proposedLineNumber]), [[1, 1], [2, 2], [3, 3]]);
});

test("AI proposal diff normalizes line endings for review while preserving content hashes", () => {
  const diff = createAiProposalDiff("A\r\nB", "A\nB");
  assert.equal(diff.changed, true);
  assert.deepEqual(diff.lines.map((line) => line.kind), ["unchanged", "unchanged"]);
  assert.equal(diff.addedLines, 0);
  assert.equal(diff.removedLines, 0);
});

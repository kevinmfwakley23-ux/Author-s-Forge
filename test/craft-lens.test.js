import test from "node:test";
import assert from "node:assert/strict";
import { analyzeCraft } from "../dist/domain/craft-lens.js";

test("craft lens detects long sentences and possible passive voice without changing prose", () => {
  const text = "The door was opened by Marcus while he walked slowly into the room and looked around at the walls that had been painted years before, wondering whether the old photographs still remained where Lena had left them because nobody had touched them since the house was abandoned. Marcus looked at the clock. Lena waited.";
  const report = analyzeCraft(text);
  assert.equal(report.wordCount > 0, true);
  assert.equal(report.sentenceCount, 3);
  assert.equal(report.findings.some((finding) => finding.dimension === "clarity"), true);
  assert.equal(report.findings.some((finding) => finding.id === "clarity-passive"), true);
  assert.equal(report.findings.every((finding) => Array.isArray(finding.suggestions) && finding.suggestions.length > 0), true);
});

test("craft lens is deterministic for empty input", () => {
  assert.deepEqual(analyzeCraft(""), { formatVersion: 1, wordCount: 0, sentenceCount: 0, findings: [] });
});

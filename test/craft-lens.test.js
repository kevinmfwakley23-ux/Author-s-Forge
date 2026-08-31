import test from "node:test";
import assert from "node:assert/strict";
import { analyzeCraft, createCraftLensProposalEvidence, validateCraftLensProposalEvidence } from "../dist/domain/craft-lens.js";

test("craft lens detects long sentences and possible passive voice without changing prose", () => {
  const text = "The door was opened by Marcus while he walked slowly into the room and looked around at the walls that had been painted years before, wondering whether the old photographs still remained where Lena had left them because nobody had touched them since the house was abandoned. Marcus looked at the clock. Lena waited.";
  const report = analyzeCraft(text);
  assert.equal(report.wordCount > 0, true);
  assert.equal(report.sentenceCount, 3);
  assert.equal(report.findings.some((finding) => finding.dimension === "clarity"), true);
  assert.equal(report.findings.some((finding) => finding.id === "clarity-passive"), true);
  assert.equal(report.findings.every((finding) => Array.isArray(finding.suggestions) && finding.suggestions.length > 0), true);
});

test("craft lens proposal evidence binds an exact finding, strategy, source hash, and analysis time", () => {
  const text = "The door was opened by Marcus while he walked slowly into the room and looked around at the walls that had been painted years before, wondering whether the old photographs still remained where Lena had left them because nobody had touched them since the house was abandoned. Marcus looked at the clock. Lena waited.";
  const report = analyzeCraft(text);
  const finding = report.findings.find((item) => item.id === "clarity-long-sentences");
  assert.ok(finding);
  const sourceContentSha256 = "a".repeat(64);
  const evidence = createCraftLensProposalEvidence({
    report,
    findingId: finding.id,
    selectedSuggestion: finding.suggestions[0],
    sourceContentSha256,
    analyzedAt: "2026-08-31T05:00:00.000Z",
  });
  assert.equal(evidence.findingId, finding.id);
  assert.equal(evidence.dimension, finding.dimension);
  assert.equal(evidence.selectedSuggestion, finding.suggestions[0]);
  assert.equal(evidence.sourceContentSha256, sourceContentSha256);
  assert.deepEqual(validateCraftLensProposalEvidence(evidence), evidence);
});

test("craft lens evidence rejects strategies that were not offered by the selected finding", () => {
  const text = "The door was opened by Marcus while he walked slowly into the room and looked around at the walls that had been painted years before, wondering whether the old photographs still remained where Lena had left them because nobody had touched them since the house was abandoned. Marcus looked at the clock. Lena waited.";
  const report = analyzeCraft(text);
  assert.throws(() => createCraftLensProposalEvidence({
    report,
    findingId: "clarity-long-sentences",
    selectedSuggestion: "Rewrite the whole scene in a different voice.",
    sourceContentSha256: "b".repeat(64),
  }), /not an available suggestion/);
});

test("craft lens evidence rejects malformed source hashes and timestamps", () => {
  const text = "The door was opened by Marcus while he walked slowly into the room and looked around at the walls that had been painted years before, wondering whether the old photographs still remained where Lena had left them because nobody had touched them since the house was abandoned. Marcus looked at the clock. Lena waited.";
  const report = analyzeCraft(text);
  const finding = report.findings.find((item) => item.id === "clarity-long-sentences");
  assert.ok(finding);
  assert.throws(() => createCraftLensProposalEvidence({ report, findingId: finding.id, selectedSuggestion: finding.suggestions[0], sourceContentSha256: "not-a-hash" }), /source content hash is invalid/);
  assert.throws(() => validateCraftLensProposalEvidence({
    formatVersion: 1,
    findingId: finding.id,
    dimension: finding.dimension,
    severity: finding.severity,
    message: finding.message,
    evidence: finding.evidence,
    selectedSuggestion: finding.suggestions[0],
    reportWordCount: report.wordCount,
    reportSentenceCount: report.sentenceCount,
    sourceContentSha256: "c".repeat(64),
    analyzedAt: "not-a-date",
  }), /analysis timestamp is invalid/);
});

test("craft lens is deterministic for empty input", () => {
  assert.deepEqual(analyzeCraft(""), { formatVersion: 1, wordCount: 0, sentenceCount: 0, findings: [] });
});

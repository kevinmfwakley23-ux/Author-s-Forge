import test from "node:test";
import assert from "node:assert/strict";
import { AiProposalStore, createAiProposalDiff } from "../dist/index.js";

test("proposal review creates an append-only attributable audit entry", () => {
  const store = new AiProposalStore();
  store.propose({ id: "p-audit", projectId: "book-1", kind: "memory", title: "Candidate fact", rationale: "Observed in source", proposedContent: "The key is brass.", sourceMemoryIds: ["m1"], now: "2026-08-30T02:00:00.000Z" });
  store.review("p-audit", "accepted", "author", "Confirmed", "2026-08-30T02:01:00.000Z");
  const audit = store.audit("book-1");
  assert.equal(audit.length, 1);
  assert.equal(audit[0].reviewer, "author");
  assert.equal(audit[0].sequence, 1);
  assert.equal(audit[0].note, "Confirmed");
});

test("proposal diff is deterministic and preserves line provenance", () => {
  const diff = createAiProposalDiff("one\ntwo\nthree", "one\ntwo revised\nthree\nfour");
  assert.equal(diff.changed, true);
  assert.equal(diff.addedLines, 2);
  assert.equal(diff.removedLines, 1);
  assert.equal(diff.unchangedLines, 2);
  assert.deepEqual(diff.lines[0], { kind: "unchanged", text: "one", lineNumber: 1, proposedLineNumber: 1 });
});

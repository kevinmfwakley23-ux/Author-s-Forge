import test from "node:test";
import assert from "node:assert/strict";
import { AiProposalStore } from "../dist/application/ai-proposal-store.js";

test("AI proposals remain pending until the author reviews them", () => {
  const store = new AiProposalStore();
  const proposal = store.propose({ id: "p1", projectId: "book-1", kind: "manuscript-edit", title: "Tighten scene", rationale: "Reduce repetition", proposedContent: "Revised scene text", sourceMemoryIds: ["m1", "m1"], now: "2026-08-30T00:00:00.000Z" });
  assert.equal(proposal.status, "pending");
  assert.deepEqual(proposal.sourceMemoryIds, ["m1"]);
  assert.equal(store.pending("book-1").length, 1);
});

test("system cannot accept an AI proposal", () => {
  const store = new AiProposalStore();
  store.propose({ id: "p2", projectId: "book-1", kind: "memory", title: "Canon candidate", rationale: "Observed in draft", proposedContent: "The character owns the key.", sourceMemoryIds: [] });
  assert.throws(() => store.review("p2", "accepted", "system"), /require author review/);
});

test("author acceptance is explicit and one-shot", () => {
  const store = new AiProposalStore();
  store.propose({ id: "p3", projectId: "book-1", kind: "continuity-finding", title: "Continuity issue", rationale: "Timeline conflict", proposedContent: "Move scene to Tuesday.", sourceMemoryIds: ["m2"] });
  const decision = store.review("p3", "accepted", "author", "Confirmed by author", "2026-08-30T01:00:00.000Z");
  assert.equal(decision.to, "accepted");
  assert.equal(store.get("p3")?.status, "accepted");
  assert.throws(() => store.review("p3", "rejected", "author"), /already been reviewed/);
});

test("Craft Lens proposal evidence must match the exact proposal source revision", () => {
  const store = new AiProposalStore();
  const sourceHash = "a".repeat(64);
  const otherHash = "b".repeat(64);
  const craftLensEvidence = {
    formatVersion: 1,
    findingId: "clarity-long-sentences",
    dimension: "clarity",
    severity: "watch",
    message: "1 sentence exceeds 35 words.",
    evidence: "A deliberately long sentence.",
    selectedSuggestion: "Split at a natural beat.",
    reportWordCount: 42,
    reportSentenceCount: 2,
    sourceContentSha256: otherHash,
    analyzedAt: "2026-08-31T05:00:00.000Z",
  };
  assert.throws(() => store.propose({
    id: "craft-mismatch",
    projectId: "book-1",
    kind: "manuscript-edit",
    title: "Craft proposal",
    rationale: "Review sentence length.",
    proposedContent: "Revised scene text.",
    sourceMemoryIds: [],
    baseContentSha256: sourceHash,
    craftLensEvidence,
  }), /does not match the proposal source revision/);

  const restored = new AiProposalStore();
  assert.throws(() => restored.restore([{
    id: "craft-restore-mismatch",
    projectId: "book-1",
    kind: "manuscript-edit",
    status: "pending",
    title: "Craft proposal",
    rationale: "Review sentence length.",
    proposedContent: "Revised scene text.",
    sourceMemoryIds: [],
    createdAt: "2026-08-31T05:00:00.000Z",
    baseContentSha256: sourceHash,
    craftLensEvidence,
  }]), /does not match the proposal source revision/);
});

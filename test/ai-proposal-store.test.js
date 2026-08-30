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

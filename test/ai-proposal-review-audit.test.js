const test = require("node:test");
const assert = require("node:assert/strict");
const { AiProposalStore } = require("../dist/application/ai-proposal-store.js");

function proposal(id, projectId) {
  return {
    id,
    projectId,
    kind: "memory",
    title: `Proposal ${id}`,
    rationale: "Audit contract test.",
    proposedContent: `Content for ${id}`,
    sourceMemoryIds: [],
    now: "2026-09-08T18:00:00.000Z",
  };
}

test("author proposal decisions append immutable sequence evidence and can be filtered by project", () => {
  const store = new AiProposalStore();
  store.propose(proposal("a-1", "project-a"));
  store.propose(proposal("b-1", "project-b"));

  store.review("a-1", "accepted", "author", "Keep it.", "2026-09-08T18:01:00.000Z");
  store.review("b-1", "rejected", "author", "Wrong direction.", "2026-09-08T18:02:00.000Z");

  assert.deepEqual(store.audit().map((entry) => entry.sequence), [1, 2]);
  assert.deepEqual(store.audit("project-a"), [{
    proposalId: "a-1",
    from: "pending",
    to: "accepted",
    reviewer: "author",
    note: "Keep it.",
    reviewedAt: "2026-09-08T18:01:00.000Z",
    sequence: 1,
  }]);

  const returned = store.audit();
  returned[0].note = "tampered outside store";
  assert.equal(store.audit()[0].note, "Keep it.");
  assert.throws(() => store.review("a-1", "rejected", "author"), /already been reviewed/);
});

test("system review cannot create durable author decision evidence", () => {
  const store = new AiProposalStore();
  store.propose(proposal("author-only", "project-a"));
  assert.throws(
    () => store.review("author-only", "accepted", "system", "pretend approval"),
    /require author review/i,
  );
  assert.equal(store.get("author-only").status, "pending");
  assert.deepEqual(store.audit(), []);
});

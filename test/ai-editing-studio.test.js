import test from "node:test";
import assert from "node:assert/strict";
import { AiProposalStore } from "../src/application/ai-proposal-store.js";
import { AiEditingStudioService } from "../src/application/ai-editing-studio.js";

function makeStore() {
  const records = new Map();
  return new AiProposalStore(
    records,
    (id) => records.get(id),
    (proposal) => records.set(proposal.id, proposal),
  );
}

test("Studio editing boundary persists a governed manuscript-edit proposal", async () => {
  const store = makeStore();
  const service = new AiEditingStudioService(store, async () => ({ provider: "test", model: "editor-test", text: "Revised scene." }));
  const proposal = await service.propose({
    projectId: "project-1",
    bookId: "book-1",
    chapterId: "chapter-1",
    sceneId: "scene-1",
    sourceContent: "Original scene with a weak opening.",
    findingMessage: "The opening lacks immediate tension.",
    recommendation: "Start closer to the inciting event.",
    findingStart: 0,
    findingEnd: 14,
    proposalId: "proposal-edit-1",
    now: "2026-08-30T00:00:00.000Z",
  });

  assert.equal(proposal.kind, "manuscript-edit");
  assert.equal(proposal.status, "pending");
  assert.equal(proposal.target.sceneId, "scene-1");
  assert.equal(proposal.proposedContent, "Revised scene.");
  assert.match(proposal.baseContentSha256, /^[a-f0-9]{64}$/);
  assert.equal((await store.load()).get("proposal-edit-1")?.id, "proposal-edit-1");
});

test("Studio editing boundary rejects an invalid finding range before provider work", async () => {
  const store = makeStore();
  let calls = 0;
  const service = new AiEditingStudioService(store, async () => {
    calls += 1;
    return { provider: "test", model: "editor-test", text: "Should not run." };
  });

  await assert.rejects(
    () => service.propose({
      projectId: "project-1",
      bookId: "book-1",
      chapterId: "chapter-1",
      sceneId: "scene-1",
      sourceContent: "Short source.",
      findingMessage: "Finding",
      recommendation: "Recommendation",
      findingStart: 0,
      findingEnd: 999,
      proposalId: "proposal-edit-invalid",
    }),
    /finding range is invalid/,
  );
  assert.equal(calls, 0);
});

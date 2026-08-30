import test from "node:test";
import assert from "node:assert/strict";
import { AiProposalStore } from "../dist/application/ai-proposal-store.js";
import { AiEditingProposalService, sha256EditingContent } from "../dist/application/ai-editing-proposals.js";

test("AI editing turns a deterministic finding into a source-bound durable proposal", async () => {
  const source = "The detective walked slowly down the empty hallway.";
  const store = new AiProposalStore();
  const service = new AiEditingProposalService(store, async () => ({ provider: "test", model: "fixture", text: "The detective moved down the empty hallway, listening for the first sign of danger." }));
  const proposal = await service.proposeRewrite({ projectId: "p1", bookId: "b1", chapterId: "c1", sceneId: "s1", sourceContent: source, findingMessage: "The sentence has repetitive pacing.", recommendation: "Vary cadence while preserving the scene's meaning.", findingStart: 0, findingEnd: source.length, proposalId: "edit-1" });
  assert.equal(proposal.status, "pending");
  assert.equal(proposal.kind, "manuscript-edit");
  assert.deepEqual(proposal.target, { bookId: "b1", chapterId: "c1", sceneId: "s1" });
  assert.equal(proposal.baseContentSha256, sha256EditingContent(source));
});

test("AI editing refuses malformed finding ranges before provider execution", async () => {
  const store = new AiProposalStore();
  let called = false;
  const service = new AiEditingProposalService(store, async () => { called = true; return { provider: "test", model: "fixture", text: "never" }; });
  await assert.rejects(() => service.proposeRewrite({ projectId: "p1", bookId: "b1", chapterId: "c1", sceneId: "s1", sourceContent: "valid scene", findingMessage: "Finding", recommendation: "Recommendation", findingStart: 0, findingEnd: 99, proposalId: "edit-2" }), /finding range is invalid/);
  assert.equal(called, false);
});

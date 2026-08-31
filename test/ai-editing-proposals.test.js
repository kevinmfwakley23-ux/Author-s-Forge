import test from "node:test";
import assert from "node:assert/strict";
import { AiProposalStore } from "../dist/application/ai-proposal-store.js";
import { AiEditingProposalService, sha256EditingContent } from "../dist/application/ai-editing-proposals.js";
import { analyzeCraft } from "../dist/domain/craft-lens.js";

test("AI editing turns a deterministic finding into a source-bound durable proposal", async () => {
  const source = "The detective walked slowly down the empty hallway.";
  const store = new AiProposalStore();
  const service = new AiEditingProposalService(store, async () => ({ provider: "test", model: "fixture", text: "The detective moved down the empty hallway, listening for the first sign of danger." }));
  const proposal = await service.proposeRewrite({ projectId: "p1", bookId: "b1", chapterId: "c1", sceneId: "s1", sourceContent: source, findingMessage: "The sentence has repetitive pacing.", recommendation: "Vary cadence while preserving the scene's meaning.", findingStart: 0, findingEnd: source.length, proposalId: "edit-1" });
  assert.equal(proposal.status, "pending");
  assert.equal(proposal.kind, "manuscript-edit");
  assert.deepEqual(proposal.target, { bookId: "b1", chapterId: "c1", sceneId: "s1" });
  assert.equal(proposal.baseContentSha256, sha256EditingContent(source));
  assert.equal(proposal.craftLensEvidence, undefined, "manual editorial findings must not claim Craft Lens provenance");
});

test("AI editing independently stamps Craft Lens evidence only for an exact current finding and author strategy", async () => {
  const source = "The door was opened by Marcus while he walked slowly into the room and looked around at the walls that had been painted years before, wondering whether the old photographs still remained where Lena had left them because nobody had touched them since the house was abandoned. Marcus looked at the clock. Lena waited.";
  const report = analyzeCraft(source);
  const finding = report.findings.find((item) => item.id === "clarity-long-sentences");
  assert.ok(finding);
  const selectedSuggestion = finding.suggestions[0];
  const store = new AiProposalStore();
  let providerPrompt = "";
  const service = new AiEditingProposalService(store, async (request) => {
    providerPrompt = request.user;
    return { provider: "test", model: "fixture", text: "Marcus moved through the room. He studied the old photographs, untouched since the house was abandoned. Lena waited near the clock." };
  });
  const proposal = await service.proposeRewrite({
    projectId: "p1",
    bookId: "b1",
    chapterId: "c1",
    sceneId: "s1",
    sourceContent: source,
    findingMessage: finding.message,
    recommendation: selectedSuggestion,
    findingStart: 0,
    findingEnd: source.length,
    proposalId: "craft-edit-1",
    now: "2026-08-31T05:00:00.000Z",
  });
  assert.equal(proposal.title, "Craft Lens: clarity proposal");
  assert.equal(proposal.craftLensEvidence?.findingId, finding.id);
  assert.equal(proposal.craftLensEvidence?.selectedSuggestion, selectedSuggestion);
  assert.equal(proposal.craftLensEvidence?.sourceContentSha256, sha256EditingContent(source));
  assert.equal(proposal.craftLensEvidence?.analyzedAt, "2026-08-31T05:00:00.000Z");
  assert.match(providerPrompt, /CRAFT LENS EVIDENCE:/);
  assert.match(providerPrompt, /AUTHOR-SELECTED REVISION STRATEGY:/);
});

test("AI editing does not preserve stale or fabricated Craft Lens provenance", async () => {
  const source = "The door was opened by Marcus while he walked slowly into the room and looked around at the walls that had been painted years before, wondering whether the old photographs still remained where Lena had left them because nobody had touched them since the house was abandoned. Marcus looked at the clock. Lena waited.";
  const report = analyzeCraft(source);
  const finding = report.findings.find((item) => item.id === "clarity-long-sentences");
  assert.ok(finding);
  const store = new AiProposalStore();
  const service = new AiEditingProposalService(store, async () => ({ provider: "test", model: "fixture", text: "A revised scene that remains an ordinary editorial proposal." }));
  const proposal = await service.proposeRewrite({
    projectId: "p1",
    bookId: "b1",
    chapterId: "c1",
    sceneId: "s1",
    sourceContent: source,
    findingMessage: finding.message,
    recommendation: "A strategy the deterministic lens never offered.",
    findingStart: 0,
    findingEnd: source.length,
    proposalId: "manual-edit-2",
  });
  assert.equal(proposal.craftLensEvidence, undefined);
  assert.equal(proposal.title, "Editorial rewrite proposal");
});

test("AI editing refuses malformed finding ranges before provider execution", async () => {
  const store = new AiProposalStore();
  let called = false;
  const service = new AiEditingProposalService(store, async () => { called = true; return { provider: "test", model: "fixture", text: "never" }; });
  await assert.rejects(() => service.proposeRewrite({ projectId: "p1", bookId: "b1", chapterId: "c1", sceneId: "s1", sourceContent: "valid scene", findingMessage: "Finding", recommendation: "Recommendation", findingStart: 0, findingEnd: 99, proposalId: "edit-2" }), /finding range is invalid/);
  assert.equal(called, false);
});

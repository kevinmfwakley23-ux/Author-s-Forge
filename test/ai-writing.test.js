import test from "node:test";
import assert from "node:assert/strict";
import { AiProposalStore } from "../dist/application/ai-proposal-store.js";
import { AiWritingService } from "../dist/application/ai-writing.js";

function request(overrides = {}) {
  return {
    projectId: "project-1",
    bookId: "book-1",
    chapterId: "chapter-1",
    sceneId: "scene-1",
    task: "continue",
    instruction: "Continue the scene while preserving the established facts.",
    existingContent: "Marcus watched the snow collect against the windshield.",
    assembledContext: "Marcus is in Ogden during a winter storm.",
    sourceMemoryIds: ["canon-1", "canon-2", "canon-2"],
    proposalId: "proposal-1",
    now: "2026-08-30T05:00:00.000Z",
    ...overrides,
  };
}

test("writing service records provider output as a pending author proposal", async () => {
  const proposals = new AiProposalStore();
  const service = new AiWritingService({ generate: async (input) => `Generated for ${input.task}: ${input.instruction}` }, proposals);
  const result = await service.generate(request());

  assert.equal(result.formatVersion, 1);
  assert.equal(result.proposal.status, "pending");
  assert.equal(result.proposal.kind, "manuscript-edit");
  assert.deepEqual(result.proposal.sourceMemoryIds, ["canon-1", "canon-2"]);
  assert.equal(result.target.sceneId, "scene-1");
  assert.equal(proposals.pending("project-1").length, 1);
});

test("writing service does not mutate manuscript content", async () => {
  const proposals = new AiProposalStore();
  const service = new AiWritingService({ generate: async () => "Candidate text" }, proposals);
  const original = request({ existingContent: "Original canon-safe scene." });
  const result = await service.generate(original);

  assert.equal(original.existingContent, "Original canon-safe scene.");
  assert.equal(result.proposal.proposedContent, "Candidate text");
  assert.equal(proposals.get("proposal-1")?.status, "pending");
});

test("non-draft writing tasks require existing scene content", async () => {
  const service = new AiWritingService({ generate: async () => "Candidate" }, new AiProposalStore());
  await assert.rejects(() => service.generate(request({ existingContent: "" })), /requires existing scene content/);
});

test("empty provider output is refused", async () => {
  const service = new AiWritingService({ generate: async () => "   " }, new AiProposalStore());
  await assert.rejects(() => service.generate(request()), /returned empty content/);
});

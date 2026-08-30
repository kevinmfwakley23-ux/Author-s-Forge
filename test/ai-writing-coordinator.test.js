import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AiWritingCoordinator } from "../dist/application/ai-writing-coordinator.js";
import { FileAiProposalStore } from "../dist/infrastructure/file-ai-proposal-store.js";

function request() {
  return {
    projectId: "project-1",
    bookId: "book-1",
    chapterId: "chapter-1",
    sceneId: "scene-1",
    task: "continue",
    instruction: "Continue the scene without contradicting canon.",
    existingContent: "The storm pressed against the windows.",
    assembledContext: "The protagonist is sheltering in Ogden during winter.",
    sourceMemoryIds: ["canon-1"],
    proposalId: "proposal-1",
    now: "2026-08-30T09:00:00.000Z",
  };
}

test("coordinator durably records real provider output before author review", async () => {
  const directory = await mkdtemp(join(tmpdir(), "forge-ai-coordinator-"));
  try {
    const file = join(directory, "proposals.json");
    const coordinator = new AiWritingCoordinator(new FileAiProposalStore(file), async () => ({ provider: "ollama", model: "test-model", text: "A real provider boundary returned this candidate." }));
    const result = await coordinator.generate(request());
    assert.equal(result.proposal.status, "pending");
    assert.deepEqual(result.proposal.target, { bookId: "book-1", chapterId: "chapter-1", sceneId: "scene-1" });
    const persisted = JSON.parse(await readFile(file, "utf8"));
    assert.equal(persisted.proposals[0].status, "pending");
    assert.equal(persisted.proposals[0].target.sceneId, "scene-1");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("coordinator persists author review decisions", async () => {
  const directory = await mkdtemp(join(tmpdir(), "forge-ai-coordinator-review-"));
  try {
    const file = join(directory, "proposals.json");
    const coordinator = new AiWritingCoordinator(new FileAiProposalStore(file), async () => ({ provider: "ollama", model: "test-model", text: "Candidate." }));
    await coordinator.generate(request());
    const review = await coordinator.review("proposal-1", "accepted", "Author approved this candidate.", "2026-08-30T09:01:00.000Z");
    assert.equal(review.to, "accepted");

    const recovered = new AiWritingCoordinator(new FileAiProposalStore(file), async () => ({ provider: "ollama", model: "test-model", text: "unused" }));
    assert.equal((await recovered.get("proposal-1"))?.status, "accepted");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

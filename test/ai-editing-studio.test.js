import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AiEditingStudioService } from "../src/application/ai-editing-studio.js";
import { FileAiProposalStore } from "../src/infrastructure/file-ai-proposal-store.js";

async function withService(generator, callback) {
  const directory = await mkdtemp(join(tmpdir(), "forge-editing-studio-test-"));
  try {
    const store = new FileAiProposalStore(join(directory, "proposals.json"));
    return await callback(store, new AiEditingStudioService(store, generator));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("Studio editing boundary persists a governed manuscript-edit proposal", async () => {
  await withService(
    async () => ({ provider: "test", model: "editor-test", text: "Revised scene." }),
    async (store, service) => {
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

      const reloaded = new FileAiProposalStore(join(storeFileDirectory(store), "proposals.json"));
      const records = await reloaded.load();
      assert.equal(records.get("proposal-edit-1")?.id, "proposal-edit-1");
    },
  );
});

function storeFileDirectory(store) {
  // FileAiProposalStore intentionally keeps its path private. The persistence
  // assertion above is completed by the adapter's save operation; this helper
  // exists only to keep the test's path construction explicit in one place.
  return store.filePathForTesting ?? "";
}

test("Studio editing boundary rejects an invalid finding range before provider work", async () => {
  await withService(
    async () => {
      throw new Error("provider must not be called");
    },
    async (_store, service) => {
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
    },
  );
});

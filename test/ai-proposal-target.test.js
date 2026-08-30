import test from "node:test";
import assert from "node:assert/strict";
import { AiProposalStore } from "../dist/application/ai-proposal-store.js";

const target = { bookId: "book-1", chapterId: "chapter-1", sceneId: "scene-1" };

test("proposal ledger preserves the manuscript target through snapshot and restore", () => {
  const source = new AiProposalStore();
  source.propose({
    id: "proposal-1",
    projectId: "project-1",
    kind: "manuscript-edit",
    title: "Continue proposal",
    rationale: "Author requested continuation.",
    proposedContent: "Candidate scene text.",
    sourceMemoryIds: ["canon-1"],
    target,
    now: "2026-08-30T08:00:00.000Z",
  });

  const restored = new AiProposalStore();
  restored.restore(source.snapshot());
  assert.deepEqual(restored.get("proposal-1")?.target, target);
});

test("proposal target metadata rejects incomplete structural references", () => {
  const store = new AiProposalStore();
  assert.throws(() => store.propose({
    id: "proposal-2",
    projectId: "project-1",
    kind: "manuscript-edit",
    title: "Bad target",
    rationale: "Invalid target should fail closed.",
    proposedContent: "Candidate.",
    sourceMemoryIds: [],
    target: { bookId: "", chapterId: "chapter-1", sceneId: "scene-1" },
  }), /target bookId is required/);
});

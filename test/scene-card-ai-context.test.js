const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { createProject, withProjectStudioWorkspace } = require("../.forge-build/domain/project.js");
const { createStudioWorkspace, createWorkspaceBook, addWorkspaceBook, addWorkspaceChapter, addWorkspaceScene } = require("../.forge-build/domain/studio-workspace.js");
const { FileProjectStore } = require("../.forge-build/infrastructure/file-project-store.js");
const { FileAiProposalStore } = require("../.forge-build/infrastructure/file-ai-proposal-store.js");
const { AiWritingCoordinator } = require("../.forge-build/application/ai-writing-coordinator.js");
const { AiWritingStudioService } = require("../.forge-build/application/ai-writing-studio.js");
const { StudioStoryMapPlanningService } = require("../.forge-build/application/studio-story-map-planning.js");
const { StudioSceneCardWorkflowService } = require("../.forge-build/application/studio-scene-card-workflow.js");

async function fixture(root) {
  const projects = new FileProjectStore(root);
  let workspace = createStudioWorkspace();
  workspace = addWorkspaceBook(workspace, createWorkspaceBook({ id: "book-1", title: "Bound Scene", kind: "novel", now: "2026-09-02T21:00:00Z" }));
  workspace = addWorkspaceChapter(workspace, "book-1", { id: "chapter-1", number: 1, title: "Archive", now: "2026-09-02T21:01:00Z" });
  workspace = addWorkspaceScene(workspace, "book-1", "chapter-1", { id: "scene-1", number: 1, title: "Service Door", synopsis: "Mara tries the archive service entrance.", now: "2026-09-02T21:02:00Z" });
  await projects.create(withProjectStudioWorkspace(createProject({ id: "project-1", title: "Scene Card AI Binding", now: "2026-09-02T21:00:00Z" }), workspace, "2026-09-02T21:02:00Z"));

  const planning = new StudioStoryMapPlanningService(projects);
  await planning.setSceneAttributes("project-1", {
    bookId: "book-1",
    chapterId: "chapter-1",
    sceneId: "scene-1",
    attributes: { goal: "Enter unseen.", conflict: "The service door is chained." },
    now: "2026-09-02T21:03:00Z",
  });
  const cards = new StudioSceneCardWorkflowService(projects);
  await cards.saveCard("project-1", {
    bookId: "book-1",
    chapterId: "chapter-1",
    sceneId: "scene-1",
    details: { purpose: "Get Mara inside while planting the missing-key clue.", forbiddenDeviations: ["Do not identify who removed the key."] },
    now: "2026-09-02T21:04:00Z",
  });
  const approved = await cards.approveCard("project-1", {
    bookId: "book-1",
    chapterId: "chapter-1",
    sceneId: "scene-1",
    authorApproved: true,
    now: "2026-09-02T21:05:00Z",
  });
  return { projects, planning, cards, cardSha256: approved.cards[0].cardSha256 };
}

test("AI provider execution revalidates the exact approved Scene Card SHA", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-scene-card-ai-binding-"));
  try {
    const { projects, planning, cardSha256 } = await fixture(root);
    let providerCalls = 0;
    const coordinator = new AiWritingCoordinator(
      new FileAiProposalStore(join(root, "proposals.json")),
      async () => {
        providerCalls += 1;
        return { provider: "test", model: "fixture", text: "Mara eased the chained door inward." };
      },
    );
    const studio = new AiWritingStudioService(projects, coordinator);
    const generated = await studio.generateWithProjectContext({
      projectId: "project-1",
      bookId: "book-1",
      chapterId: "chapter-1",
      sceneId: "scene-1",
      task: "draft",
      instruction: "Draft only from the approved Scene Card.",
      proposalId: "scene-card-bound-proposal",
      sceneCardSha256: cardSha256,
      now: "2026-09-02T21:06:00Z",
    });
    assert.equal(providerCalls, 1);
    assert.equal(generated.proposal.status, "pending");

    await planning.setSceneAttributes("project-1", {
      bookId: "book-1",
      chapterId: "chapter-1",
      sceneId: "scene-1",
      attributes: { goal: "Enter unseen without triggering the alarm.", conflict: "The service door is chained." },
      now: "2026-09-02T21:07:00Z",
    });
    await assert.rejects(
      () => studio.generateWithProjectContext({
        projectId: "project-1",
        bookId: "book-1",
        chapterId: "chapter-1",
        sceneId: "scene-1",
        task: "draft",
        instruction: "This stale brief must never reach the provider.",
        proposalId: "stale-scene-card-proposal",
        sceneCardSha256: cardSha256,
        now: "2026-09-02T21:08:00Z",
      }),
      /no longer author-approved/,
    );
    assert.equal(providerCalls, 1, "Changing the live Scene Card source must fail before any second provider call.");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("AI generation rejects an invalid or mismatched Scene Card binding before provider execution", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-scene-card-ai-invalid-binding-"));
  try {
    const { projects, cardSha256 } = await fixture(root);
    let providerCalls = 0;
    const coordinator = new AiWritingCoordinator(
      new FileAiProposalStore(join(root, "proposals.json")),
      async () => {
        providerCalls += 1;
        return { provider: "test", model: "fixture", text: "Should not be called." };
      },
    );
    const studio = new AiWritingStudioService(projects, coordinator);
    await assert.rejects(
      () => studio.generateWithProjectContext({
        projectId: "project-1", bookId: "book-1", chapterId: "chapter-1", sceneId: "scene-1", task: "draft",
        instruction: "Reject wrong card binding.", proposalId: "wrong-binding", sceneCardSha256: "0".repeat(64),
      }),
      /changed after its draft brief/,
    );
    assert.notEqual(cardSha256, "0".repeat(64));
    assert.equal(providerCalls, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

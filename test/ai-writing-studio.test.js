import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProject } from "../dist/domain/project.js";
import { FileProjectStore } from "../dist/infrastructure/file-project-store.js";
import { FileAiProposalStore } from "../dist/infrastructure/file-ai-proposal-store.js";
import { AiWritingCoordinator } from "../dist/application/ai-writing-coordinator.js";
import { AiWritingStudioService } from "../dist/application/ai-writing-studio.js";
import { createStudioWorkspace, addWorkspaceBook, addWorkspaceChapter, addWorkspaceScene, saveSceneContent } from "../dist/domain/studio-workspace.js";

async function fixture(root) {
  const projects = new FileProjectStore(root);
  const project = createProject({ id: "project-1", title: "Studio Test" });
  let workspace = createStudioWorkspace();
  workspace = addWorkspaceBook(workspace, { id: "book-1", title: "Book", kind: "novel", lifecycle: "active", description: "", chapters: [], updatedAt: "2026-08-30T09:00:00.000Z" });
  workspace = addWorkspaceChapter(workspace, "book-1", { id: "chapter-1", number: 1, title: "Chapter One" });
  workspace = addWorkspaceScene(workspace, "book-1", "chapter-1", { id: "scene-1", number: 1, title: "Scene One" });
  workspace = saveSceneContent(workspace, "book-1", "chapter-1", "scene-1", "The original scene.", "2026-08-30T09:00:00.000Z");
  await projects.create({ ...project, studioWorkspace: workspace });
  return projects;
}

function request() {
  return { projectId: "project-1", bookId: "book-1", chapterId: "chapter-1", sceneId: "scene-1", task: "continue", instruction: "Continue the scene without changing established facts.", existingContent: "The original scene.", assembledContext: "Canon: the scene begins during a storm.", sourceMemoryIds: [], proposalId: "proposal-1", now: "2026-08-30T09:01:00.000Z" };
}

test("Studio AI generation records a pending proposal without mutating the manuscript", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-ai-studio-"));
  try {
    const projects = await fixture(root);
    const coordinator = new AiWritingCoordinator(new FileAiProposalStore(join(root, "proposals.json")), async () => ({ provider: "test", model: "fixture", text: "The storm deepened as the night closed in." }));
    const service = new AiWritingStudioService(projects, coordinator);
    const result = await service.generate(request());
    assert.equal(result.proposal.status, "pending");
    assert.match(result.proposal.baseContentSha256, /^[a-f0-9]{64}$/);
    const project = await projects.load("project-1");
    assert.equal(project.studioWorkspace.books[0].chapters[0].scenes[0].content, "The original scene.");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("Studio AI apply requires author approval and writes only the persisted proposal target", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-ai-studio-apply-"));
  try {
    const projects = await fixture(root);
    const coordinator = new AiWritingCoordinator(new FileAiProposalStore(join(root, "proposals.json")), async () => ({ provider: "test", model: "fixture", text: "Approved candidate." }));
    const service = new AiWritingStudioService(projects, coordinator);
    await service.generate(request());
    await assert.rejects(() => service.applyAccepted("project-1", "proposal-1"), /must be accepted/);
    await service.review("project-1", "proposal-1", "accepted", "Author approved.", "2026-08-30T09:02:00.000Z");
    const applied = await service.applyAccepted("project-1", "proposal-1", "2026-08-30T09:03:00.000Z");
    assert.equal(applied.workspace.books[0].chapters[0].scenes[0].content, "Approved candidate.");
    const recovered = await projects.load("project-1");
    assert.equal(recovered.studioWorkspace.books[0].chapters[0].scenes[0].content, "Approved candidate.");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("Studio AI refuses to overwrite newer author work after proposal generation", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-ai-studio-stale-"));
  try {
    const projects = await fixture(root);
    const coordinator = new AiWritingCoordinator(new FileAiProposalStore(join(root, "proposals.json")), async () => ({ provider: "test", model: "fixture", text: "Older candidate." }));
    const service = new AiWritingStudioService(projects, coordinator);
    await service.generate(request());
    await service.review("project-1", "proposal-1", "accepted", undefined, "2026-08-30T09:02:00.000Z");
    const project = await projects.load("project-1");
    const changed = saveSceneContent(project.studioWorkspace, "book-1", "chapter-1", "scene-1", "New author revision.", "2026-08-30T09:02:30.000Z");
    await projects.save({ ...project, studioWorkspace: changed });
    await assert.rejects(() => service.applyAccepted("project-1", "proposal-1"), /is stale/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

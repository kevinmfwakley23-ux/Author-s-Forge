import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProject, createAiCollaborationPolicy } from "../dist/index.js";
import { FileProjectStore } from "../dist/infrastructure/file-project-store.js";
import { FileAiProposalStore } from "../dist/infrastructure/file-ai-proposal-store.js";
import { AiWritingCoordinator } from "../dist/application/ai-writing-coordinator.js";
import { AiWritingStudioService } from "../dist/application/ai-writing-studio.js";
import { StudioArchitectureAiService } from "../dist/application/studio-architecture-ai-routes.js";
import { createStudioWorkspace, addWorkspaceBook, addWorkspaceChapter, addWorkspaceScene, saveSceneContent } from "../dist/domain/studio-workspace.js";
import { assertAiCollaborationCapability, collaborationCapabilityAllowed } from "../dist/domain/ai-collaboration.js";

const NOW = "2026-09-02T18:00:00.000Z";

function workspaceFixture() {
  let workspace = createStudioWorkspace();
  workspace = addWorkspaceBook(workspace, { id: "book-1", title: "Book", kind: "novel", lifecycle: "active", description: "", chapters: [], updatedAt: NOW });
  workspace = addWorkspaceChapter(workspace, "book-1", { id: "chapter-1", number: 1, title: "Opening" });
  workspace = addWorkspaceScene(workspace, "book-1", "chapter-1", { id: "scene-1", number: 1, title: "Arrival" });
  return saveSceneContent(workspace, "book-1", "chapter-1", "scene-1", "Mara waited beside the locked gate.", NOW);
}

async function projectStore(root, mode) {
  const store = new FileProjectStore(root);
  const base = createProject({ id: "project-1", title: "Collaboration Policy", now: NOW });
  await store.create({ ...base, studioWorkspace: workspaceFixture(), aiCollaborationPolicy: createAiCollaborationPolicy(mode) });
  return store;
}

function writingRequest(task, proposalId) {
  return {
    projectId: "project-1",
    bookId: "book-1",
    chapterId: "chapter-1",
    sceneId: "scene-1",
    task,
    instruction: task === "rewrite" ? "Tighten the existing scene without changing its meaning." : "Continue the scene with the next beat.",
    existingContent: "Mara waited beside the locked gate.",
    proposalId,
    now: NOW,
  };
}

test("collaboration modes constrain autonomous initiative without taking commands away from the author", () => {
  const editor = createAiCollaborationPolicy("editor");
  assert.equal(collaborationCapabilityAllowed(editor, "draft", "autonomous"), false);
  assert.equal(collaborationCapabilityAllowed(editor, "revise", "autonomous"), true);
  assert.equal(collaborationCapabilityAllowed(editor, "bulk-work", "autonomous"), false);
  assert.equal(collaborationCapabilityAllowed(editor, "draft", "author-requested"), true);
  assert.equal(collaborationCapabilityAllowed(editor, "bulk-work", "author-requested"), true);
  assert.throws(() => assertAiCollaborationCapability(editor, "draft", "AI drafting", "autonomous"), /does not allow autonomous AI drafting/i);
  assert.doesNotThrow(() => assertAiCollaborationCapability(editor, "draft", "AI drafting", "author-requested"));
});

test("an explicit author draft request works in Editor mode and remains proposal-only", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-collaboration-editor-draft-"));
  try {
    const projects = await projectStore(root, "editor");
    let providerCalls = 0;
    const coordinator = new AiWritingCoordinator(new FileAiProposalStore(join(root, "proposals.json")), async () => {
      providerCalls += 1;
      return { provider: "test", model: "fixture", text: "Mara heard footsteps beyond the locked gate." };
    });
    const service = new AiWritingStudioService(projects, coordinator);
    const result = await service.generateWithProjectContext(writingRequest("continue", "proposal-editor-draft"));
    assert.equal(providerCalls, 1, "A direct author command must reach the real provider boundary regardless of collaboration mode.");
    assert.equal(result.proposal.status, "pending");
    const persisted = await projects.load("project-1");
    assert.equal(persisted.studioWorkspace.books[0].chapters[0].scenes[0].content, "Mara waited beside the locked gate.", "Author-requested AI work must still remain proposal-only until author review/apply.");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("Editor mode still permits revision proposals and preserves the same author review boundary", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-collaboration-editor-revise-"));
  try {
    const projects = await projectStore(root, "editor");
    let providerCalls = 0;
    const coordinator = new AiWritingCoordinator(new FileAiProposalStore(join(root, "proposals.json")), async () => {
      providerCalls += 1;
      return { provider: "test", model: "fixture", text: "Mara stood beside the locked gate, listening." };
    });
    const service = new AiWritingStudioService(projects, coordinator);
    const result = await service.generateWithProjectContext(writingRequest("rewrite", "proposal-editor-rewrite"));
    assert.equal(providerCalls, 1);
    assert.equal(result.proposal.status, "pending");
    const persisted = await projects.load("project-1");
    assert.equal(persisted.studioWorkspace.books[0].chapters[0].scenes[0].content, "Mara waited beside the locked gate.");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("an explicit author architecture request is allowed in every collaboration mode", async () => {
  for (const mode of ["co-pilot", "partner", "director", "autonomous", "editor"]) {
    const root = await mkdtemp(join(tmpdir(), `forge-collaboration-${mode}-architecture-`));
    try {
      const store = await projectStore(root, mode);
      let calls = 0;
      const service = new StudioArchitectureAiService(store, async () => {
        calls += 1;
        return { provider: "test", model: "fixture", text: "A practical candidate architecture." };
      });
      const result = await service.generate({ projectId: "project-1", idea: "A detective follows a vanished archivist through a flooded city." });
      assert.equal(calls, 1, `Direct architecture command should run in ${mode} mode.`);
      assert.equal(result.candidate, true);
      assert.equal(result.authorApprovalRequired, true);
    } finally { await rm(root, { recursive: true, force: true }); }
  }
});

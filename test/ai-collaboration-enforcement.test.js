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

test("collaboration capability helpers fail closed for disallowed Editor drafting", () => {
  const editor = createAiCollaborationPolicy("editor");
  assert.equal(collaborationCapabilityAllowed(editor, "draft"), false);
  assert.equal(collaborationCapabilityAllowed(editor, "revise"), true);
  assert.equal(collaborationCapabilityAllowed(editor, "bulk-work"), false);
  assert.throws(() => assertAiCollaborationCapability(editor, "draft", "AI drafting"), /does not allow AI drafting/i);
});

test("Editor mode blocks real draft-like manuscript generation before provider execution", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-collaboration-editor-draft-"));
  try {
    const projects = await projectStore(root, "editor");
    let providerCalls = 0;
    const coordinator = new AiWritingCoordinator(new FileAiProposalStore(join(root, "proposals.json")), async () => {
      providerCalls += 1;
      return { provider: "test", model: "fixture", text: "This must never be generated in Editor draft mode." };
    });
    const service = new AiWritingStudioService(projects, coordinator);
    await assert.rejects(() => service.generateWithProjectContext(writingRequest("continue", "proposal-editor-draft")), /Collaboration mode "editor" does not allow AI continue writing/);
    assert.equal(providerCalls, 0, "Disallowed collaboration work must fail before any model/provider call.");
    assert.deepEqual(await coordinator.list("project-1"), [], "A blocked generation must not leave a fake proposal behind.");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("Editor mode still permits real revision proposals and keeps author review boundary", async () => {
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
    assert.equal(persisted.studioWorkspace.books[0].chapters[0].scenes[0].content, "Mara waited beside the locked gate.", "Allowed revision generation must remain proposal-only until author approval and apply.");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("Editor mode blocks architecture generation while Co-pilot mode permits it", async () => {
  const editorRoot = await mkdtemp(join(tmpdir(), "forge-collaboration-editor-architecture-"));
  const copilotRoot = await mkdtemp(join(tmpdir(), "forge-collaboration-copilot-architecture-"));
  try {
    const editorStore = await projectStore(editorRoot, "editor");
    let editorCalls = 0;
    const editorService = new StudioArchitectureAiService(editorStore, async () => {
      editorCalls += 1;
      return { provider: "test", model: "fixture", text: "Should not run." };
    });
    await assert.rejects(() => editorService.generate({ projectId: "project-1", idea: "A detective follows a vanished archivist through a flooded city." }), /does not allow AI architecture generation/);
    assert.equal(editorCalls, 0);

    const copilotStore = await projectStore(copilotRoot, "co-pilot");
    let copilotCalls = 0;
    const copilotService = new StudioArchitectureAiService(copilotStore, async () => {
      copilotCalls += 1;
      return { provider: "test", model: "fixture", text: "A practical candidate architecture." };
    });
    const result = await copilotService.generate({ projectId: "project-1", idea: "A detective follows a vanished archivist through a flooded city." });
    assert.equal(copilotCalls, 1);
    assert.equal(result.candidate, true);
    assert.equal(result.authorApprovalRequired, true);
  } finally {
    await rm(editorRoot, { recursive: true, force: true });
    await rm(copilotRoot, { recursive: true, force: true });
  }
});

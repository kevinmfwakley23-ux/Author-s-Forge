import test from "node:test";
import assert from "node:assert/strict";
import { createStudioWorkspace, addWorkspaceBook, addWorkspaceChapter, addWorkspaceScene, saveSceneContent } from "../dist/domain/studio-workspace.js";
import { previewStudioAiWritingContext, generateStudioAiWritingProposal } from "../dist/application/studio-ai-writing-http.js";

function workspaceFixture() {
  let workspace = createStudioWorkspace();
  workspace = addWorkspaceBook(workspace, { id: "book-1", title: "Book", kind: "novel", lifecycle: "active", description: "", chapters: [], updatedAt: "2026-08-30T09:00:00.000Z" });
  workspace = addWorkspaceChapter(workspace, "book-1", { id: "chapter-1", number: 1, title: "Chapter One" });
  workspace = addWorkspaceScene(workspace, "book-1", "chapter-1", { id: "scene-1", number: 1, title: "Scene One" });
  return saveSceneContent(workspace, "book-1", "chapter-1", "scene-1", "Author-owned scene text.", "2026-08-30T09:00:00.000Z");
}

const governedPolicies = [
  { key: "canon", mode: "full" },
  { key: "characters", mode: "extended" },
  { key: "timeline", mode: "off" },
  { key: "research", mode: "brief" },
];

test("Studio AI HTTP preview delegates governed context controls to the authoritative read-only preview service", async () => {
  let captured;
  const expected = { context: { sourceIds: ["canon-1"], evidence: [] }, contextBudget: { requestedBudget: 2400 }, authorVoice: { available: true, sampleCount: 2, canonicalSampleCount: 1 } };
  const studio = { previewContext: async (projectId, options) => { captured = { projectId, options }; return expected; } };
  const result = await previewStudioAiWritingContext({ studio, projectId: "project-1" }, { query: "warehouse Elias", characterIds: ["elias"], characterMemoryLimit: 3, memoryLimitPerSection: 2, contextTokenBudget: 2400, policies: governedPolicies });
  assert.deepEqual(result, expected);
  assert.deepEqual(captured, { projectId: "project-1", options: { query: "warehouse Elias", characterIds: ["elias"], characterAsOf: undefined, characterMemoryLimit: 3, memoryLimitPerSection: 2, contextTokenBudget: 2400, policies: governedPolicies } });
});

test("Studio AI HTTP generation cannot accept client-supplied source memory authority and forwards validated Scene Card binding", async () => {
  let captured;
  const studio = { generateWithProjectContext: async (request) => { captured = request; return { proposal: { id: "proposal-1" } }; } };
  const sceneCardSha256 = "a".repeat(64);
  await generateStudioAiWritingProposal({ studio, workspace: workspaceFixture(), projectId: "project-1" }, {
    bookId: "book-1",
    chapterId: "chapter-1",
    sceneId: "scene-1",
    task: "continue",
    instruction: "Continue with Elias in the warehouse.",
    sourceMemoryIds: ["client-forged-memory"],
    assembledContext: "client-forged-context",
    proposalId: "proposal-1",
    sceneCardSha256,
    memoryLimitPerSection: 1,
    characterMemoryLimit: 2,
    contextTokenBudget: 1800,
    policies: governedPolicies,
  });
  assert.equal(captured.projectId, "project-1");
  assert.equal(captured.existingContent, "Author-owned scene text.");
  assert.equal(captured.sceneCardSha256, sceneCardSha256);
  assert.equal(captured.context.query, "Continue with Elias in the warehouse.");
  assert.equal(captured.context.memoryLimitPerSection, 1);
  assert.equal(captured.context.characterMemoryLimit, 2);
  assert.equal(captured.context.contextTokenBudget, 1800);
  assert.deepEqual(captured.context.policies, governedPolicies);
  assert.equal(Object.hasOwn(captured, "sourceMemoryIds"), false);
  assert.equal(Object.hasOwn(captured, "assembledContext"), false);
});

test("Studio AI HTTP boundary validates context policy, budget, Scene Card binding, and target input before provider generation", async () => {
  let calls = 0;
  const studio = { generateWithProjectContext: async () => { calls += 1; return {}; } };
  const dependencies = { studio, workspace: workspaceFixture(), projectId: "project-1" };
  await assert.rejects(() => generateStudioAiWritingProposal(dependencies, { bookId: "book-1", chapterId: "missing", sceneId: "scene-1", instruction: "Continue." }), /valid chapter/);
  await assert.rejects(() => generateStudioAiWritingProposal(dependencies, { bookId: "book-1", chapterId: "chapter-1", sceneId: "scene-1", instruction: "Continue.", policies: [{ key: "memory", mode: "invented" }] }), /Invalid context inclusion mode/);
  await assert.rejects(() => generateStudioAiWritingProposal(dependencies, { bookId: "book-1", chapterId: "chapter-1", sceneId: "scene-1", instruction: "Continue.", memoryLimitPerSection: 0 }), /Invalid memory limit per section/);
  await assert.rejects(() => generateStudioAiWritingProposal(dependencies, { bookId: "book-1", chapterId: "chapter-1", sceneId: "scene-1", instruction: "Continue.", contextTokenBudget: 0 }), /Invalid context token budget/);
  await assert.rejects(() => generateStudioAiWritingProposal(dependencies, { bookId: "book-1", chapterId: "chapter-1", sceneId: "scene-1", instruction: "Continue.", sceneCardSha256: "not-a-sha" }), /Invalid Scene Card generation binding hash/);
  assert.equal(calls, 0);
});

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProject, createCharacter, createAuthorVoiceMemory, withProjectAuthorVoiceMemory } from "../dist/index.js";
import { FileProjectStore } from "../dist/infrastructure/file-project-store.js";
import { FileAiProposalStore } from "../dist/infrastructure/file-ai-proposal-store.js";
import { AiWritingCoordinator } from "../dist/application/ai-writing-coordinator.js";
import { AiWritingStudioService, applyGovernedContextBudget } from "../dist/application/ai-writing-studio.js";
import { createStudioWorkspace, addWorkspaceBook, addWorkspaceChapter, addWorkspaceScene, saveSceneContent } from "../dist/domain/studio-workspace.js";

async function fixture(root, characters = [], authorVoiceMemory) {
  const projects = new FileProjectStore(root);
  let project = createProject({ id: "project-1", title: "Studio Test", now: "2026-08-30T08:00:00.000Z" });
  if (authorVoiceMemory) project = withProjectAuthorVoiceMemory(project, authorVoiceMemory, "2026-08-30T09:00:00.000Z");
  let workspace = createStudioWorkspace();
  workspace = addWorkspaceBook(workspace, { id: "book-1", title: "Book", kind: "novel", lifecycle: "active", description: "", chapters: [], updatedAt: "2026-08-30T09:00:00.000Z" });
  workspace = addWorkspaceChapter(workspace, "book-1", { id: "chapter-1", number: 1, title: "Chapter One" });
  workspace = addWorkspaceScene(workspace, "book-1", "chapter-1", { id: "scene-1", number: 1, title: "Scene One" });
  workspace = saveSceneContent(workspace, "book-1", "chapter-1", "scene-1", "The original scene.", "2026-08-30T09:00:00.000Z");
  await projects.create({ ...project, characters, studioWorkspace: workspace });
  return projects;
}

function character(id, overrides = {}) { return createCharacter({ id, projectId: "project-1", now: "2026-08-30T09:00:00.000Z", profile: { name: id === "mara-1" ? "Mara Voss" : "Eli Voss", age: 31, birthDate: "1995-04-12", physicalAppearance: "Lean and weathered.", height: "5 ft 7 in", build: "Lean", hair: "Dark brown", eyes: "Gray-green", skin: "Olive", clothing: "Dark field jacket", voice: "Low and controlled", speechPatterns: ["Short declarative sentences"], personality: id === "mara-1" ? "Guarded investigator" : "Calm mechanic", values: ["Loyalty"], fears: ["Abandonment"], secrets: [], goals: id === "mara-1" ? ["Find the missing witness"] : ["Repair the boat"], motivations: ["Protect people"], relationships: [], history: "Mountain town upbringing.", knowledge: id === "mara-1" ? ["Knows the old reservoir access roads"] : ["Knows the harbor"], skills: ["Investigation"], weaknesses: ["Distrusts authority"], characterArc: "Learns to trust", importantObjects: ["Compass"], currentEmotionalState: id === "mara-1" ? "Watchful" : "Calm", currentLocation: id === "mara-1" ? "North shoreline" : "Harbor", currentInjuries: [], ...overrides } }); }

function voiceMemory(projectId = "project-1") { return createAuthorVoiceMemory({ id: "voice-1", projectId, authorId: "author-1", samples: [{ id: "sample-1", label: "Canonical prose", approved: true, weight: 1, text: "Rain worried the windows while the old house settled around me. I listened to the pipes click in the walls and waited for the courage to say what I had come to say. Nothing in the room moved quickly. Every sound had time to become a thought before it became a decision." }], canonicalSampleIds: ["sample-1"], createdAt: "2026-08-30T08:00:00.000Z", updatedAt: "2026-08-30T08:00:00.000Z" }); }

function coordinator(root, text = "The storm deepened as the night closed in.", onUser) { return new AiWritingCoordinator(new FileAiProposalStore(join(root, "proposals.json")), async ({ user }) => { onUser?.(user); return { provider: "test", model: "fixture", text: `${text}\nCONTEXT_RECEIVED=${user.includes("Mara Voss")}\n` }; }); }

function request() { return { projectId: "project-1", bookId: "book-1", chapterId: "chapter-1", sceneId: "scene-1", task: "continue", instruction: "Continue the scene around the missing witness without changing established facts.", existingContent: "The original scene.", assembledContext: "Canon: the scene begins during a storm.", sourceMemoryIds: [], proposalId: "proposal-1", now: "2026-08-30T09:01:00.000Z" }; }

test("Studio AI generation records a pending proposal without mutating the manuscript", async () => { const root = await mkdtemp(join(tmpdir(), "forge-ai-studio-")); try { const projects = await fixture(root); const service = new AiWritingStudioService(projects, coordinator(root)); const result = await service.generate(request()); assert.equal(result.proposal.status, "pending"); assert.match(result.proposal.baseContentSha256, /^[a-f0-9]{64}$/); const project = await projects.load("project-1"); assert.equal(project.studioWorkspace.books[0].chapters[0].scenes[0].content, "The original scene."); } finally { await rm(root, { recursive: true, force: true }); } });

test("Studio AI apply requires author approval and writes only the persisted proposal target", async () => { const root = await mkdtemp(join(tmpdir(), "forge-ai-studio-apply-")); try { const projects = await fixture(root); const service = new AiWritingStudioService(projects, coordinator(root, "Approved candidate.")); await service.generate(request()); await assert.rejects(() => service.applyAccepted("project-1", "proposal-1"), /must be accepted/); await service.review("project-1", "proposal-1", "accepted", "Author approved.", "2026-08-30T09:02:00.000Z"); const applied = await service.applyAccepted("project-1", "proposal-1", "2026-08-30T09:03:00.000Z"); assert.match(applied.workspace.books[0].chapters[0].scenes[0].content, /Approved candidate/); } finally { await rm(root, { recursive: true, force: true }); } });

test("Studio AI refuses to overwrite newer author work after proposal generation", async () => { const root = await mkdtemp(join(tmpdir(), "forge-ai-studio-stale-")); try { const projects = await fixture(root); const service = new AiWritingStudioService(projects, coordinator(root, "Older candidate.")); await service.generate(request()); await service.review("project-1", "proposal-1", "accepted", undefined, "2026-08-30T09:02:00.000Z"); const project = await projects.load("project-1"); const changed = saveSceneContent(project.studioWorkspace, "book-1", "chapter-1", "scene-1", "New author revision.", "2026-08-30T09:02:30.000Z"); await projects.save({ ...project, studioWorkspace: changed }); await assert.rejects(() => service.applyAccepted("project-1", "proposal-1"), /is stale/); } finally { await rm(root, { recursive: true, force: true }); } });

test("Mission 058 generates from authoritative project context and retrieves only salient characters", async () => { const root = await mkdtemp(join(tmpdir(), "forge-ai-studio-context-")); try { const projects = await fixture(root, [character("mara-1"), character("eli-1")]); const service = new AiWritingStudioService(projects, coordinator(root)); const result = await service.generateWithProjectContext({ ...request(), context: { query: "missing witness", characterMemoryLimit: 1 } }); assert.equal(result.context.projectId, "project-1"); const characters = result.context.sections.find((section) => section.key === "characters"); assert.ok(characters); assert.deepEqual(characters.sourceIds, ["mara-1"]); assert.match(characters.text, /Mara Voss/); assert.equal(result.proposal.sourceMemoryIds.includes("mara-1"), true); assert.equal(result.proposal.sourceMemoryIds.includes("eli-1"), false); } finally { await rm(root, { recursive: true, force: true }); } });

test("Mission 058 supports historical character context at the Studio generation boundary", async () => { const root = await mkdtemp(join(tmpdir(), "forge-ai-studio-history-")); try { const mara = character("mara-1"); const projects = await fixture(root, [mara]); const service = new AiWritingStudioService(projects, coordinator(root)); const result = await service.generateWithProjectContext({ ...request(), context: { query: "missing witness", characterIds: ["mara-1"], characterAsOf: "2026-08-30T09:00:00.000Z" } }); const section = result.context.sections.find((item) => item.key === "characters"); assert.ok(section); assert.match(section.text, /Mara Voss/); assert.match(section.text, /Find the missing witness/); } finally { await rm(root, { recursive: true, force: true }); } });

test("Studio context preview is read-only and exposes governed selection evidence", async () => { const root = await mkdtemp(join(tmpdir(), "forge-ai-studio-preview-")); try { const projects = await fixture(root, [character("mara-1"), character("eli-1")], voiceMemory()); const service = new AiWritingStudioService(projects, coordinator(root)); const before = await projects.load("project-1"); const preview = await service.previewContext("project-1", { query: "missing witness", characterMemoryLimit: 1 }); const after = await projects.load("project-1"); assert.equal(preview.context.projectId, "project-1"); assert.equal(preview.contextBudget.constrained, false); assert.equal(preview.contextBudget.omittedSectionKeys.length, 0); assert.equal(preview.authorVoice.available, true); assert.equal(preview.authorVoice.sampleCount, 1); assert.equal(preview.authorVoice.canonicalSampleCount, 1); const characters = preview.context.sections.find((section) => section.key === "characters"); assert.ok(characters); assert.deepEqual(characters.sourceIds, ["mara-1"]); assert.equal(Array.isArray(preview.context.evidence), true); assert.deepEqual(after, before); const proposals = await service.list("project-1"); assert.deepEqual(proposals, []); } finally { await rm(root, { recursive: true, force: true }); } });

test("Mission 061 budget keeps critical canon and drops lower-priority context first", () => {
  const context = { formatVersion: 4, projectId: "project-1", totalWords: 600, sourceIds: ["canon-1", "research-1"], evidence: [{ sourceId: "canon-1", sectionKey: "canon", reasons: ["authoritative"] }, { sourceId: "research-1", sectionKey: "research", reasons: ["working"] }], sections: [{ key: "canon", title: "Canon", mode: "full", text: "C".repeat(400), sourceIds: ["canon-1"], wordCount: 100 }, { key: "research", title: "Research", mode: "brief", text: "R".repeat(4000), sourceIds: ["research-1"], wordCount: 500 }] };
  const result = applyGovernedContextBudget(context, 150);
  assert.deepEqual(result.budget.includedSectionKeys, ["canon"]);
  assert.deepEqual(result.budget.omittedSectionKeys, ["research"]);
  assert.equal(result.budget.canonPreserved, true);
  assert.equal(result.budget.constrained, true);
  assert.deepEqual(result.context.sourceIds, ["canon-1"]);
  assert.deepEqual(result.context.evidence.map((item) => item.sourceId), ["canon-1"]);
});

test("Mission 061 reports critical-over-budget truthfully instead of silently dropping canon", () => {
  const context = { formatVersion: 4, projectId: "project-1", totalWords: 500, sourceIds: ["canon-1"], evidence: [{ sourceId: "canon-1", sectionKey: "canon", reasons: ["authoritative"] }], sections: [{ key: "canon", title: "Canon", mode: "full", text: "C".repeat(4000), sourceIds: ["canon-1"], wordCount: 500 }] };
  const result = applyGovernedContextBudget(context, 100);
  assert.deepEqual(result.budget.includedSectionKeys, ["canon"]);
  assert.equal(result.budget.canonPreserved, true);
  assert.equal(result.budget.overBudget, true);
  assert.ok(result.budget.selectedEstimatedTokens > result.budget.requestedBudget);
});

test("Studio context preview reports absence of Author Voice Memory without changing context semantics", async () => { const root = await mkdtemp(join(tmpdir(), "forge-ai-studio-preview-no-voice-")); try { const projects = await fixture(root, [character("mara-1")]); const service = new AiWritingStudioService(projects, coordinator(root)); const preview = await service.previewContext("project-1", { query: "missing witness" }); assert.equal(preview.authorVoice.available, false); assert.equal(preview.authorVoice.sampleCount, 0); assert.equal(preview.authorVoice.canonicalSampleCount, 0); assert.ok(preview.context.sections.some((section) => section.key === "characters")); } finally { await rm(root, { recursive: true, force: true }); } });

test("live Studio drafting sends canonical author voice memory to the provider and persists drift evidence", async () => { const root = await mkdtemp(join(tmpdir(), "forge-ai-studio-voice-")); try { let providerUser = ""; const projects = await fixture(root, [], voiceMemory()); const service = new AiWritingStudioService(projects, coordinator(root, "I moved fast through the narrow hall. I shouted for Mara, ran toward the stairwell, and never stopped long enough to think about what waited below in the dark.", (user) => { providerUser = user; })); const result = await service.generateWithProjectContext(request()); assert.match(providerUser, /AUTHOR VOICE MEMORY/); assert.match(providerUser, /Narrative distance:/); assert.ok(result.voiceDrift); assert.deepEqual(result.proposal.voiceDrift, result.voiceDrift); const persisted = await service.get("project-1", "proposal-1"); assert.deepEqual(persisted.voiceDrift, result.voiceDrift); assert.equal(Array.isArray(persisted.voiceDrift.warnings), true); } finally { await rm(root, { recursive: true, force: true }); } });

test("live Studio drafting remains backward compatible when no author voice corpus exists", async () => { const root = await mkdtemp(join(tmpdir(), "forge-ai-studio-no-voice-")); try { let providerUser = ""; const projects = await fixture(root); const service = new AiWritingStudioService(projects, coordinator(root, "Candidate text.", (user) => { providerUser = user; })); const result = await service.generateWithProjectContext(request()); assert.doesNotMatch(providerUser, /AUTHOR VOICE MEMORY/); assert.equal(result.voiceDrift, undefined); assert.equal(result.proposal.voiceDrift, undefined); } finally { await rm(root, { recursive: true, force: true }); } });

test("project state rejects author voice memory from another project", () => { const project = createProject({ id: "project-1", title: "Voice Isolation" }); assert.throws(() => withProjectAuthorVoiceMemory(project, voiceMemory("project-2")), /another project/); });

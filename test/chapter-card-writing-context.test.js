import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProject, createCharacter } from "../dist/index.js";
import { createChapterCardWorkflowState, approveChapterCard } from "../dist/domain/chapter-card-workflow.js";
import { FileProjectStore } from "../dist/infrastructure/file-project-store.js";
import { FileAiProposalStore } from "../dist/infrastructure/file-ai-proposal-store.js";
import { AiWritingCoordinator } from "../dist/application/ai-writing-coordinator.js";
import { AiWritingStudioService } from "../dist/application/ai-writing-studio.js";
import { createStudioWorkspace, addWorkspaceBook, addWorkspaceChapter, addWorkspaceScene, saveSceneContent } from "../dist/domain/studio-workspace.js";
import { createStoryMapPlanningState, createStoryMapChapterCard, setStoryMapChapterCard } from "../dist/domain/story-map-planning.js";

function mara() {
  return createCharacter({ id: "mara", projectId: "project-1", now: "2026-09-02T16:00:00Z", profile: {
    name: "Mara Voss", age: 31, birthDate: "1995-04-12", physicalAppearance: "Lean and weathered.", height: "5 ft 7 in", build: "Lean", hair: "Dark brown", eyes: "Gray-green", skin: "Olive", clothing: "Dark field jacket", voice: "Low and controlled", speechPatterns: ["Short declarative sentences"], personality: "Guarded investigator", values: ["Loyalty"], fears: ["Abandonment"], secrets: [], goals: ["Find the missing witness"], motivations: ["Protect people"], relationships: [], history: "Mountain town upbringing.", knowledge: ["Old reservoir roads"], skills: ["Investigation"], weaknesses: ["Distrusts authority"], characterArc: "Learns to trust", importantObjects: ["Compass"], currentEmotionalState: "Watchful", currentLocation: "North shoreline", currentInjuries: [],
  } });
}

async function fixture(root) {
  const projects = new FileProjectStore(root);
  const base = createProject({ id: "project-1", title: "Chapter Card Writing", now: "2026-09-02T16:00:00Z" });
  let workspace = createStudioWorkspace();
  workspace = addWorkspaceBook(workspace, { id: "book-1", title: "Book", kind: "novel", lifecycle: "active", description: "", chapters: [], updatedAt: "2026-09-02T16:00:00Z" });
  workspace = addWorkspaceChapter(workspace, "book-1", { id: "chapter-1", number: 8, title: "The Archive" });
  workspace = addWorkspaceScene(workspace, "book-1", "chapter-1", { id: "scene-1", number: 1, title: "Locked Door" });
  workspace = saveSceneContent(workspace, "book-1", "chapter-1", "scene-1", "Mara reached the archive door.", "2026-09-02T16:01:00Z");
  const card = createStoryMapChapterCard({
    povCharacterIds: ["mara"],
    location: "Municipal Archive",
    storyTime: "November 3, 1895 · night",
    emotionalObjective: "Turn confidence into dread.",
    plotObjective: "Get Mara into the restricted records room.",
    characterIds: ["mara"],
    requiredEvents: ["The night clerk notices Mara."],
    clues: ["The key board has one fresh empty hook."],
    reveals: ["The archive log was altered that morning."],
    continuityDependencies: ["Mara still carries the folded letter."],
    atmosphere: "Cold stone and gaslight.",
    endingHook: "A lock turns from inside the records room.",
    approximateWordCount: 3200,
    forbiddenDeviations: ["Do not identify who altered the log.", "Mara cannot know Elias is watching."],
  });
  const storyMapPlanning = setStoryMapChapterCard(createStoryMapPlanningState(), "chapter-1", card);
  const chapterCardWorkflow = approveChapterCard(createChapterCardWorkflowState(), "chapter-1", card, { now: "2026-09-02T16:01:30Z" });
  await projects.create({ ...base, characters: [mara()], studioWorkspace: workspace, storyMapPlanning, chapterCardWorkflow });
  return projects;
}

function request() {
  return { projectId: "project-1", bookId: "book-1", chapterId: "chapter-1", sceneId: "scene-1", task: "continue", instruction: "Continue Chapter 8.", existingContent: "Mara reached the archive door.", proposalId: "proposal-card", now: "2026-09-02T16:02:00Z" };
}

test("AI writing receives the selected chapter's approved author-controlled Chapter Card and forbidden deviations", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-card-writing-"));
  try {
    let providerUser = "";
    const projects = await fixture(root);
    const coordinator = new AiWritingCoordinator(new FileAiProposalStore(join(root, "proposals.json")), async ({ user }) => {
      providerUser = user;
      return { provider: "test", model: "fixture", text: "Candidate that remains a proposal." };
    });
    const service = new AiWritingStudioService(projects, coordinator);
    const result = await service.generateWithProjectContext(request());

    assert.match(providerUser, /Approved Chapter Card — Author-Controlled Plan/);
    assert.match(providerUser, /Get Mara into the restricted records room/);
    assert.match(providerUser, /The night clerk notices Mara/);
    assert.match(providerUser, /Continuity dependencies/);
    assert.match(providerUser, /FORBIDDEN DEVIATIONS — NON-NEGOTIABLE/);
    assert.match(providerUser, /Do not identify who altered the log/);
    assert.match(providerUser, /Mara cannot know Elias is watching/);
    assert.ok(result.context.sections.some((section) => section.key === "chapter-card"));
    assert.ok(result.contextBudget.includedSectionKeys.includes("chapter-card"));
    assert.equal(result.proposal.status, "pending");
    const persisted = await projects.load("project-1");
    assert.equal(persisted.studioWorkspace.books[0].chapters[0].scenes[0].content, "Mara reached the archive door.", "Chapter-guided generation must remain proposal-only until author apply.");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("approved Chapter Card character references are automatically pulled into generation context", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-card-character-context-"));
  try {
    let providerUser = "";
    const projects = await fixture(root);
    const coordinator = new AiWritingCoordinator(new FileAiProposalStore(join(root, "proposals.json")), async ({ user }) => {
      providerUser = user;
      return { provider: "test", model: "fixture", text: "Candidate." };
    });
    const service = new AiWritingStudioService(projects, coordinator);
    const result = await service.generateWithProjectContext({ ...request(), proposalId: "proposal-character", context: { query: "door" } });
    assert.match(providerUser, /Mara Voss/);
    const characters = result.context.sections.find((section) => section.key === "characters");
    assert.ok(characters);
    assert.ok(characters.sourceIds.includes("mara"));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("approved Chapter Card is critical governed context and is not silently dropped by a tight token budget", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-card-budget-"));
  try {
    const projects = await fixture(root);
    const coordinator = new AiWritingCoordinator(new FileAiProposalStore(join(root, "proposals.json")), async () => ({ provider: "test", model: "fixture", text: "Candidate." }));
    const service = new AiWritingStudioService(projects, coordinator);
    const result = await service.generateWithProjectContext({ ...request(), proposalId: "proposal-budget", context: { query: "door", contextTokenBudget: 20 } });
    assert.ok(result.contextBudget.includedSectionKeys.includes("chapter-card"));
    assert.equal(result.contextBudget.overBudget, true, "Critical author-approved planning should report budget pressure instead of disappearing.");
  } finally { await rm(root, { recursive: true, force: true }); }
});

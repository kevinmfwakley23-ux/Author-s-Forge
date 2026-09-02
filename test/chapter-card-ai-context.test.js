import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProject } from "../dist/domain/project.js";
import { createCharacter } from "../dist/domain/character-bible.js";
import { createChapterCardWorkflowState, approveChapterCard } from "../dist/domain/chapter-card-workflow.js";
import { createStudioWorkspace, addWorkspaceBook, addWorkspaceChapter, addWorkspaceScene, saveSceneContent } from "../dist/domain/studio-workspace.js";
import { createStoryMapPlanningState, createStoryMapChapterCard, setStoryMapChapterCard } from "../dist/domain/story-map-planning.js";
import { FileProjectStore } from "../dist/infrastructure/file-project-store.js";
import { FileAiProposalStore } from "../dist/infrastructure/file-ai-proposal-store.js";
import { AiWritingCoordinator } from "../dist/application/ai-writing-coordinator.js";
import { AiWritingStudioService } from "../dist/application/ai-writing-studio.js";

function mara() {
  return createCharacter({ id: "mara-1", projectId: "project-1", now: "2026-09-02T16:00:00.000Z", profile: {
    name: "Mara Voss", age: 31, birthDate: "1995-04-12", physicalAppearance: "Lean and weathered.", height: "5 ft 7 in", build: "Lean", hair: "Dark brown", eyes: "Gray-green", skin: "Olive", clothing: "Dark field jacket", voice: "Low and controlled", speechPatterns: ["Short declarative sentences"], personality: "Guarded investigator", values: ["Loyalty"], fears: ["Abandonment"], secrets: [], goals: ["Enter the restricted archive"], motivations: ["Protect people"], relationships: [], history: "Mountain town upbringing.", knowledge: ["Old city records"], skills: ["Investigation"], weaknesses: ["Distrusts authority"], characterArc: "Learns to trust", importantObjects: ["Compass"], currentEmotionalState: "Watchful", currentLocation: "Municipal Archive", currentInjuries: []
  }});
}

async function projectFixture(root) {
  const projects = new FileProjectStore(root);
  let workspace = createStudioWorkspace();
  workspace = addWorkspaceBook(workspace, { id: "book-1", title: "Archive Story", kind: "novel", lifecycle: "active", description: "", chapters: [], updatedAt: "2026-09-02T16:00:00.000Z" });
  workspace = addWorkspaceChapter(workspace, "book-1", { id: "chapter-1", number: 1, title: "The Locked Door" });
  workspace = addWorkspaceScene(workspace, "book-1", "chapter-1", { id: "scene-1", number: 1, title: "Arrival" });
  workspace = saveSceneContent(workspace, "book-1", "chapter-1", "scene-1", "The archive door stayed shut.", "2026-09-02T16:01:00.000Z");

  const card = createStoryMapChapterCard({
    povCharacterIds: ["mara-1"],
    location: "Municipal Archive",
    storyTime: "November 3, 1895 · 9:15 PM",
    emotionalObjective: "Turn confidence into contained dread.",
    plotObjective: "Get Mara inside the restricted archive.",
    characterIds: ["mara-1"],
    requiredEvents: ["Mara tests the service entrance."],
    continuityDependencies: ["Mara lost her public entrance ticket earlier."],
    endingHook: "A lock turns from the other side.",
    approximateWordCount: 3200,
    forbiddenDeviations: ["Do not reveal who altered the archive log."],
  });
  const storyMapPlanning = setStoryMapChapterCard(createStoryMapPlanningState(), "chapter-1", card);
  const chapterCardWorkflow = approveChapterCard(createChapterCardWorkflowState(), "chapter-1", card, { now: "2026-09-02T16:01:30.000Z" });

  await projects.create({
    ...createProject({ id: "project-1", title: "Chapter Card AI", now: "2026-09-02T16:00:00.000Z" }),
    characters: [mara()],
    studioWorkspace: workspace,
    storyMapPlanning,
    chapterCardWorkflow,
  });
  return projects;
}

test("governed AI writing honors the author-approved Chapter Card and anchors its characters automatically", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-chapter-card-ai-"));
  try {
    const projects = await projectFixture(root);
    let providerRequest;
    const coordinator = new AiWritingCoordinator(
      new FileAiProposalStore(join(root, "proposals.json")),
      async (request) => {
        providerRequest = request;
        return { provider: "test", model: "fixture", text: "Mara tried the service entrance." };
      },
    );
    const service = new AiWritingStudioService(projects, coordinator);
    const generated = await service.generateWithProjectContext({
      projectId: "project-1",
      bookId: "book-1",
      chapterId: "chapter-1",
      sceneId: "scene-1",
      task: "continue",
      instruction: "Continue the scene without breaking the chapter plan.",
      proposalId: "proposal-1",
      now: "2026-09-02T16:02:00.000Z",
    });

    const chapterSection = generated.context.sections.find((section) => section.key === "chapter-card");
    assert.ok(chapterSection, "Approved Chapter Card must be present in governed generation context.");
    assert.match(chapterSection.text, /Get Mara inside the restricted archive/);
    assert.match(chapterSection.text, /FORBIDDEN DEVIATIONS — NON-NEGOTIABLE/);
    assert.match(chapterSection.text, /Do not reveal who altered the archive log/);
    assert.ok(generated.contextBudget.includedSectionKeys.includes("chapter-card"));
    assert.deepEqual(generated.characterContinuity.characters.map((item) => item.characterId), ["mara-1"]);
    assert.match(providerRequest.user, /Approved Chapter Card — Author-Controlled Plan/);
    assert.match(providerRequest.user, /Required events:\n- Mara tests the service entrance/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("governed AI refuses an ambiguous cross-book Chapter Card before provider execution", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-chapter-card-ai-collision-"));
  try {
    const projects = await projectFixture(root);
    const project = await projects.load("project-1");
    let workspace = project.studioWorkspace;
    workspace = addWorkspaceBook(workspace, { id: "book-2", title: "Second Archive Story", kind: "novel", lifecycle: "active", description: "", chapters: [], updatedAt: "2026-09-02T16:03:00.000Z" });
    workspace = addWorkspaceChapter(workspace, "book-2", { id: "chapter-1", number: 1, title: "Another Chapter One" });
    workspace = addWorkspaceScene(workspace, "book-2", "chapter-1", { id: "scene-2", number: 1, title: "Elsewhere" });
    await projects.save({ ...project, studioWorkspace: workspace });

    let providerCalls = 0;
    const coordinator = new AiWritingCoordinator(
      new FileAiProposalStore(join(root, "collision-proposals.json")),
      async () => {
        providerCalls += 1;
        return { provider: "test", model: "fixture", text: "This must never be generated." };
      },
    );
    const service = new AiWritingStudioService(projects, coordinator);
    await assert.rejects(
      () => service.generateWithProjectContext({
        projectId: "project-1",
        bookId: "book-1",
        chapterId: "chapter-1",
        sceneId: "scene-1",
        task: "continue",
        instruction: "Continue the scene.",
        proposalId: "ambiguous-proposal",
        now: "2026-09-02T16:04:00.000Z",
      }),
      /ambiguous across books/,
    );
    assert.equal(providerCalls, 0, "Ambiguous Chapter Card targeting must fail before any AI provider is called.");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

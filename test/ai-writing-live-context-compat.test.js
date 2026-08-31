import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProject } from "../dist/domain/project.js";
import { createCharacter } from "../dist/domain/character-bible.js";
import { createStudioWorkspace, addWorkspaceBook, addWorkspaceChapter, addWorkspaceScene, saveSceneContent } from "../dist/domain/studio-workspace.js";
import { FileProjectStore } from "../dist/infrastructure/file-project-store.js";
import { FileAiProposalStore } from "../dist/infrastructure/file-ai-proposal-store.js";
import { AiWritingCoordinator } from "../dist/application/ai-writing-coordinator.js";
import { AiWritingStudioService } from "../dist/application/ai-writing-studio.js";

function character(id, name, goal, location) {
  return createCharacter({
    id,
    projectId: "project-1",
    now: "2026-08-31T05:30:00.000Z",
    profile: {
      name,
      age: 31,
      birthDate: "1995-04-12",
      physicalAppearance: "Lean and weathered.",
      height: "5 ft 7 in",
      build: "Lean",
      hair: "Dark brown",
      eyes: "Gray-green",
      skin: "Olive",
      clothing: "Dark field jacket",
      voice: "Low and controlled",
      speechPatterns: ["Short declarative sentences"],
      personality: "Guarded investigator",
      values: ["Loyalty"],
      fears: ["Abandonment"],
      secrets: [],
      goals: [goal],
      motivations: ["Protect people"],
      relationships: [],
      history: "Mountain town upbringing.",
      knowledge: ["Old reservoir roads"],
      skills: ["Investigation"],
      weaknesses: ["Distrusts authority"],
      characterArc: "Learns to trust",
      importantObjects: ["Compass"],
      currentEmotionalState: "Watchful",
      currentLocation: location,
      currentInjuries: [],
    },
  });
}

async function fixture(root) {
  const projects = new FileProjectStore(root);
  let workspace = createStudioWorkspace();
  workspace = addWorkspaceBook(workspace, { id: "book-1", title: "Book", kind: "novel", lifecycle: "active", description: "", chapters: [], updatedAt: "2026-08-31T05:30:00.000Z" });
  workspace = addWorkspaceChapter(workspace, "book-1", { id: "chapter-1", number: 1, title: "Chapter One" });
  workspace = addWorkspaceScene(workspace, "book-1", "chapter-1", { id: "scene-1", number: 1, title: "Scene One" });
  workspace = saveSceneContent(workspace, "book-1", "chapter-1", "scene-1", "The original scene.", "2026-08-31T05:30:00.000Z");
  await projects.create({
    ...createProject({ id: "project-1", title: "Live context compatibility" }),
    characters: [
      character("mara-1", "Mara Voss", "Find the missing witness", "North shoreline"),
      character("eli-1", "Eli Ward", "Repair the radio tower", "Ranger station"),
    ],
    studioWorkspace: workspace,
  });
  return projects;
}

test("legacy live Studio generation preserves selected character evidence through governed generation", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-live-context-"));
  try {
    const projects = await fixture(root);
    let providerPrompt = "";
    const coordinator = new AiWritingCoordinator(
      new FileAiProposalStore(join(root, "proposals.json")),
      async (request) => {
        providerPrompt = `${request.system}\n${request.user}`;
        return { provider: "test", model: "fixture", text: "Mara continued along the shoreline." };
      },
    );
    const service = new AiWritingStudioService(projects, coordinator);
    const generated = await service.generate({
      projectId: "project-1",
      bookId: "book-1",
      chapterId: "chapter-1",
      sceneId: "scene-1",
      task: "continue",
      instruction: "Continue the scene without introducing Eli.",
      existingContent: "The original scene.",
      assembledContext: JSON.stringify({
        evidence: [
          { sectionKey: "characters", sourceId: "mara-1", reasons: ["author-selected"] },
        ],
      }),
      sourceMemoryIds: ["mara-1"],
      proposalId: "proposal-live-1",
      now: "2026-08-31T05:31:00.000Z",
    });

    assert.deepEqual(generated.characterContinuity.characters.map((item) => item.characterId), ["mara-1"]);
    assert.deepEqual(generated.proposal.characterContinuity.characters.map((item) => item.characterId), ["mara-1"]);
    assert.match(providerPrompt, /Mara Voss/);
    assert.doesNotMatch(providerPrompt, /Eli Ward/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

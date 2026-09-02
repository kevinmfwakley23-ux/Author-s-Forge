const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { FileProjectStore } = require("../.forge-build/infrastructure/file-project-store.js");
const { StudioStoryMapPlanningService } = require("../.forge-build/application/studio-story-map-planning.js");
const { validateStoryMapPlanningState } = require("../.forge-build/domain/story-map-planning.js");
const { createProject, withProjectStudioWorkspace, withProjectCharacters } = require("../.forge-build/domain/project.js");
const { createStudioWorkspace, createWorkspaceBook, addWorkspaceBook, addWorkspaceChapter, addWorkspaceScene } = require("../.forge-build/domain/studio-workspace.js");
const { createCharacter } = require("../.forge-build/domain/character-bible.js");

function characterProfile(name) {
  return {
    name, age: 30, birthDate: "1996-01-01", physicalAppearance: "Distinctive", height: "average", build: "average", hair: "brown", eyes: "brown", skin: "natural", clothing: "practical", voice: "clear", speechPatterns: ["plain"], personality: "determined", values: ["truth"], fears: ["failure"], secrets: ["none known"], goals: ["finish"], motivations: ["purpose"], relationships: [], history: "Established", knowledge: ["trade"], skills: ["craft"], weaknesses: ["stubborn"], characterArc: "Learns trust", importantObjects: ["notebook"], currentEmotionalState: "focused", currentLocation: "city", currentInjuries: ["none"],
  };
}
function workspace() {
  let state = createStudioWorkspace();
  state = addWorkspaceBook(state, createWorkspaceBook({ id: "book-1", title: "Card Story", kind: "novel", now: "2026-09-02T15:00:00Z" }));
  state = addWorkspaceChapter(state, "book-1", { id: "chapter-1", number: 1, title: "The Locked Door", synopsis: "Mara reaches the archive.", now: "2026-09-02T15:01:00Z" });
  state = addWorkspaceScene(state, "book-1", "chapter-1", { id: "scene-1", number: 1, title: "Arrival", content: "The archive door stayed shut.", now: "2026-09-02T15:02:00Z" });
  return state;
}
async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), "forge-chapter-card-"));
  const store = new FileProjectStore(root);
  let project = withProjectStudioWorkspace(createProject({ id: "card-project", title: "Card Project", now: "2026-09-02T15:00:00Z" }), workspace(), "2026-09-02T15:02:00Z");
  project = withProjectCharacters(project, [createCharacter({ id: "char-mara", projectId: "card-project", profile: characterProfile("Mara"), now: "2026-09-02T15:00:00Z" })], "2026-09-02T15:03:00Z");
  await store.create(project);
  try { await run({ root, store, service: new StudioStoryMapPlanningService(store) }); }
  finally { await rm(root, { recursive: true, force: true }); }
}

test("legacy Story Map planning packages normalize with an empty Chapter Card map", () => {
  const restored = validateStoryMapPlanningState({ formatVersion: 1, sceneAttributes: {}, plotlines: [] });
  assert.deepEqual(restored.chapterCards, {});
});

test("Chapter Card persists every directive field in project.json and survives restart", async () => {
  await fixture(async ({ root, store, service }) => {
    const before = await store.load("card-project");
    const beforeScene = before.studioWorkspace.books[0].chapters[0].scenes[0];
    const result = await service.setChapterCard("card-project", {
      bookId: "book-1",
      chapterId: "chapter-1",
      card: {
        povCharacterIds: ["char-mara"],
        location: "Municipal Archive",
        storyTime: "November 3, 1895 · 9:15 PM",
        emotionalObjective: "Turn confidence into contained dread.",
        plotObjective: "Get Mara inside the restricted archive.",
        characterIds: ["char-mara"],
        requiredEvents: ["Mara tests the service entrance.", "The night clerk notices her."],
        clues: ["A fresh brass key is missing from the board."],
        reveals: ["The archive log was altered that morning."],
        continuityDependencies: ["Mara lost her public entrance ticket in Scene 1."],
        atmosphere: "Cold stone, gaslight, quiet institutional menace.",
        endingHook: "A lock turns from the other side of the records-room door.",
        approximateWordCount: 3200,
        forbiddenDeviations: ["Do not reveal who altered the archive log.", "Mara cannot know about Elias yet."],
      },
      now: "2026-09-02T15:10:00Z",
    });
    const card = result.planning.chapterCards["chapter-1"];
    assert.equal(card.plotObjective, "Get Mara inside the restricted archive.");
    assert.equal(card.approximateWordCount, 3200);
    assert.deepEqual(card.forbiddenDeviations, ["Do not reveal who altered the archive log.", "Mara cannot know about Elias yet."]);
    assert.deepEqual(result.options.locations, ["Municipal Archive"]);

    const persisted = await store.load("card-project");
    assert.ok(persisted.storyMapPlanning.chapterCards["chapter-1"]);
    assert.equal(persisted.studioWorkspace.books[0].chapters[0].title, "The Locked Door");
    assert.equal(persisted.studioWorkspace.books[0].chapters[0].scenes[0].content, beforeScene.content, "Saving planning must not rewrite manuscript prose.");

    const restarted = new StudioStoryMapPlanningService(new FileProjectStore(root));
    const restored = await restarted.snapshot("card-project");
    assert.equal(restored.planning.chapterCards["chapter-1"].endingHook, "A lock turns from the other side of the records-room door.");
  });
});

test("Chapter Card rejects nonexistent chapter and character references before mutation", async () => {
  await fixture(async ({ service }) => {
    await assert.rejects(() => service.setChapterCard("card-project", { bookId: "book-1", chapterId: "missing", card: { plotObjective: "Wrong target" } }), /Chapter "missing" not found/);
    await assert.rejects(() => service.setChapterCard("card-project", { bookId: "book-1", chapterId: "chapter-1", card: { povCharacterIds: ["missing"] } }), /Character "missing" not found/);
    await assert.rejects(() => service.setChapterCard("card-project", { bookId: "book-1", chapterId: "chapter-1", card: { characterIds: ["missing"] } }), /Character "missing" not found/);
    const snapshot = await service.snapshot("card-project");
    assert.deepEqual(snapshot.planning.chapterCards, {});
  });
});

test("removing a Chapter Card preserves the real chapter and scenes", async () => {
  await fixture(async ({ store, service }) => {
    await service.setChapterCard("card-project", { bookId: "book-1", chapterId: "chapter-1", card: { plotObjective: "Reach the archive." } });
    const result = await service.removeChapterCard("card-project", "book-1", "chapter-1");
    assert.deepEqual(result.planning.chapterCards, {});
    const persisted = await store.load("card-project");
    const chapter = persisted.studioWorkspace.books[0].chapters[0];
    assert.equal(chapter.id, "chapter-1");
    assert.deepEqual(chapter.scenes.map((scene) => scene.id), ["scene-1"]);
    assert.equal(chapter.scenes[0].content, "The archive door stayed shut.");
    await assert.rejects(() => service.removeChapterCard("card-project", "book-1", "chapter-1"), /Chapter Card .* not found/);
  });
});

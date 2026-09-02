const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { FileProjectStore } = require("../.forge-build/infrastructure/file-project-store.js");
const { StudioStoryMapPlanningService } = require("../.forge-build/application/studio-story-map-planning.js");
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
  state = addWorkspaceBook(state, createWorkspaceBook({ id: "book-1", title: "Mapped Story", kind: "novel", now: "2026-09-01T18:00:00Z" }));
  state = addWorkspaceChapter(state, "book-1", { id: "chapter-1", number: 1, title: "Opening", now: "2026-09-01T18:01:00Z" });
  state = addWorkspaceScene(state, "book-1", "chapter-1", { id: "scene-1", number: 1, title: "Arrival", now: "2026-09-01T18:02:00Z" });
  state = addWorkspaceScene(state, "book-1", "chapter-1", { id: "scene-2", number: 2, title: "Choice", now: "2026-09-01T18:03:00Z" });
  return state;
}

async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), "forge-story-map-plan-"));
  const store = new FileProjectStore(root);
  let project = withProjectStudioWorkspace(createProject({ id: "map-project", title: "Map Project", now: "2026-09-01T18:00:00Z" }), workspace(), "2026-09-01T18:03:00Z");
  project = withProjectCharacters(project, [createCharacter({ id: "char-1", projectId: "map-project", profile: characterProfile("Mara"), now: "2026-09-01T18:00:00Z" })], "2026-09-01T18:03:00Z");
  await store.create(project);
  try { await run({ root, store, service: new StudioStoryMapPlanningService(store) }); }
  finally { await rm(root, { recursive: true, force: true }); }
}

test("scene POV/location/time/goal/conflict/outcome/emotional beat/tags persist inside the durable project package", async () => {
  await fixture(async ({ root, store, service }) => {
    const result = await service.setSceneAttributes("map-project", {
      bookId: "book-1", chapterId: "chapter-1", sceneId: "scene-1",
      attributes: {
        povCharacterIds: ["char-1"], location: "Union Station", storyTime: "1895-11-03 21:15",
        goal: "Reach the platform unseen.", conflict: "The inspector blocks the gate.", outcome: "Mara loses the ticket.",
        emotionalBeat: "Confidence turns to dread.", tags: ["arrival", "night"],
      },
      now: "2026-09-01T18:10:00Z",
    });
    assert.equal(result.planning.sceneAttributes["scene-1"].location, "Union Station");
    assert.deepEqual(result.planning.sceneAttributes["scene-1"].povCharacterIds, ["char-1"]);
    assert.deepEqual(result.options.locations, ["Union Station"]);
    assert.deepEqual(result.options.tags, ["arrival", "night"]);

    const restarted = new StudioStoryMapPlanningService(new FileProjectStore(root));
    const restored = await restarted.snapshot("map-project");
    assert.equal(restored.planning.sceneAttributes["scene-1"].outcome, "Mara loses the ticket.");
    const project = await store.load("map-project");
    assert.ok(project.storyMapPlanning, "Planning metadata must travel with project.json rather than a disconnected sidecar.");
  });
});

test("plotlines and character arcs link only valid scenes from their own book", async () => {
  await fixture(async ({ service }) => {
    let snapshot = await service.createPlotline("map-project", {
      id: "main-plot", bookId: "book-1", name: "Main Plot", kind: "main", description: "The external story.", sceneIds: ["scene-1"], now: "2026-09-01T18:10:00Z",
    });
    snapshot = await service.createPlotline("map-project", {
      id: "mara-arc", bookId: "book-1", name: "Mara Learns Trust", kind: "character-arc", characterId: "char-1", sceneIds: ["scene-1", "scene-2"], now: "2026-09-01T18:11:00Z",
    });
    assert.equal(snapshot.planning.plotlines.length, 2);
    assert.equal(snapshot.planning.plotlines.find((item) => item.id === "mara-arc").characterId, "char-1");
    await assert.rejects(() => service.createPlotline("map-project", { id: "bad", bookId: "book-1", name: "Bad Arc", kind: "character-arc", characterId: "missing", sceneIds: ["scene-1"] }), /Character "missing" not found/);
    await assert.rejects(() => service.createPlotline("map-project", { id: "bad-scene", bookId: "book-1", name: "Bad Scene", sceneIds: ["missing"] }), /Scene "missing" not found/);
  });
});

test("scene planning editor can assign and reassign plotline membership without rewriting manuscript structure", async () => {
  await fixture(async ({ store, service }) => {
    await service.createPlotline("map-project", { id: "main", bookId: "book-1", name: "Main", kind: "main", sceneIds: [] });
    await service.createPlotline("map-project", { id: "subplot", bookId: "book-1", name: "Subplot", kind: "subplot", sceneIds: [] });
    let snapshot = await service.setSceneAttributes("map-project", {
      bookId: "book-1", chapterId: "chapter-1", sceneId: "scene-2",
      attributes: { location: "Workshop", tags: ["reveal"] }, plotlineIds: ["main", "subplot"],
    });
    assert.ok(snapshot.planning.plotlines.find((item) => item.id === "main").sceneIds.includes("scene-2"));
    assert.ok(snapshot.planning.plotlines.find((item) => item.id === "subplot").sceneIds.includes("scene-2"));
    snapshot = await service.setSceneAttributes("map-project", {
      bookId: "book-1", chapterId: "chapter-1", sceneId: "scene-2",
      attributes: snapshot.planning.sceneAttributes["scene-2"], plotlineIds: ["main"],
    });
    assert.ok(snapshot.planning.plotlines.find((item) => item.id === "main").sceneIds.includes("scene-2"));
    assert.equal(snapshot.planning.plotlines.find((item) => item.id === "subplot").sceneIds.includes("scene-2"), false);
    const project = await store.load("map-project");
    assert.deepEqual(project.studioWorkspace.books[0].chapters[0].scenes.map((scene) => scene.id), ["scene-1", "scene-2"]);
  });
});

test("invalid scope fails before planning mutation", async () => {
  await fixture(async ({ service }) => {
    await assert.rejects(() => service.setSceneAttributes("map-project", { bookId: "book-1", chapterId: "missing", sceneId: "scene-1", attributes: { location: "Wrong" } }), /Chapter "missing" not found/);
    await assert.rejects(() => service.setSceneAttributes("map-project", { bookId: "book-1", chapterId: "chapter-1", sceneId: "missing", attributes: { location: "Wrong" } }), /Scene "missing" not found/);
    const snapshot = await service.snapshot("map-project");
    assert.deepEqual(snapshot.planning.sceneAttributes, {});
  });
});

test("scene planning fails closed instead of sharing metadata across duplicate scene ids", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-story-map-scene-collision-"));
  try {
    const store = new FileProjectStore(root);
    let state = createStudioWorkspace();
    state = addWorkspaceBook(state, createWorkspaceBook({ id: "book-a", title: "Book A", kind: "novel", now: "2026-09-02T16:10:00Z" }));
    state = addWorkspaceChapter(state, "book-a", { id: "chapter-a", number: 1, title: "A", now: "2026-09-02T16:11:00Z" });
    state = addWorkspaceScene(state, "book-a", "chapter-a", { id: "shared-scene", number: 1, title: "A Scene", now: "2026-09-02T16:12:00Z" });
    state = addWorkspaceBook(state, createWorkspaceBook({ id: "book-b", title: "Book B", kind: "novel", now: "2026-09-02T16:13:00Z" }));
    state = addWorkspaceChapter(state, "book-b", { id: "chapter-b", number: 1, title: "B", now: "2026-09-02T16:14:00Z" });
    state = addWorkspaceScene(state, "book-b", "chapter-b", { id: "shared-scene", number: 1, title: "B Scene", now: "2026-09-02T16:15:00Z" });
    const project = withProjectStudioWorkspace(createProject({ id: "scene-collision", title: "Scene Collision", now: "2026-09-02T16:10:00Z" }), state, "2026-09-02T16:15:00Z");
    await store.create(project);
    const service = new StudioStoryMapPlanningService(store);
    await assert.rejects(
      () => service.setSceneAttributes("scene-collision", { bookId: "book-a", chapterId: "chapter-a", sceneId: "shared-scene", attributes: { location: "Only Book A" } }),
      /ambiguous across the workspace/,
    );
    const after = await store.load("scene-collision");
    assert.deepEqual(after.storyMapPlanning?.sceneAttributes ?? {}, {}, "Ambiguous scene planning must not mutate durable Story Map state.");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("plotline update and delete remain deterministic and durable", async () => {
  await fixture(async ({ service }) => {
    await service.createPlotline("map-project", { id: "sub", bookId: "book-1", name: "Mystery", kind: "subplot", sceneIds: ["scene-1"] });
    let snapshot = await service.updatePlotline("map-project", "sub", { name: "Hidden Letter", sceneIds: ["scene-2"], order: 3 });
    const updated = snapshot.planning.plotlines.find((item) => item.id === "sub");
    assert.equal(updated.name, "Hidden Letter");
    assert.equal(updated.order, 3);
    assert.deepEqual(updated.sceneIds, ["scene-2"]);
    snapshot = await service.removePlotline("map-project", "sub");
    assert.equal(snapshot.planning.plotlines.length, 0);
  });
});

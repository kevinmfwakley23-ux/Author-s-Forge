const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { FileProjectStore } = require("../.forge-build/infrastructure/file-project-store.js");
const { StudioSceneCardWorkflowService } = require("../.forge-build/application/studio-scene-card-workflow.js");
const { StudioStoryMapPlanningService } = require("../.forge-build/application/studio-story-map-planning.js");
const { createProject, withProjectStudioWorkspace } = require("../.forge-build/domain/project.js");
const { createChapterCardWorkflowState, approveChapterCard } = require("../.forge-build/domain/chapter-card-workflow.js");
const { createStoryMapPlanningState, createStoryMapChapterCard, setStoryMapChapterCard } = require("../.forge-build/domain/story-map-planning.js");
const { createStudioWorkspace, createWorkspaceBook, addWorkspaceBook, addWorkspaceChapter, addWorkspaceScene, saveSceneContent } = require("../.forge-build/domain/studio-workspace.js");

function workspace({ content = "" } = {}) {
  let state = createStudioWorkspace();
  state = addWorkspaceBook(state, createWorkspaceBook({ id: "book-1", title: "Scene Card Story", kind: "novel", now: "2026-09-02T18:00:00Z" }));
  state = addWorkspaceChapter(state, "book-1", { id: "chapter-1", number: 1, title: "The Archive", synopsis: "Mara reaches the archive.", now: "2026-09-02T18:01:00Z" });
  state = addWorkspaceScene(state, "book-1", "chapter-1", { id: "scene-1", number: 1, title: "Night Entrance", synopsis: "Mara tries the service door.", now: "2026-09-02T18:02:00Z" });
  if (content) state = saveSceneContent(state, "book-1", "chapter-1", "scene-1", content, "2026-09-02T18:03:00Z");
  return state;
}

async function fixture(run, options = {}) {
  const root = await mkdtemp(join(tmpdir(), "forge-scene-card-"));
  const store = new FileProjectStore(root);
  const project = withProjectStudioWorkspace(
    createProject({ id: "scene-card-project", title: "Scene Card Project", now: "2026-09-02T18:00:00Z" }),
    workspace(options),
    "2026-09-02T18:03:00Z",
  );
  await store.create(project);
  try {
    await run({
      root,
      store,
      storyMap: new StudioStoryMapPlanningService(store),
      sceneCards: new StudioSceneCardWorkflowService(store),
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("Scene Card approval binds richer card details to the live Story Map scene and survives restart", async () => {
  await fixture(async ({ root, store, storyMap, sceneCards }) => {
    await storyMap.setSceneAttributes("scene-card-project", {
      bookId: "book-1",
      chapterId: "chapter-1",
      sceneId: "scene-1",
      attributes: {
        location: "Municipal Archive",
        storyTime: "11:40 PM",
        goal: "Enter without waking the night clerk.",
        conflict: "The service door is chained from inside.",
        outcome: "Mara slips into the records corridor.",
        emotionalBeat: "Confidence tightens into dread.",
        tags: ["infiltration", "clue"],
      },
      now: "2026-09-02T18:10:00Z",
    });

    await sceneCards.saveCard("scene-card-project", {
      bookId: "book-1",
      chapterId: "chapter-1",
      sceneId: "scene-1",
      details: {
        purpose: "Move Mara into the restricted archive while planting the missing-key clue.",
        openingSituation: "Mara is alone in the alley behind the archive.",
        closingSituation: "She is inside and hears a lock turn deeper in the building.",
        requiredEvents: ["Mara tests the chained service door.", "She notices a fresh scrape beneath the lock."],
        clues: ["A brass key was recently removed."],
        reveals: [],
        continuityDependencies: ["Mara lost her public entrance ticket earlier."],
        atmosphere: "Cold stone, damp alley, restrained menace.",
        approximateWordCount: 1800,
        forbiddenDeviations: ["Do not reveal who removed the key."],
        notes: "Keep the scene close in Mara's perspective.",
      },
      now: "2026-09-02T18:11:00Z",
    });

    let snapshot = await sceneCards.snapshot("scene-card-project");
    assert.equal(snapshot.cards.length, 1);
    assert.equal(snapshot.cards[0].approved, false);
    assert.equal(snapshot.cards[0].details.approximateWordCount, 1800);

    snapshot = await sceneCards.approveCard("scene-card-project", {
      bookId: "book-1",
      chapterId: "chapter-1",
      sceneId: "scene-1",
      authorApproved: true,
      now: "2026-09-02T18:12:00Z",
    });
    assert.equal(snapshot.cards[0].approved, true);
    assert.match(snapshot.cards[0].cardSha256, /^[a-f0-9]{64}$/);

    const brief = await sceneCards.draftBrief("scene-card-project", { bookId: "book-1", chapterId: "chapter-1", sceneId: "scene-1" });
    assert.equal(brief.task, "draft");
    assert.equal(brief.manuscriptChanged, false);
    assert.match(brief.instruction, /author-approved Scene Card/);
    assert.match(brief.instruction, /Enter without waking the night clerk/);
    assert.match(brief.instruction, /Do not reveal who removed the key/);

    const persisted = await store.load("scene-card-project");
    assert.equal(persisted.studioWorkspace.books[0].chapters[0].scenes[0].content, "", "Scene Card planning and approval must not write manuscript prose.");
    assert.equal(persisted.sceneCardWorkflow.approvals.length, 1);

    const restarted = new StudioSceneCardWorkflowService(new FileProjectStore(root));
    const restored = await restarted.snapshot("scene-card-project");
    assert.equal(restored.cards[0].approved, true);
    assert.equal(restored.cards[0].details.purpose, "Move Mara into the restricted archive while planting the missing-key clue.");
  });
});

test("editing live Story Map planning automatically makes the prior Scene Card approval stale", async () => {
  await fixture(async ({ storyMap, sceneCards }) => {
    await storyMap.setSceneAttributes("scene-card-project", {
      bookId: "book-1", chapterId: "chapter-1", sceneId: "scene-1",
      attributes: { goal: "Get inside." },
      now: "2026-09-02T18:20:00Z",
    });
    await sceneCards.saveCard("scene-card-project", {
      bookId: "book-1", chapterId: "chapter-1", sceneId: "scene-1",
      details: { purpose: "Enter the archive." },
      now: "2026-09-02T18:21:00Z",
    });
    await sceneCards.approveCard("scene-card-project", {
      bookId: "book-1", chapterId: "chapter-1", sceneId: "scene-1", authorApproved: true,
      now: "2026-09-02T18:22:00Z",
    });

    await storyMap.setSceneAttributes("scene-card-project", {
      bookId: "book-1", chapterId: "chapter-1", sceneId: "scene-1",
      attributes: { goal: "Get inside without alerting the clerk." },
      now: "2026-09-02T18:23:00Z",
    });

    const snapshot = await sceneCards.snapshot("scene-card-project");
    assert.equal(snapshot.cards[0].approved, false);
    assert.equal(snapshot.cards[0].approvalStale, true);
    await assert.rejects(
      () => sceneCards.draftBrief("scene-card-project", { bookId: "book-1", chapterId: "chapter-1", sceneId: "scene-1" }),
      /not currently author-approved/,
    );
  });
});

test("changing an approved Chapter Card automatically stales downstream Scene Card approval", async () => {
  await fixture(async ({ store, sceneCards }) => {
    const firstChapterCard = createStoryMapChapterCard({
      plotObjective: "Get Mara inside the restricted archive.",
      requiredEvents: ["Mara reaches the service entrance."],
      endingHook: "A lock turns on the other side.",
    });
    let planning = setStoryMapChapterCard(createStoryMapPlanningState(), "chapter-1", firstChapterCard);
    let chapterWorkflow = approveChapterCard(createChapterCardWorkflowState(), "chapter-1", firstChapterCard, { now: "2026-09-02T18:30:00Z" });
    let project = await store.load("scene-card-project");
    await store.save({ ...project, storyMapPlanning: planning, chapterCardWorkflow: chapterWorkflow });

    await sceneCards.saveCard("scene-card-project", {
      bookId: "book-1", chapterId: "chapter-1", sceneId: "scene-1",
      details: { purpose: "Get Mara through the service entrance without revealing who altered the archive log." },
      now: "2026-09-02T18:31:00Z",
    });
    let snapshot = await sceneCards.approveCard("scene-card-project", {
      bookId: "book-1", chapterId: "chapter-1", sceneId: "scene-1", authorApproved: true,
      now: "2026-09-02T18:32:00Z",
    });
    assert.equal(snapshot.cards[0].approved, true);
    const approvedSceneHash = snapshot.cards[0].cardSha256;

    const changedChapterCard = createStoryMapChapterCard({
      plotObjective: "Get Mara inside, but make the new alarm the chapter's primary obstacle.",
      requiredEvents: ["Mara reaches the service entrance.", "The silent alarm arms before she crosses the threshold."],
      endingHook: "A lock turns on the other side.",
    });
    planning = setStoryMapChapterCard(planning, "chapter-1", changedChapterCard);
    chapterWorkflow = approveChapterCard(chapterWorkflow, "chapter-1", changedChapterCard, { now: "2026-09-02T18:33:00Z" });
    project = await store.load("scene-card-project");
    await store.save({ ...project, storyMapPlanning: planning, chapterCardWorkflow: chapterWorkflow });

    snapshot = await sceneCards.snapshot("scene-card-project");
    assert.equal(snapshot.cards[0].approved, false, "A changed upstream Chapter Card must invalidate the old Scene Card approval.");
    assert.equal(snapshot.cards[0].approvalStale, true);
    assert.notEqual(snapshot.cards[0].cardSha256, approvedSceneHash, "The Scene Card fingerprint must include the exact approved Chapter Card version.");
    await assert.rejects(
      () => sceneCards.draftBrief("scene-card-project", { bookId: "book-1", chapterId: "chapter-1", sceneId: "scene-1" }),
      /not currently author-approved/,
    );
  });
});

test("Scene Card auto-drafting fails closed when the scene already contains author manuscript text", async () => {
  await fixture(async ({ sceneCards }) => {
    await sceneCards.saveCard("scene-card-project", {
      bookId: "book-1", chapterId: "chapter-1", sceneId: "scene-1",
      details: { purpose: "Continue the existing scene." },
    });
    await sceneCards.approveCard("scene-card-project", {
      bookId: "book-1", chapterId: "chapter-1", sceneId: "scene-1", authorApproved: true,
    });
    await assert.rejects(
      () => sceneCards.draftBrief("scene-card-project", { bookId: "book-1", chapterId: "chapter-1", sceneId: "scene-1" }),
      /already contains manuscript text/,
    );
  }, { content: "Mara had already written this opening herself." });
});

test("Scene Card workflow rejects duplicate scene ids because approval state is keyed to authoritative scene identity", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-scene-card-collision-"));
  try {
    const store = new FileProjectStore(root);
    let state = createStudioWorkspace();
    state = addWorkspaceBook(state, createWorkspaceBook({ id: "book-a", title: "A", kind: "novel" }));
    state = addWorkspaceChapter(state, "book-a", { id: "chapter-a", number: 1, title: "A1" });
    state = addWorkspaceScene(state, "book-a", "chapter-a", { id: "shared-scene", number: 1, title: "A Scene" });
    state = addWorkspaceBook(state, createWorkspaceBook({ id: "book-b", title: "B", kind: "novel" }));
    state = addWorkspaceChapter(state, "book-b", { id: "chapter-b", number: 1, title: "B1" });
    state = addWorkspaceScene(state, "book-b", "chapter-b", { id: "shared-scene", number: 1, title: "B Scene" });
    await store.create(withProjectStudioWorkspace(createProject({ id: "collision", title: "Collision" }), state));
    const service = new StudioSceneCardWorkflowService(store);
    await assert.rejects(
      () => service.saveCard("collision", { bookId: "book-a", chapterId: "chapter-a", sceneId: "shared-scene", details: { purpose: "Ambiguous" } }),
      /must be globally unique/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

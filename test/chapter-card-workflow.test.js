import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProject } from "../dist/domain/project.js";
import { createStudioWorkspace, addWorkspaceBook } from "../dist/domain/studio-workspace.js";
import { createStoryMapChapterCard, setStoryMapChapterCard } from "../dist/domain/story-map-planning.js";
import { chapterCardApprovalFor } from "../dist/domain/chapter-card-workflow.js";
import { FileProjectStore } from "../dist/infrastructure/file-project-store.js";
import { StudioChapterCardWorkflowService } from "../dist/application/studio-chapter-card-workflow.js";

const NOW = "2026-09-02T19:00:00.000Z";

async function fixture(root) {
  const store = new FileProjectStore(root);
  let workspace = createStudioWorkspace();
  workspace = addWorkspaceBook(workspace, {
    id: "book-1",
    title: "The Flooded Archive",
    kind: "novel",
    lifecycle: "active",
    description: "A detective searches a flooded city archive for a vanished witness.",
    chapters: [],
    updatedAt: NOW,
  });
  await store.create({ ...createProject({ id: "project-1", title: "Chapter Card Workflow", now: NOW }), studioWorkspace: workspace });
  return store;
}

function providerPlan(overrides = {}) {
  return {
    provider: "ollama",
    model: "fixture-model",
    text: JSON.stringify({
      chapters: [
        {
          number: 1,
          title: "The Waterline",
          povCharacterIds: [],
          location: "Flooded municipal archive",
          storyTime: "Night one",
          emotionalObjective: "Move from confidence to unease.",
          plotObjective: "Get Mara into the archive.",
          characterIds: [],
          requiredEvents: ["The archive generator fails."],
          clues: ["A fresh boot print crosses the silt."],
          reveals: [],
          continuityDependencies: ["The eastern bridge is already closed."],
          atmosphere: "Cold water and failing emergency lights.",
          endingHook: "A light appears below the waterline.",
          approximateWordCount: 2800,
          forbiddenDeviations: ["Do not identify the vanished witness yet."],
        },
        {
          number: 2,
          title: "Below the Stacks",
          povCharacterIds: [],
          location: "Archive basement",
          storyTime: "Later the same night",
          emotionalObjective: "Turn unease into urgency.",
          plotObjective: "Recover the altered ledger before the water rises.",
          characterIds: [],
          requiredEvents: ["Mara finds the ledger cabinet open."],
          clues: [],
          reveals: ["Someone entered after the evacuation order."],
          continuityDependencies: ["The generator failed in Chapter 1."],
          atmosphere: "Darkness, moving water, and metal shelving.",
          endingHook: "Footsteps sound on the stairs above.",
          approximateWordCount: 3000,
          forbiddenDeviations: ["Do not resolve the disappearance."],
        },
      ],
      ...overrides,
    }),
  };
}

test("book description, events, and timeline produce durable unapproved Chapter Cards without manuscript prose", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-chapter-card-workflow-generate-"));
  try {
    const store = await fixture(root);
    let providerRequest;
    const service = new StudioChapterCardWorkflowService(store, async (request) => {
      providerRequest = request;
      return providerPlan();
    });
    const result = await service.generateChapterCards("project-1", {
      bookId: "book-1",
      description: "Mara enters a flooded archive looking for a vanished witness and learns the official timeline was altered.",
      events: ["The archive generator fails.", "Mara finds an altered ledger."],
      timelineDetails: ["The story begins on night one.", "Chapter 2 occurs later the same night."],
      targetChapters: 2,
      now: NOW,
    });

    assert.equal(result.authorApprovalRequired, true);
    assert.equal(result.manuscriptChanged, false);
    assert.equal(result.candidate.status, "pending");
    assert.deepEqual(result.candidate.events, ["The archive generator fails.", "Mara finds an altered ledger."]);
    assert.deepEqual(result.candidate.timelineDetails, ["The story begins on night one.", "Chapter 2 occurs later the same night."]);
    assert.match(providerRequest.user, /KNOWN EVENTS/);
    assert.match(providerRequest.user, /TIMELINE DETAILS/);

    const project = await store.load("project-1");
    const book = project.studioWorkspace.books[0];
    assert.equal(book.chapters.length, 2, "Generated planning should create durable chapter shells so the author can edit cards in Story Map.");
    assert.equal(book.chapters.flatMap((chapter) => chapter.scenes).length, 0, "Chapter Card generation must never write manuscript scenes or prose.");
    assert.equal(Object.keys(project.storyMapPlanning.chapterCards).length, 2);
    assert.equal(project.chapterCardWorkflow.candidates.length, 1);
    assert.equal(project.chapterCardWorkflow.approvals.length, 0);
    assert.equal((await service.snapshot("project-1")).validApprovals.length, 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("candidate approval hashes the author's current edited cards and later edits invalidate only the changed approval", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-chapter-card-workflow-approve-"));
  try {
    const store = await fixture(root);
    const service = new StudioChapterCardWorkflowService(store, async () => providerPlan());
    const generated = await service.generateChapterCards("project-1", {
      bookId: "book-1",
      description: "A flooded archive mystery.",
      targetChapters: 2,
      now: NOW,
    });

    let project = await store.load("project-1");
    const firstChapter = project.studioWorkspace.books[0].chapters[0];
    const secondChapter = project.studioWorkspace.books[0].chapters[1];
    const original = project.storyMapPlanning.chapterCards[firstChapter.id];
    const authorEdited = createStoryMapChapterCard({ ...original, endingHook: "AUTHOR EDIT: the basement door opens by itself." });
    const editedPlanning = setStoryMapChapterCard(project.storyMapPlanning, firstChapter.id, authorEdited);
    await store.save({ ...project, storyMapPlanning: editedPlanning });

    await service.approveCandidate("project-1", generated.candidate.id, { authorApproved: true, now: "2026-09-02T19:05:00.000Z" });
    project = await store.load("project-1");
    assert.ok(chapterCardApprovalFor(project.chapterCardWorkflow, firstChapter.id, project.storyMapPlanning.chapterCards[firstChapter.id]), "Approval must bind to the author's edited card, not the original AI candidate bytes.");
    assert.ok(chapterCardApprovalFor(project.chapterCardWorkflow, secondChapter.id, project.storyMapPlanning.chapterCards[secondChapter.id]));
    assert.equal((await service.snapshot("project-1")).validApprovals.length, 2);

    const changedAgain = createStoryMapChapterCard({ ...project.storyMapPlanning.chapterCards[firstChapter.id], endingHook: "SECOND AUTHOR EDIT after approval." });
    await store.save({ ...project, storyMapPlanning: setStoryMapChapterCard(project.storyMapPlanning, firstChapter.id, changedAgain) });
    const snapshot = await service.snapshot("project-1");
    assert.equal(snapshot.validApprovals.length, 1, "Editing an approved card must invalidate only that card's exact-version approval.");
    assert.equal(snapshot.validApprovals[0].chapterId, secondChapter.id);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("malformed AI Chapter Card output fails before any project planning mutation", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-chapter-card-workflow-invalid-"));
  try {
    const store = await fixture(root);
    const service = new StudioChapterCardWorkflowService(store, async () => ({
      provider: "ollama",
      model: "fixture-model",
      text: JSON.stringify({ chapters: [{ ...JSON.parse(providerPlan().text).chapters[0], povCharacterIds: ["invented-character"] }] }),
    }));
    await assert.rejects(
      () => service.generateChapterCards("project-1", { bookId: "book-1", description: "A flooded archive mystery.", targetChapters: 1, now: NOW }),
      /unknown pov character id "invented-character"/i,
    );
    const project = await store.load("project-1");
    assert.equal(project.studioWorkspace.books[0].chapters.length, 0);
    assert.equal(project.storyMapPlanning, undefined);
    assert.equal(project.chapterCardWorkflow, undefined);
  } finally { await rm(root, { recursive: true, force: true }); }
});

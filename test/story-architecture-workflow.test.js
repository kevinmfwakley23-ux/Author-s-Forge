import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProject } from "../dist/domain/project.js";
import { FileProjectStore } from "../dist/infrastructure/file-project-store.js";
import { StudioStoryArchitectureWorkflowService } from "../dist/application/studio-story-architecture-workflow.js";

function providerPlan() {
  return {
    premise: "A parent investigates a disappearance while a winter storm seals the mountain city from outside help.",
    themes: ["trust", "grief", "memory"],
    audience: "Adult psychological-thriller readers.",
    genreExpectations: ["Escalating suspense", "Grounded emotional stakes"],
    canonCandidates: ["The disappearance occurred three days before the opening."],
    characterCandidates: ["The searching parent", "A witness with divided loyalties"],
    locations: ["Mountain city", "Civic records office"],
    timelineConsiderations: ["Track storm closures and travel time exactly."],
    assumptions: ["The witness is not yet confirmed reliable."],
    chapterPlan: [
      { number: 1, title: "The Closed Road", summary: "Establish the disappearance and isolation.", requiredEvents: ["The last road closes."], continuityDependencies: [] },
      { number: 2, title: "The Record", summary: "Expose contradictory evidence.", requiredEvents: ["A timestamp conflicts with the witness statement."], continuityDependencies: ["The road is already closed."] },
    ],
    scenePlan: [
      { chapterNumber: 1, title: "Roadblock", summary: "The parent learns the city is sealed.", goal: "Leave the city for help.", conflict: "The road is closed.", outcome: "The parent must investigate locally." },
      { chapterNumber: 2, title: "Records Desk", summary: "A civic record contradicts the accepted timeline.", goal: "Confirm the last known time.", conflict: "The record and witness disagree.", outcome: "The timeline becomes uncertain." },
    ],
    unresolvedQuestions: ["Why did the witness lie?"],
    productionRisks: ["Accidental knowledge leakage across the timeline."],
  };
}

async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), "forge-story-architecture-"));
  try {
    const store = new FileProjectStore(root);
    await store.create(createProject({ id: "project-1", title: "Architecture Story", now: "2026-09-02T20:00:00Z" }));
    let providerCalls = 0;
    const service = new StudioStoryArchitectureWorkflowService(store, async () => {
      providerCalls += 1;
      return { provider: "test-provider", model: "architecture-fixture", text: JSON.stringify(providerPlan()) };
    });
    await run({ root, store, service, providerCalls: () => providerCalls });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("Story Architecture is durable, candidate-only, and exact approval survives restart", async () => {
  await fixture(async ({ root, store, service, providerCalls }) => {
    const generated = await service.generate("project-1", {
      idea: "A parent searches for the truth behind a disappearance during a winter lockdown.",
      kind: "psychological-thriller",
      targetChapters: 2,
      now: "2026-09-02T20:01:00Z",
    });
    assert.equal(providerCalls(), 1);
    assert.equal(generated.authorApprovalRequired, true);
    assert.equal(generated.manuscriptChanged, false);
    assert.equal(generated.canonChanged, false);
    assert.match(generated.planSha256, /^[a-f0-9]{64}$/u);

    let snapshot = await service.snapshot("project-1");
    assert.equal(snapshot.candidates.length, 1);
    assert.equal(snapshot.candidates[0].approved, false);
    await assert.rejects(() => service.chapterCardSeed("project-1", generated.candidate.id), /not currently author-approved/);

    snapshot = await service.approve("project-1", generated.candidate.id, { authorApproved: true, now: "2026-09-02T20:02:00Z" });
    assert.equal(snapshot.candidates[0].approved, true);
    assert.equal(snapshot.approvedArchitectureId, generated.candidate.id);

    const seed = await service.chapterCardSeed("project-1", generated.candidate.id);
    assert.equal(seed.targetChapters, 2);
    assert.equal(seed.kind, "psychological-thriller");
    assert.match(seed.description, /APPROVED STORY ARCHITECTURE/);
    assert.match(seed.description, /not automatically Project Brain canon/);
    assert.ok(seed.events.some((item) => /last road closes/i.test(item)));
    assert.deepEqual(seed.timelineDetails, ["Track storm closures and travel time exactly."]);

    const project = await store.load("project-1");
    assert.equal(project.studioWorkspace, undefined, "Story Architecture must not create manuscript structure by itself.");
    assert.equal(project.memories.length, 0, "Story Architecture approval must not silently promote canon candidates into Project Brain.");

    const restarted = new StudioStoryArchitectureWorkflowService(new FileProjectStore(root), async () => { throw new Error("provider should not be needed for restart read"); });
    const restored = await restarted.snapshot("project-1");
    assert.equal(restored.candidates[0].approved, true);
    assert.equal(restored.candidates[0].plan.premise, providerPlan().premise);
  });
});

test("editing approved Story Architecture makes approval stale and blocks Chapter Card handoff", async () => {
  await fixture(async ({ service }) => {
    const generated = await service.generate("project-1", {
      idea: "A parent searches for the truth behind a disappearance during a winter lockdown.",
      targetChapters: 2,
      now: "2026-09-02T20:10:00Z",
    });
    await service.approve("project-1", generated.candidate.id, { authorApproved: true, now: "2026-09-02T20:11:00Z" });
    const edited = { ...providerPlan(), premise: "A parent investigates the disappearance after discovering the accepted timeline cannot be true." };
    const snapshot = await service.updatePlan("project-1", generated.candidate.id, edited, "2026-09-02T20:12:00Z");
    assert.equal(snapshot.candidates[0].approved, false);
    assert.equal(snapshot.candidates[0].approvalStale, true);
    await assert.rejects(() => service.chapterCardSeed("project-1", generated.candidate.id), /not currently author-approved/);
  });
});

test("Story Architecture rejects malformed or wrong-sized provider plans without saving them", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-story-architecture-invalid-"));
  try {
    const store = new FileProjectStore(root);
    await store.create(createProject({ id: "invalid-project", title: "Invalid Architecture" }));
    const malformed = new StudioStoryArchitectureWorkflowService(store, async () => ({ provider: "test", model: "bad", text: "not json" }));
    await assert.rejects(() => malformed.generate("invalid-project", { idea: "A valid idea." }), /not valid JSON/);
    let project = await store.load("invalid-project");
    assert.equal(project.storyArchitectureWorkflow, undefined);

    const wrongCount = new StudioStoryArchitectureWorkflowService(store, async () => ({ provider: "test", model: "bad-count", text: JSON.stringify(providerPlan()) }));
    await assert.rejects(() => wrongCount.generate("invalid-project", { idea: "A valid idea.", targetChapters: 3 }), /returned 2 architecture chapters/);
    project = await store.load("invalid-project");
    assert.equal(project.storyArchitectureWorkflow, undefined);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

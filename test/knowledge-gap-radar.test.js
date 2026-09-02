const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { FileProjectStore } = require("../.forge-build/infrastructure/file-project-store.js");
const { FileKnowledgeGapStore } = require("../.forge-build/infrastructure/file-knowledge-gap-store.js");
const { StudioKnowledgeGapRadarService } = require("../.forge-build/application/knowledge-gap-radar.js");
const { createProject, withProjectStudioWorkspace } = require("../.forge-build/domain/project.js");
const { createStudioWorkspace, createWorkspaceBook, addWorkspaceBook, addWorkspaceChapter, addWorkspaceScene, saveSceneContent } = require("../.forge-build/domain/studio-workspace.js");

function detector() {
  return async () => ({
    provider: "test-real-boundary",
    model: "detector-model",
    requestId: "detector-request",
    gaps: [
      {
        domain: "historical-period",
        question: "What street-lighting technology was actually in use in this city in 1895?",
        researchedBecause: "The scene should not casually use infrastructure that did not exist yet.",
        basis: "The manuscript places the character under a street lamp in an explicitly dated 1895 scene.",
        priority: "high",
      },
      {
        domain: "occupation",
        question: "What tools would a working stone mason plausibly carry for this task in 1895?",
        researchedBecause: "The work sequence uses named tools and should be grounded before revision.",
        basis: "The scene describes a stone mason beginning work but does not establish the period-appropriate tool set.",
        priority: "medium",
      },
    ],
  });
}

function workspace() {
  let state = createStudioWorkspace();
  state = addWorkspaceBook(state, createWorkspaceBook({ id: "book-1", title: "1895 Story", kind: "novel", description: "Historical fiction.", now: "2026-09-01T18:00:00Z" }));
  state = addWorkspaceChapter(state, "book-1", { id: "chapter-1", number: 1, title: "Night Work", synopsis: "A mason walks home.", now: "2026-09-01T18:01:00Z" });
  state = addWorkspaceScene(state, "book-1", "chapter-1", { id: "scene-1", number: 1, title: "Street Lamp", synopsis: "He stops beneath a street lamp.", now: "2026-09-01T18:02:00Z" });
  return saveSceneContent(state, "book-1", "chapter-1", "scene-1", "In 1895, Eli stopped beneath the street lamp and set down his stone-working tools.", "2026-09-01T18:03:00Z");
}

async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), "forge-gap-radar-"));
  const projects = new FileProjectStore(root);
  const gapPath = join(root, "knowledge-gaps.json");
  const gaps = new FileKnowledgeGapStore(gapPath);
  const project = withProjectStudioWorkspace(createProject({ id: "gap-project", title: "Gap Project", now: "2026-09-01T18:00:00Z" }), workspace(), "2026-09-01T18:03:00Z");
  await projects.create(project);
  try { await run({ root, projects, gaps, gapPath }); }
  finally { await rm(root, { recursive: true, force: true }); }
}

test("Radar persists research questions outside Project Brain and preserves provider provenance", async () => {
  await fixture(async ({ projects, gaps, gapPath }) => {
    const radar = new StudioKnowledgeGapRadarService(projects, gaps, detector(), { research: async () => { throw new Error("not used"); } });
    const result = await radar.scan("gap-project", { maxGaps: 6, bookId: "book-1", chapterId: "chapter-1", sceneId: "scene-1" });
    assert.equal(result.detectedCount, 2);
    assert.equal(result.persistedCount, 2);
    assert.equal(result.duplicateCount, 0);
    assert.equal(result.canonEligible, false);
    assert.equal(result.evidenceRequired, true);
    assert.equal(result.gaps[0].status, "open");
    assert.equal(result.gaps[0].source, "ai");
    assert.equal(result.gaps[0].provider, "test-real-boundary");
    assert.equal(result.gaps[0].model, "detector-model");
    assert.equal(result.gaps[0].sceneId, "scene-1");
    assert.deepEqual(result.gaps[0].researchMemoryIds, []);

    const project = await projects.load("gap-project");
    assert.equal(project.memories.length, 0, "Gap hypotheses must never enter Project Brain memory.");

    const restarted = new FileKnowledgeGapStore(gapPath);
    const restored = await restarted.list("gap-project");
    assert.equal(restored.length, 2, "Gap queue must survive process restart.");
    assert.ok(restored.every((gap) => gap.status === "open"));
  });
});

test("Radar suppresses duplicate open/researched questions instead of spamming the author", async () => {
  await fixture(async ({ projects, gaps }) => {
    const radar = new StudioKnowledgeGapRadarService(projects, gaps, detector(), { research: async () => { throw new Error("not used"); } });
    await radar.scan("gap-project", { maxGaps: 6 });
    const second = await radar.scan("gap-project", { maxGaps: 6 });
    assert.equal(second.detectedCount, 2);
    assert.equal(second.persistedCount, 0);
    assert.equal(second.duplicateCount, 2);
    assert.equal((await radar.list("gap-project")).length, 2);
  });
});

test("author can dismiss a hypothesis and dismissal survives reload", async () => {
  await fixture(async ({ projects, gaps, gapPath }) => {
    const radar = new StudioKnowledgeGapRadarService(projects, gaps, detector(), { research: async () => { throw new Error("not used"); } });
    const [gap] = (await radar.scan("gap-project", { maxGaps: 6 })).gaps;
    const dismissed = await radar.dismiss("gap-project", gap.id, "This detail will be removed from the scene.");
    assert.equal(dismissed.status, "dismissed");
    assert.match(dismissed.dismissedReason, /removed from the scene/);
    const restarted = new FileKnowledgeGapStore(gapPath);
    assert.equal((await restarted.get("gap-project", gap.id)).status, "dismissed");
  });
});

test("source-backed research is the only path that marks a gap researched", async () => {
  await fixture(async ({ projects, gaps }) => {
    let shouldFail = true;
    const liveResearch = {
      async research(_projectId, input) {
        assert.match(input.question, /street-lighting technology/);
        if (shouldFail) throw new Error("hosted source verification unavailable");
        return {
          record: { claims: [{ claim: "verified" }] },
          persistedMemoryIds: ["research-memory-1"],
          sourceBacked: true,
          canonEligible: false,
          authority: "working",
          provider: "openai",
          model: "research-model",
          spendPolicy: "unrestricted",
        };
      },
    };
    const oneGapDetector = async () => ({ ...(await detector()()), gaps: [(await detector()()).gaps[0]] });
    const radar = new StudioKnowledgeGapRadarService(projects, gaps, oneGapDetector, liveResearch);
    const [gap] = (await radar.scan("gap-project", { maxGaps: 6 })).gaps;

    await assert.rejects(() => radar.researchGap("gap-project", gap.id), /source verification unavailable/);
    assert.equal((await gaps.get("gap-project", gap.id)).status, "open", "Failed research must leave the gap open.");
    assert.deepEqual((await gaps.get("gap-project", gap.id)).researchMemoryIds, []);

    shouldFail = false;
    const completed = await radar.researchGap("gap-project", gap.id);
    assert.equal(completed.gap.status, "researched");
    assert.deepEqual(completed.gap.researchMemoryIds, ["research-memory-1"]);
    assert.equal(completed.research.sourceBacked, true);
    await assert.rejects(() => radar.researchGap("gap-project", gap.id), /already been researched/);
  });
});

test("Radar validates scope against the real Studio workspace before calling AI", async () => {
  await fixture(async ({ projects, gaps }) => {
    let calls = 0;
    const radar = new StudioKnowledgeGapRadarService(projects, gaps, async () => { calls += 1; return detector()(); }, { research: async () => { throw new Error("not used"); } });
    await assert.rejects(() => radar.scan("gap-project", { bookId: "book-1", chapterId: "missing" }), /Chapter "missing" not found/);
    await assert.rejects(() => radar.scan("gap-project", { sceneId: "scene-1" }), /scene scope requires book and chapter ids/);
    assert.equal(calls, 0, "Invalid scope must fail before spending AI resources.");
  });
});

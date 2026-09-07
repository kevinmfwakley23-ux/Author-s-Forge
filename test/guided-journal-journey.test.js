const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const { FileGuidedJournalJourneyStore } = require("../dist/infrastructure/file-guided-journal-journey-store.js");
const { GuidedJournalJourneyService } = require("../dist/application/guided-journal-guided-journeys.js");
const { createGuidedJournalPersonalizationQuestionnaire } = require("../dist/domain/guided-journal-personalization.js");
const { createPersonalizedGuidedJourney } = require("../dist/application/guided-journal-personalized-journeys.js");

const library = [
  { id: "remember-1", category: "remember", text: "What memory still makes you grateful?", tags: ["gratitude", "depth:gentle"], enabled: true },
  { id: "discover-1", category: "discover", text: "What are you learning about yourself?", tags: ["self-discovery", "depth:deep"], enabled: true },
  { id: "challenge-1", category: "challenge", text: "What challenge proved your resilience?", tags: ["resilience", "depth:deep"], enabled: true },
  { id: "create-1", category: "create", text: "What would you make if fear disappeared?", tags: ["creativity"], enabled: true },
  { id: "become-1", category: "become", text: "Who are you becoming through your habits?", tags: ["habits", "confidence"], enabled: true },
  { id: "hope-1", category: "hope", text: "What future are you willing to work toward?", tags: ["purpose", "planning"], enabled: true },
];

test("Guided Journal journey stays pinned to an immutable pack and survives restart", async () => {
  const dir = await mkdtemp(join(tmpdir(), "forge-journal-journey-"));
  try {
    const path = join(dir, "journeys.json");
    const first = new GuidedJournalJourneyService(new FileGuidedJournalJourneyStore(path));
    const pack = await first.createPack({
      id: "pack-1",
      title: "My six-question journey",
      mode: "deterministic-shuffle",
      source: "user",
      promptIds: library.map((prompt) => prompt.id),
      promptLibrary: library,
      now: "2026-09-07T16:00:00.000Z",
    });
    const started = await first.start({ id: "journey-1", projectId: "project-1", packId: pack.id, seed: "fixed-seed", now: "2026-09-07T16:01:00.000Z" });
    const firstPrompt = await first.next(started.id);
    assert.ok(firstPrompt);
    await first.complete(started.id, firstPrompt.id, "2026-09-07T16:02:00.000Z");

    const second = new GuidedJournalJourneyService(new FileGuidedJournalJourneyStore(path));
    const restored = await second.getJourney("journey-1");
    assert.equal(restored.packId, "pack-1");
    assert.equal(restored.packVersion, 1);
    assert.deepEqual(restored.completedPromptIds, [firstPrompt.id]);
    const status = await second.status("journey-1");
    assert.equal(status.completedPrompts, 1);
    assert.equal(status.remainingPrompts, 5);
    assert.notEqual((await second.next("journey-1")).id, firstPrompt.id);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("personalized journey uses questionnaire evidence without mutating the master library", () => {
  const questionnaire = createGuidedJournalPersonalizationQuestionnaire({
    id: "q-1",
    goals: [{ goal: "resilience", weight: 5 }, { goal: "confidence", weight: 4 }],
    preferredCategories: ["challenge", "become"],
    preferredTags: ["resilience"],
    reflectionDepth: "deep",
    variety: "balanced",
    promptCount: 3,
    seed: "personalized-seed",
    now: "2026-09-07T16:10:00.000Z",
  });
  const before = JSON.stringify(library);
  const result = createPersonalizedGuidedJourney({
    projectId: "project-1",
    journeyId: "journey-personal",
    packId: "pack-personal",
    title: "Resilience and Confidence",
    questionnaire,
    promptLibrary: library,
    now: "2026-09-07T16:11:00.000Z",
  });

  assert.equal(result.pack.prompts.length, 3);
  assert.equal(result.journey.packFingerprint, result.pack.sourceLibraryFingerprint);
  assert.equal(result.personalization.selectedPromptIds.length, 3);
  assert.ok(result.personalization.evidence.some((entry) => entry.promptId === "challenge-1"));
  assert.equal(JSON.stringify(library), before);
});

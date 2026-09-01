import test from "node:test";
import assert from "node:assert/strict";
import {
  JOURNAL_CATEGORIES,
  generateGuidedJournal,
} from "../dist/domain/guided-journal.js";

function promptLibrary(perCategory = 4) {
  return JOURNAL_CATEGORIES.flatMap((category) =>
    Array.from({ length: perCategory }, (_, index) => ({
      id: `${category}-${index + 1}`,
      category,
      text: `${category} prompt ${index + 1}`,
      tags: [category],
      enabled: true,
    })),
  );
}

const covers = [
  { id: "cover-1", text: "Ask a better question.", tags: ["reflection"], enabled: true },
  { id: "cover-2", text: "One question can change a day.", tags: ["growth"], enabled: true },
];

test("guided journal generation is deterministic for the same seed", () => {
  const input = {
    id: "journal-1",
    projectId: "project-1",
    title: "The Better Question",
    seed: "edition-001",
    promptCount: 12,
    promptLibrary: promptLibrary(),
    coverStatements: covers,
    pageStyle: "guided-response",
    now: "2026-08-31T20:00:00.000Z",
  };
  const first = generateGuidedJournal(input);
  const second = generateGuidedJournal(input);
  assert.deepEqual(first.sourcePromptIds, second.sourcePromptIds);
  assert.deepEqual(first.coverStatement, second.coverStatement);
  assert.equal(first.generatedAt, second.generatedAt);
});

test("guided journal balances all six canonical categories", () => {
  const journal = generateGuidedJournal({
    id: "journal-balanced",
    projectId: "project-1",
    title: "Balanced Journal",
    seed: "balance",
    promptCount: 18,
    promptLibrary: promptLibrary(),
    includeCoverStatement: false,
  });
  assert.equal(new Set(journal.sourcePromptIds).size, 18);
  for (const category of JOURNAL_CATEGORIES) assert.equal(journal.categoryCounts[category], 3);
});

test("guided journal respects author-controlled prompt pools and exclusions", () => {
  const library = promptLibrary();
  const journal = generateGuidedJournal({
    id: "journal-pool",
    projectId: "project-1",
    title: "Focused Journal",
    seed: "pool",
    promptCount: 5,
    promptLibrary: library,
    pool: {
      categories: ["remember", "hope"],
      excludedPromptIds: ["remember-1"],
    },
  });
  assert.ok(journal.prompts.every((page) => page.category === "remember" || page.category === "hope"));
  assert.ok(!journal.sourcePromptIds.includes("remember-1"));
});

test("guided journal prevents repeated prompts within an edition", () => {
  const journal = generateGuidedJournal({
    id: "journal-unique",
    projectId: "project-1",
    title: "Unique Journal",
    seed: "unique",
    promptCount: 20,
    promptLibrary: promptLibrary(),
  });
  assert.equal(journal.sourcePromptIds.length, 20);
  assert.equal(new Set(journal.sourcePromptIds).size, 20);
});

test("guided journal refuses impossible unique prompt requests", () => {
  assert.throws(() => generateGuidedJournal({
    id: "journal-too-large",
    projectId: "project-1",
    title: "Impossible Journal",
    seed: "too-large",
    promptCount: 25,
    promptLibrary: promptLibrary(),
  }), /only 24 are eligible/);
});

test("guided journal preserves page style and response page count", () => {
  const journal = generateGuidedJournal({
    id: "journal-layout",
    projectId: "project-1",
    title: "Writing Space",
    seed: "layout",
    promptCount: 6,
    promptLibrary: promptLibrary(),
    pageStyle: "lightly-lined",
    responsePagesPerPrompt: 3,
  });
  assert.ok(journal.prompts.every((page) => page.pageStyle === "lightly-lined"));
  assert.ok(journal.prompts.every((page) => page.responsePages === 3));
});

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JOURNAL_CATEGORIES } from "../dist/domain/guided-journal.js";
import { FileGuidedJournalStore } from "../dist/infrastructure/file-guided-journal-store.js";
import { GuidedJournalOfficeService } from "../dist/application/guided-journal-office.js";

function promptLibrary(perCategory = 5) {
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

test("Guided Journal Office persists editions and prevents cross-edition prompt repeats", async () => {
  const dir = await mkdtemp(join(tmpdir(), "forge-journal-"));
  try {
    const path = join(dir, "journals.json");
    const service = new GuidedJournalOfficeService(new FileGuidedJournalStore(path));
    const common = {
      projectId: "project-1",
      title: "The Better Question",
      promptCount: 6,
      promptLibrary: promptLibrary(),
      includeCoverStatement: false,
      now: "2026-08-31T20:00:00.000Z",
    };
    const first = await service.createEdition({ ...common, id: "edition-1", seed: "one" });
    const second = await service.createEdition({ ...common, id: "edition-2", seed: "two", now: "2026-08-31T20:01:00.000Z" });
    assert.equal(first.sourcePromptIds.length, 6);
    assert.equal(second.sourcePromptIds.length, 6);
    assert.equal(first.sourcePromptIds.some((id) => second.sourcePromptIds.includes(id)), false);

    const restarted = new GuidedJournalOfficeService(new FileGuidedJournalStore(path));
    const history = await restarted.listEditions("project-1");
    assert.equal(history.length, 2);
    assert.equal(history[0].id, "edition-2");
    assert.deepEqual((await restarted.getEdition("project-1", "edition-1")).sourcePromptIds, first.sourcePromptIds);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("Guided Journal Office allows explicit repeat policy override", async () => {
  const dir = await mkdtemp(join(tmpdir(), "forge-journal-repeat-"));
  try {
    const service = new GuidedJournalOfficeService(new FileGuidedJournalStore(join(dir, "journals.json")));
    const common = {
      projectId: "project-1",
      title: "Reusable Pool",
      promptCount: 6,
      promptLibrary: promptLibrary(1),
      seed: "same",
      includeCoverStatement: false,
      now: "2026-08-31T20:00:00.000Z",
    };
    const first = await service.createEdition({ ...common, id: "edition-1" });
    const second = await service.createEdition({ ...common, id: "edition-2", noRepeatAcrossEditions: false, now: "2026-08-31T20:01:00.000Z" });
    assert.deepEqual(second.sourcePromptIds, first.sourcePromptIds);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

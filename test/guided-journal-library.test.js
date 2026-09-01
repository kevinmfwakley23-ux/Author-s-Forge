const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const { join } = require("node:path");
const { tmpdir } = require("node:os");

const { FileGuidedJournalLibraryStore } = require("../dist/infrastructure/file-guided-journal-library-store.js");
const { GuidedJournalLibraryService } = require("../dist/application/guided-journal-library.js");

function prompt(id, category = "remember") { return { id, category, text: `Prompt ${id}?`, tags: ["test"], enabled: true }; }
function statement(id) { return { id, text: `Statement ${id}`, tags: ["cover"], enabled: true }; }

test("Guided Journal library persists prompts and cover statements across restart", async () => {
  const dir = await mkdtemp(join(tmpdir(), "forge-journal-library-"));
  try {
    const path = join(dir, "library.json");
    const first = new GuidedJournalLibraryService(new FileGuidedJournalLibraryStore(path));
    await first.upsertPrompts("project-1", [prompt("p1"), prompt("p2", "hope")], "2026-09-01T00:00:00.000Z");
    await first.upsertCoverStatements("project-1", [statement("s1")], "2026-09-01T00:01:00.000Z");

    const second = new GuidedJournalLibraryService(new FileGuidedJournalLibraryStore(path));
    const restored = await second.get("project-1");
    assert.deepEqual(restored.prompts.map((item) => item.id).sort(), ["p1", "p2"]);
    assert.deepEqual(restored.coverStatements.map((item) => item.id), ["s1"]);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("author can disable, replace and remove library entries", async () => {
  const dir = await mkdtemp(join(tmpdir(), "forge-journal-library-"));
  try {
    const path = join(dir, "library.json");
    const service = new GuidedJournalLibraryService(new FileGuidedJournalLibraryStore(path));
    await service.upsertPrompts("project-1", [prompt("p1")]);
    let state = await service.setPromptEnabled("project-1", "p1", false);
    assert.equal(state.prompts[0].enabled, false);
    state = await service.upsertPrompts("project-1", [{ ...prompt("p1"), text: "Author revised question?", tags: ["revised"] }]);
    assert.equal(state.prompts[0].text, "Author revised question?");
    assert.equal(state.prompts[0].enabled, true);
    state = await service.removePrompt("project-1", "p1");
    assert.equal(state.prompts.length, 0);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("libraries remain isolated by project", async () => {
  const dir = await mkdtemp(join(tmpdir(), "forge-journal-library-"));
  try {
    const path = join(dir, "library.json");
    const service = new GuidedJournalLibraryService(new FileGuidedJournalLibraryStore(path));
    await service.upsertPrompts("project-a", [prompt("a1")]);
    await service.upsertPrompts("project-b", [prompt("b1")]);
    assert.deepEqual((await service.get("project-a")).prompts.map((item) => item.id), ["a1"]);
    assert.deepEqual((await service.get("project-b")).prompts.map((item) => item.id), ["b1"]);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

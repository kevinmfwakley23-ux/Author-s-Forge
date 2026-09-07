const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const { join } = require("node:path");
const { tmpdir } = require("node:os");

const { FileGuidedJournalLibraryStore } = require("../dist/infrastructure/file-guided-journal-library-store.js");
const { GuidedJournalLibraryService } = require("../dist/application/guided-journal-library.js");
const { GuidedJournalPromptImportService } = require("../dist/application/guided-journal-prompt-import.js");

async function withService(run) {
  const dir = await mkdtemp(join(tmpdir(), "forge-journal-import-"));
  try {
    const library = new GuidedJournalLibraryService(new FileGuidedJournalLibraryStore(join(dir, "library.json")));
    await run(library, new GuidedJournalPromptImportService(library));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("Guided Journal bulk import accepts plain text and skips duplicate question text", async () => {
  await withService(async (library, importer) => {
    await library.upsertPrompts("project-1", [{ id: "existing", category: "remember", text: "What made you smile today?", tags: [], enabled: true }]);
    const result = await importer.import({
      projectId: "project-1",
      format: "text",
      defaultCategory: "hope",
      content: "What made you smile today?\nWhat are you looking forward to tomorrow?\n",
    });
    assert.equal(result.imported.length, 1);
    assert.equal(result.imported[0].category, "hope");
    assert.equal(result.imported[0].text, "What are you looking forward to tomorrow?");
    assert.deepEqual(result.duplicateTextsSkipped, ["What made you smile today?"]);
    assert.equal(result.totalLibraryPrompts, 2);
  });
});

test("Guided Journal bulk import parses CSV metadata and quoted commas", async () => {
  await withService(async (_library, importer) => {
    const result = await importer.import({
      projectId: "project-1",
      format: "csv",
      content: 'id,category,text,tags,enabled\nq-1,discover,"What did you learn, today?","learning;daily",true\nq-2,challenge,"What will you change?",growth,false\n',
    });
    assert.equal(result.imported.length, 2);
    assert.equal(result.imported[0].id, "q-1");
    assert.equal(result.imported[0].text, "What did you learn, today?");
    assert.deepEqual(result.imported[0].tags, ["learning", "daily"]);
    assert.equal(result.imported[1].enabled, false);
  });
});

test("Guided Journal bulk import accepts JSON arrays and resolves colliding ids", async () => {
  await withService(async (library, importer) => {
    await library.upsertPrompts("project-1", [{ id: "shared-id", category: "remember", text: "Existing question?", tags: [], enabled: true }]);
    const result = await importer.import({
      projectId: "project-1",
      format: "json",
      defaultCategory: "create",
      content: JSON.stringify({ prompts: [{ id: "shared-id", text: "What would you make today?", tags: ["creative"] }, "What could you imagine next?"] }),
    });
    assert.equal(result.imported.length, 2);
    assert.equal(result.imported[0].id, "shared-id-2");
    assert.equal(result.imported[0].category, "create");
    assert.equal(result.imported[1].category, "create");
  });
});

const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const { join } = require("node:path");
const { tmpdir } = require("node:os");

const { FileGuidedJournalStore } = require("../dist/infrastructure/file-guided-journal-store.js");
const { FileGuidedJournalLibraryStore } = require("../dist/infrastructure/file-guided-journal-library-store.js");
const { GuidedJournalOfficeService } = require("../dist/application/guided-journal-office.js");
const { GuidedJournalLibraryService } = require("../dist/application/guided-journal-library.js");
const { GuidedJournalIntelligenceService } = require("../dist/application/guided-journal-intelligence.js");
const { GuidedJournalProductionService } = require("../dist/application/guided-journal-production.js");
const { GuidedJournalWorkspaceService } = require("../dist/application/guided-journal-workspace.js");
const { ProjectMemoryStore } = require("../dist/application/project-memory-store.js");
const { BookCoverStudioService } = require("../dist/application/book-cover-studio.js");
const { defaultJournalInteriorFormat } = require("../dist/domain/guided-journal-layout.js");

function prompts() {
  const cats = ["remember", "discover", "challenge", "create", "become", "hope"];
  return Array.from({ length: 36 }, (_, i) => ({ id: `prompt-${i + 1}`, category: cats[i % cats.length], text: `Better question ${i + 1}?`, tags: ["better-question"], enabled: true }));
}

async function harness(dir, fakeAi) {
  const editions = new GuidedJournalOfficeService(new FileGuidedJournalStore(join(dir, "editions.json")));
  const library = new GuidedJournalLibraryService(new FileGuidedJournalLibraryStore(join(dir, "library.json")));
  const memory = new ProjectMemoryStore();
  const covers = new BookCoverStudioService();
  const intelligence = new GuidedJournalIntelligenceService(memory, covers, fakeAi ?? (async () => { throw new Error("AI should not be called."); }));
  const service = new GuidedJournalWorkspaceService(editions, library, intelligence, new GuidedJournalProductionService());
  return { service, library, memory, covers };
}

test("workspace generates an edition directly from the durable author library and remembers it in Brain", async () => {
  const dir = await mkdtemp(join(tmpdir(), "forge-journal-workspace-"));
  try {
    const { service, library, memory } = await harness(dir);
    await library.upsertPrompts("project-1", prompts(), "2026-09-01T00:00:00.000Z");
    const edition = await service.createEdition({ id: "edition-1", projectId: "project-1", title: "Better Questions", seed: "edition-seed", promptCount: 12, pageStyle: "lined", responsePagesPerPrompt: 2, now: "2026-09-01T00:00:00.000Z" });
    assert.equal(edition.prompts.length, 12);
    assert.equal(new Set(edition.sourcePromptIds).size, 12);
    assert.ok(memory.get("journal:edition-1:edition"));
    assert.equal((await service.listEditions("project-1")).length, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("question randomizer is reproducible, category-aware and honors exclusions", async () => {
  const dir = await mkdtemp(join(tmpdir(), "forge-journal-workspace-"));
  try {
    const { service, library } = await harness(dir);
    await library.upsertPrompts("project-1", prompts());
    const first = await service.randomQuestion({ projectId: "project-1", seed: "question-seed", category: "hope" });
    const second = await service.randomQuestion({ projectId: "project-1", seed: "question-seed", category: "hope" });
    assert.equal(first.id, second.id);
    assert.equal(first.category, "hope");
    const replacement = await service.randomQuestion({ projectId: "project-1", seed: "question-seed", category: "hope", excludedPromptIds: [first.id] });
    assert.notEqual(replacement.id, first.id);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("AI prompt proposals do not enter the author library until explicitly approved", async () => {
  const dir = await mkdtemp(join(tmpdir(), "forge-journal-workspace-"));
  try {
    const fakeAi = async () => ({ provider: "openai", model: "test", text: JSON.stringify({ prompts: [{ text: "What would you choose if fear had no vote?", tags: ["courage"] }] }) });
    const { service, library } = await harness(dir, fakeAi);
    await library.upsertPrompts("project-1", prompts());
    const before = (await service.getLibrary("project-1")).prompts.length;
    const proposal = await service.proposePrompts({ projectId: "project-1", category: "challenge", count: 1 });
    assert.equal((await service.getLibrary("project-1")).prompts.length, before);
    await service.approvePromptProposal("project-1", proposal);
    assert.equal((await service.getLibrary("project-1")).prompts.length, before + 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("workspace flows from edition to PDF to production-derived cover geometry", async () => {
  const dir = await mkdtemp(join(tmpdir(), "forge-journal-workspace-"));
  try {
    const { service, library } = await harness(dir);
    await library.upsertPrompts("project-1", prompts());
    const edition = await service.createEdition({ id: "edition-1", projectId: "project-1", title: "Better Questions", seed: "seed", promptCount: 12, pageStyle: "blank", responsePagesPerPrompt: 2, now: "2026-09-01T00:00:00.000Z" });
    const rendered = service.renderPdf({ journal: edition, format: defaultJournalInteriorFormat("blank", 2), bookId: "book-1", author: "Author", now: "2026-09-01T00:00:00.000Z" });
    const cover = service.createCover({ journal: edition, layout: rendered.layout, bookId: "book-1", coverPlanId: "cover-1", author: "Author", frontPrompt: "Minimal thoughtful journal art", backText: "A guided journal for better questions.", now: "2026-09-01T00:00:00.000Z" });
    assert.equal(rendered.artifact.format, "kdp-pdf");
    assert.equal(cover.publishing.pageCount, rendered.layout.totalPages);
    assert.equal(cover.publishing.trimWidthInches, rendered.layout.format.trimWidthInches);
    assert.equal(cover.publishing.trimHeightInches, rendered.layout.format.trimHeightInches);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

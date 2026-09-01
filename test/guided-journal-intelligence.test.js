const test = require("node:test");
const assert = require("node:assert/strict");

const { generateGuidedJournal } = require("../dist/domain/guided-journal.js");
const { defaultJournalInteriorFormat, planJournalProductionLayout } = require("../dist/domain/guided-journal-layout.js");
const { GuidedJournalIntelligenceService } = require("../dist/application/guided-journal-intelligence.js");
const { ProjectMemoryStore } = require("../dist/application/project-memory-store.js");
const { BookCoverStudioService } = require("../dist/application/book-cover-studio.js");
const { createMemoryRecord } = require("../dist/domain/memory.js");

function library() {
  const categories = ["remember", "discover", "challenge", "create", "become", "hope"];
  return Array.from({ length: 24 }, (_, i) => ({ id: `p-${i + 1}`, category: categories[i % categories.length], text: `Question ${i + 1}?`, tags: ["better-question"], enabled: true }));
}

function journal(style = "lined") {
  return generateGuidedJournal({ id: "journal-1", projectId: "project-1", title: "The Better Question", seed: "stable-seed", promptCount: 12, promptLibrary: library(), pageStyle: style, responsePagesPerPrompt: 2, now: "2026-09-01T00:00:00.000Z" });
}

test("journal production layout supports lined and blank interiors with deterministic page math", () => {
  const lined = journal("lined");
  const linedFormat = defaultJournalInteriorFormat("lined", 2);
  const layout = planJournalProductionLayout(lined, linedFormat);
  assert.equal(layout.promptPages, 12);
  assert.equal(layout.responsePages, 24);
  assert.equal(layout.frontMatterPages, 3);
  assert.equal(layout.backMatterPages, 1);
  assert.equal(layout.totalPages, 40);

  const blank = journal("blank");
  const blankLayout = planJournalProductionLayout(blank, defaultJournalInteriorFormat("blank", 2));
  assert.equal(blankLayout.totalPages, 40);
  assert.equal(blankLayout.format.pageStyle, "blank");
});

test("journal layout refuses a formatting profile that disagrees with the generated edition", () => {
  assert.throws(() => planJournalProductionLayout(journal("lined"), defaultJournalInteriorFormat("blank", 2)), /page style does not match/i);
});

test("Guided Journal AI uses shared Project Brain context and returns provider evidence", async () => {
  const memory = new ProjectMemoryStore();
  memory.register(createMemoryRecord({
    id: "voice-1", projectId: "project-1", class: "style-memory", authority: "authoritative",
    summary: "Journal voice", content: "Warm, direct, reflective questions.",
    provenance: [{ kind: "author", reference: "author-approved", recordedAt: "2026-09-01T00:00:00.000Z" }],
    relevanceTags: ["guided-journal"], now: "2026-09-01T00:00:00.000Z"
  }));
  let captured;
  const fakeAi = async (request) => {
    captured = request;
    return { provider: "openai", model: "test-model", requestId: "req-1", text: JSON.stringify({ prompts: [{ text: "What part of your past still teaches you today?", tags: ["reflection"] }, { text: "Which memory would you preserve for someone you love?", tags: ["memory"] }] }) };
  };
  const service = new GuidedJournalIntelligenceService(memory, new BookCoverStudioService(), fakeAi);
  const proposal = await service.proposePrompts({ projectId: "project-1", category: "remember", count: 2, purpose: "family reflection", existingPromptTexts: ["What did you learn yesterday?"] });
  assert.equal(proposal.prompts.length, 2);
  assert.equal(proposal.prompts[0].category, "remember");
  assert.equal(proposal.ai.provider, "openai");
  assert.equal(captured.context.projectId, "project-1");
  assert.ok(captured.context.taskMemoryClasses.includes("style-memory"));
  assert.ok(captured.user.includes("Do not repeat"));
});

test("Guided Journal AI rejects fake or malformed provider output instead of inventing prompts", async () => {
  const service = new GuidedJournalIntelligenceService(new ProjectMemoryStore(), new BookCoverStudioService(), async () => ({ provider: "ollama", model: "test", text: "not-json" }));
  await assert.rejects(() => service.proposePrompts({ projectId: "project-1", category: "hope", count: 1 }), /not valid JSON/i);
});

test("journal edition and cover plan are connected to Project Brain and authoritative production geometry", async () => {
  const memory = new ProjectMemoryStore();
  const covers = new BookCoverStudioService();
  const fakeAi = async () => ({ provider: "kings", model: "journal-cover", text: JSON.stringify({ frontPrompt: "A thoughtful minimal journal cover with a subtle question mark motif", backText: "A guided place to remember, discover, challenge, create, become, and hope.", coverStatement: { text: "Ask a better question.", tags: ["better-question"] } }) });
  const service = new GuidedJournalIntelligenceService(memory, covers, fakeAi);
  const edition = journal("lined");
  const format = defaultJournalInteriorFormat("lined", 2);
  const layout = service.createProductionLayout(edition, format);
  const direction = await service.proposeCoverDirection({ projectId: "project-1", journal: edition, audience: "adults", tone: "thoughtful" });
  assert.equal(direction.ai.provider, "kings");
  const cover = service.createCoverPlan({ journal: edition, layout, bookId: "book-1", coverPlanId: "cover-1", author: "Kevin Wakley", frontPrompt: direction.frontPrompt, backText: direction.backText, now: "2026-09-01T00:00:00.000Z" });
  assert.equal(cover.publishing.pageCount, layout.totalPages);
  assert.equal(cover.publishing.trimWidthInches, format.trimWidthInches);
  assert.equal(cover.publishing.trimHeightInches, format.trimHeightInches);
  assert.ok(cover.dimensions.spineWidthInches > 0);
  assert.equal(covers.require("cover-1").projectId, "project-1");
  assert.ok(memory.get("journal:journal-1:edition"));
  const coverMemory = memory.get("journal:journal-1:cover:cover-1");
  assert.ok(coverMemory);
  assert.equal(coverMemory.class, "production-memory");
  assert.ok(coverMemory.relatedMemoryIds.includes("journal:journal-1:edition"));
});

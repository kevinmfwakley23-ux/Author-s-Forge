const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const { createProject, withProjectStudioWorkspace } = require("../.forge-build/domain/project.js");
const { createStudioWorkspace, createWorkspaceBook, addWorkspaceBook } = require("../.forge-build/domain/studio-workspace.js");
const { FileProjectStore } = require("../.forge-build/infrastructure/file-project-store.js");
const { StaticKdpMarketIntelligenceProvider } = require("../.forge-build/application/kdp-market-intelligence.js");
const { StudioPublishingMetadataService } = require("../.forge-build/application/studio-publishing-metadata.js");
const { StudioKdpMarketResearchService } = require("../.forge-build/application/studio-kdp-market-research.js");

function providerResult() {
  return {
    evidence: [
      { id: "e1", source: "Amazon KDP", url: "https://kdp.amazon.com/en_US/help/topic/G201298500", observedAt: "2026-09-01T10:00:00.000Z", observation: "KDP supports relevant reader-search keyword phrases.", strength: "strong" },
      { id: "e2", source: "Observed current listings", url: "https://example.org/current-childrens-market", observedAt: "2026-09-01T10:00:00.000Z", observation: "Friendship and belonging language appears repeatedly in the current sample.", strength: "moderate" },
    ],
    signals: [
      { id: "s1", topic: "keyword-opportunities", label: "Friendship intent", observation: "Specific friendship search language fits the proposed book.", direction: "positive", evidenceIds: ["e1", "e2"] },
    ],
    comparableTitles: [],
    keywordRecommendations: [
      { phrase: "making new friends", score: 95, rationale: "Strong, specific reader intent for the actual story theme.", evidenceIds: ["e1", "e2"], recommendedForKdpSlot: true, complianceNotes: ["use only when friendship is central"] },
      { phrase: "children learning to belong", score: 91, rationale: "Matches the belonging theme without promotional language.", evidenceIds: ["e1", "e2"], recommendedForKdpSlot: true, complianceNotes: ["accurate theme language"] },
      { phrase: "gentle animal friendship story", score: 84, rationale: "Relevant alternate phrase for an animal-led picture book.", evidenceIds: ["e1"], recommendedForKdpSlot: false, complianceNotes: ["accurate only for animal story"] },
    ],
    nicheOpportunities: [
      { niche: "gentle animal stories about friendship and belonging", score: 89, demandSignal: "high", competitionSignal: "moderate", rationale: "Current evidence supports reader interest while differentiation still matters.", evidenceIds: ["e2"] },
    ],
    assessment: { level: "promising", rationale: "Current signals justify further author consideration, not a sales prediction.", signals: ["friendship reader intent"], limitations: ["retailer demand changes over time"], disclaimer: "This report describes observable market signals and research evidence. It is not a guarantee, forecast, or promise of sales, rankings, revenue, or commercial performance." },
  };
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "forge-market-research-"));
  const store = new FileProjectStore(root);
  let workspace = createStudioWorkspace();
  workspace = addWorkspaceBook(workspace, createWorkspaceBook({ id: "book-1", title: "Heartwood Friendship", kind: "childrens-book", description: "A gentle story about making a friend.", now: "2026-09-01T09:00:00.000Z" }));
  const project = withProjectStudioWorkspace(createProject({ id: "project-1", title: "Market Research", now: "2026-09-01T09:00:00.000Z" }), workspace, "2026-09-01T09:01:00.000Z");
  await store.create(project);
  const publishing = new StudioPublishingMetadataService(store);
  await publishing.save("project-1", "book-1", {
    title: "Heartwood Friendship",
    author: "Kevin Wakley",
    contributors: [],
    description: "A gentle animal story about finding friendship, belonging, and the courage to reach out to someone new.",
    keywords: ["animal friendship story"],
    categories: ["Children's Fiction"],
    primaryAudience: "children",
    readingAge: { min: 5, max: 9 },
    primaryMarketplace: "Amazon.com",
    language: "English",
    formats: ["ebook"],
    isbnStrategy: "not-applicable",
    lowContent: false,
    aiContent: { text: "assisted", images: "none", translations: "none" },
  }, { now: "2026-09-01T09:02:00.000Z", memoryId: "publishing-initial" });
  return { root, store, publishing };
}

test("Studio market research persists current evidence and survives a fresh service instance", async (t) => {
  const { root, store } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const provider = new StaticKdpMarketIntelligenceProvider(providerResult());
  const service = new StudioKdpMarketResearchService(store, provider);
  const report = await service.run("project-1", {
    bookId: "book-1",
    reportId: "market-001",
    question: "Find current children's friendship niches and reader-search keyword phrases.",
    market: "Amazon.com / US children's books",
    now: "2026-09-01T10:05:00.000Z",
  });

  assert.equal(report.id, "market-001");
  assert.equal(report.keywordRecommendations[0].phrase, "making new friends");
  assert.equal(report.nicheOpportunities[0].score, 89);

  const freshStore = new FileProjectStore(root);
  const freshService = new StudioKdpMarketResearchService(freshStore, provider);
  const listed = await freshService.list("project-1", "book-1");
  assert.equal(listed.length, 1);
  assert.equal(listed[0].id, "market-001");
  assert.equal((await freshService.get("project-1", "market-001")).question, report.question);
});

test("market research cannot silently change KDP keywords and approved candidates remain attributable", async (t) => {
  const { root, store, publishing } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const service = new StudioKdpMarketResearchService(store, new StaticKdpMarketIntelligenceProvider(providerResult()));
  await service.run("project-1", { bookId: "book-1", reportId: "market-002", question: "Find keywords.", market: "Amazon.com US", now: "2026-09-01T10:10:00.000Z" });

  await assert.rejects(() => service.applyKeywords("project-1", { bookId: "book-1", reportId: "market-002", authorApproved: false }), /Explicit author approval/);
  assert.deepEqual((await publishing.get("project-1", "book-1")).metadata.keywords, ["animal friendship story"]);

  const applied = await service.applyKeywords("project-1", { bookId: "book-1", reportId: "market-002", authorApproved: true, now: "2026-09-01T10:11:00.000Z" });
  assert.deepEqual(applied.metadata.keywords, ["making new friends", "children learning to belong"]);

  const history = await publishing.history("project-1", "book-1");
  assert.ok(history.length >= 2);
  const active = history.find((record) => record.authority === "working");
  assert.ok(active);
  assert.ok(active.provenance.some((item) => item.reference === "market-research:market-002"));

  await assert.rejects(() => service.applyKeywords("project-1", { bookId: "book-1", reportId: "market-002", authorApproved: true, phrases: ["guaranteed bestseller keyword"] }), /not an evidence-backed recommendation/);
});

test("author may choose a smaller evidence-backed subset rather than accepting AI's top seven", async (t) => {
  const { root, store } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const service = new StudioKdpMarketResearchService(store, new StaticKdpMarketIntelligenceProvider(providerResult()));
  await service.run("project-1", { bookId: "book-1", reportId: "market-003", question: "Find keywords.", market: "Amazon.com US" });
  const applied = await service.applyKeywords("project-1", {
    bookId: "book-1",
    reportId: "market-003",
    authorApproved: true,
    phrases: ["gentle animal friendship story"],
  });
  assert.deepEqual(applied.metadata.keywords, ["gentle animal friendship story"]);
});
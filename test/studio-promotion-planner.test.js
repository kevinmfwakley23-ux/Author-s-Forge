const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const { createProject, withProjectStudioWorkspace, withProjectKdpMarketIntelligenceReports } = require("../.forge-build/domain/project.js");
const { createStudioWorkspace, createWorkspaceBook, addWorkspaceBook } = require("../.forge-build/domain/studio-workspace.js");
const { createKdpMarketIntelligenceReport } = require("../.forge-build/domain/kdp-market-intelligence.js");
const { FileProjectStore } = require("../.forge-build/infrastructure/file-project-store.js");
const { StudioPublishingMetadataService } = require("../.forge-build/application/studio-publishing-metadata.js");
const { StudioPromotionPlannerService } = require("../.forge-build/application/studio-promotion-planner.js");
const { StudioMarketingCampaignService } = require("../.forge-build/application/studio-marketing-campaign.js");

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "forge-promo-ai-"));
  const store = new FileProjectStore(root);
  let workspace = createStudioWorkspace();
  workspace = addWorkspaceBook(workspace, createWorkspaceBook({ id: "book-1", title: "Heartwood Friendship", kind: "childrens-book", description: "A gentle animal story about learning to make a new friend and finding belonging.", now: "2026-09-01T13:00:00.000Z" }));
  let project = withProjectStudioWorkspace(createProject({ id: "project-1", title: "Promotion AI", now: "2026-09-01T13:00:00.000Z" }), workspace, "2026-09-01T13:01:00.000Z");
  const market = createKdpMarketIntelligenceReport({
    id: "market-1", projectId: "project-1", bookId: "book-1", question: "Friendship story keywords", market: "Amazon.com US", researchedAt: "2026-09-01T13:02:00.000Z",
    evidence: [{ id: "e1", source: "Current sample", url: "https://example.org/market", observedAt: "2026-09-01T13:02:00.000Z", observation: "Friendship and belonging phrases recur in the sampled market.", strength: "moderate" }],
    signals: [{ id: "s1", topic: "keyword-opportunities", label: "Friendship intent", observation: "Relevant reader-search language is observable.", direction: "positive", evidenceIds: ["e1"] }],
    comparableTitles: [],
    keywordRecommendations: [{ phrase: "making new friends", score: 92, rationale: "Relevant reader intent.", evidenceIds: ["e1"], recommendedForKdpSlot: true, complianceNotes: ["accurate when friendship is central"] }],
    nicheOpportunities: [{ niche: "gentle friendship and belonging stories", score: 86, demandSignal: "high", competitionSignal: "moderate", rationale: "Current sample supports interest.", evidenceIds: ["e1"] }],
    assessment: { level: "promising", rationale: "Useful current signals exist.", signals: ["friendship intent"], limitations: ["sample is not the entire market"], disclaimer: "This report describes observable market signals and research evidence. It is not a guarantee, forecast, or promise of sales, rankings, revenue, or commercial performance." },
  });
  project = withProjectKdpMarketIntelligenceReports(project, [market], "2026-09-01T13:03:00.000Z");
  await store.create(project);
  await new StudioPublishingMetadataService(store).save("project-1", "book-1", {
    title: "Heartwood Friendship", author: "Kevin Wakley", contributors: [], description: "A gentle animal story about friendship, belonging, and reaching out to someone new.", keywords: ["making new friends"], categories: ["Children's Fiction"], primaryAudience: "children", readingAge: { min: 5, max: 9 }, primaryMarketplace: "Amazon.com", language: "English", formats: ["ebook"], isbnStrategy: "not-applicable", lowContent: false, aiContent: { text: "assisted", images: "none", translations: "none" },
  }, { now: "2026-09-01T13:04:00.000Z" });
  return { root, store };
}

function generatorResult(payload) {
  return async (request) => ({ provider: "openai", model: "test-real-boundary", requestId: "resp-1", text: JSON.stringify(payload), request });
}

test("Promotion planner produces substantive draft assets from publishing metadata and saved market research", async (t) => {
  const { root, store } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const generated = {
    assets: [
      { id: "social-1", channel: "social", kind: "social-post", title: "A Small Step Toward Friendship", body: "In Heartwood, one brave hello can open the door to belonging. Meet a gentle animal story about reaching out and making a new friend.", audience: "Parents and caregivers", callToAction: "Discover the Heartwood story." },
      { id: "ads-1", channel: "amazon-ads", kind: "ad-copy", title: "A gentle friendship story", body: "An animal story about making a new friend and finding belonging." },
      { id: "aplus-1", channel: "a-plus", kind: "a-plus-module", title: "Friendship Grows in Heartwood", body: "A warm story centered on courage, connection, and belonging." },
    ],
    amazonAdsPlans: [{ campaignType: "sponsored-products", targeting: "keyword", keywordTargets: ["making new friends"], productTargets: [], negativeKeywords: [], notes: ["Begin with a controlled daily budget after the title is eligible."] }],
    aPlusContentPlans: [{ language: "English", contentName: "Heartwood friendship detail page", moduleAssetIds: ["aplus-1"] }],
  };
  let captured;
  const generator = async (request) => { captured = request; return { provider: "openai", model: "test-real-boundary", requestId: "resp-1", text: JSON.stringify(generated) }; };
  const planner = new StudioPromotionPlannerService(store, generator);
  const result = await planner.generateCampaign("project-1", { bookId: "book-1", campaignId: "launch-1", objective: "Prepare an evidence-aware launch campaign.", audience: "Parents, caregivers and teachers.", readerPromise: "A warm story about friendship and belonging.", channels: ["social", "amazon-ads", "a-plus"], marketResearchReportId: "market-1", now: "2026-09-01T13:05:00.000Z" });

  assert.match(captured.system, /Every generated asset is a DRAFT/i);
  assert.match(captured.user, /making new friends/i);
  assert.equal(result.provider, "openai");
  assert.equal(result.campaign.assets.length, 3);
  assert.ok(result.campaign.assets.every((asset) => asset.status === "draft"));
  assert.ok(result.campaign.assets.every((asset) => asset.sourceResearchIds?.includes("market-1")));
  assert.equal(result.campaign.amazonAdsPlans[0].keywordTargets[0], "making new friends");
  assert.equal(result.campaign.aPlusContentPlans[0].moduleAssetIds[0], "aplus-1");
  assert.equal(result.complianceIssues.length, 0);

  const fresh = new StudioMarketingCampaignService(new FileProjectStore(root));
  const persisted = await fresh.get("project-1", "book-1", "launch-1");
  assert.equal(persisted.campaign.assets[0].status, "draft");
});

test("Promotion planner fails when AI omits a requested channel or emits unusable policy copy", async (t) => {
  const { root, store } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const missing = new StudioPromotionPlannerService(store, generatorResult({ assets: [{ id: "social-1", channel: "social", kind: "social-post", title: "Social", body: "Friendship story." }], amazonAdsPlans: [], aPlusContentPlans: [] }));
  await assert.rejects(() => missing.generateCampaign("project-1", { bookId: "book-1", objective: "launch", audience: "parents", readerPromise: "friendship", channels: ["social", "a-plus"] }), /omitted requested channel/);

  const bad = new StudioPromotionPlannerService(store, generatorResult({ assets: [{ id: "aplus-1", channel: "a-plus", kind: "a-plus-module", title: "Buy now", body: "Free bonus at https://example.com" }], amazonAdsPlans: [], aPlusContentPlans: [{ language: "English", contentName: "Bad", moduleAssetIds: ["aplus-1"] }] }));
  const result = await bad.generateCampaign("project-1", { bookId: "book-1", campaignId: "bad-1", objective: "launch", audience: "parents", readerPromise: "friendship", channels: ["a-plus"], now: "2026-09-01T13:06:00.000Z" });
  assert.ok(result.complianceIssues.some((entry) => entry.assetId === "aplus-1" && entry.issues.some((issue) => issue.severity === "error")));
  const campaigns = new StudioMarketingCampaignService(store);
  await assert.rejects(() => campaigns.approveAsset("project-1", "book-1", "bad-1", "aplus-1"), /cannot be approved/i);
});

test("Promotion planner requires real publishing metadata and does not fabricate a campaign without provider output", async (t) => {
  const { root, store } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const failingProvider = async () => { throw new Error("No AI provider is configured."); };
  const planner = new StudioPromotionPlannerService(store, failingProvider);
  await assert.rejects(() => planner.generateCampaign("project-1", { bookId: "book-1", objective: "launch", audience: "parents", readerPromise: "friendship", channels: ["social"] }), /No AI provider is configured/);
});
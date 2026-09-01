const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const { createProject, withProjectStudioWorkspace } = require("../.forge-build/domain/project.js");
const { createStudioWorkspace, createWorkspaceBook, addWorkspaceBook } = require("../.forge-build/domain/studio-workspace.js");
const { FileProjectStore } = require("../.forge-build/infrastructure/file-project-store.js");
const { StudioMarketingCampaignService } = require("../.forge-build/application/studio-marketing-campaign.js");

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "forge-promotion-"));
  const store = new FileProjectStore(root);
  let workspace = createStudioWorkspace();
  workspace = addWorkspaceBook(workspace, createWorkspaceBook({ id: "book-1", title: "Heartwood Friendship", kind: "childrens-book", description: "A gentle story about making a friend.", now: "2026-09-01T12:00:00.000Z" }));
  await store.create(withProjectStudioWorkspace(createProject({ id: "project-1", title: "Promotion", now: "2026-09-01T12:00:00.000Z" }), workspace, "2026-09-01T12:01:00.000Z"));
  return { root, store };
}

function campaign() {
  return {
    id: "launch-1",
    projectId: "project-1",
    bookId: "book-1",
    objective: "Launch Heartwood Friendship with accurate reader-focused promotion.",
    audience: "Parents, caregivers, teachers, and readers of gentle children's animal stories.",
    readerPromise: "A warm story about friendship and belonging.",
    marketplace: "Amazon.com",
    researchReportIds: ["market-001"],
    assets: [
      { id: "social-1", channel: "social", kind: "social-post", title: "Meet the Heartwood friends", body: "A gentle animal story about reaching out, belonging, and making a new friend.", status: "draft", evidence: [{ source: "manuscript", claim: "friendship and belonging are central themes", confidence: "known" }], sourceResearchIds: ["market-001"] },
      { id: "a-plus-1", channel: "a-plus", kind: "a-plus-module", title: "A Story About Belonging", body: "Follow a young Heartwood character as one small act of courage opens the door to friendship.", status: "draft", evidence: [{ source: "manuscript", claim: "the story centers on friendship", confidence: "known" }] },
    ],
    aPlusContentPlans: [{ marketplace: "Amazon.com", language: "English", contentName: "Heartwood launch detail page", asinTargets: [], moduleAssetIds: ["a-plus-1"] }],
    amazonAdsPlans: [{ marketplace: "Amazon.com", campaignType: "sponsored-products", targeting: "keyword", keywordTargets: ["making new friends"], productTargets: [], negativeKeywords: [], notes: ["Use only after book is eligible for advertising."] }],
  };
}

test("Promotion campaigns persist and revision history survives a fresh service instance", async (t) => {
  const { root, store } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const service = new StudioMarketingCampaignService(store);
  const saved = await service.save("project-1", "book-1", campaign(), { now: "2026-09-01T12:10:00.000Z", memoryId: "campaign-v1" });
  assert.equal(saved.campaign.id, "launch-1");

  const fresh = new StudioMarketingCampaignService(new FileProjectStore(root));
  const loaded = await fresh.get("project-1", "book-1", "launch-1");
  assert.equal(loaded.campaign.assets.length, 2);
  assert.equal(loaded.campaign.amazonAdsPlans[0].keywordTargets[0], "making new friends");

  await fresh.approveAsset("project-1", "book-1", "launch-1", "social-1", "2026-09-01T12:11:00.000Z");
  const history = await fresh.history("project-1", "book-1", "launch-1");
  assert.equal(history.length, 2);
  assert.equal(history[0].campaign.assets.find((asset) => asset.id === "social-1").status, "approved");
  assert.ok(history.some((entry) => entry.memoryId === "campaign-v1"));
});

test("publishing a promotion asset is explicitly author-gated and attributable", async (t) => {
  const { root, store } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const service = new StudioMarketingCampaignService(store);
  await service.save("project-1", "book-1", campaign(), { now: "2026-09-01T12:10:00.000Z" });
  await service.approveAsset("project-1", "book-1", "launch-1", "social-1", "2026-09-01T12:11:00.000Z");
  await assert.rejects(() => service.publishAsset("project-1", "book-1", "launch-1", "social-1", { authorApproved: false }), /Explicit author approval/);
  const published = await service.publishAsset("project-1", "book-1", "launch-1", "social-1", { authorApproved: true, now: "2026-09-01T12:12:00.000Z", externalReference: "social-post-42" });
  const asset = published.campaign.assets.find((item) => item.id === "social-1");
  assert.equal(asset.status, "published");
  assert.equal(asset.externalReference, "social-post-42");
  const project = await store.load("project-1");
  const active = project.memories.find((record) => record.id === published.memoryId);
  assert.ok(active.provenance.some((item) => item.reference === "promotion-published:social-1"));
});

test("A+ policy violations cannot be approved through durable Promotion service", async (t) => {
  const { root, store } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const service = new StudioMarketingCampaignService(store);
  const bad = campaign();
  bad.assets = [{ id: "bad-a-plus", channel: "a-plus", kind: "a-plus-module", title: "Buy now", body: "Free bonus — visit https://example.com", status: "draft", evidence: [] }];
  bad.aPlusContentPlans = [{ marketplace: "Amazon.com", language: "English", contentName: "Bad", asinTargets: [], moduleAssetIds: ["bad-a-plus"] }];
  await service.save("project-1", "book-1", bad);
  await assert.rejects(() => service.approveAsset("project-1", "book-1", "launch-1", "bad-a-plus"), /cannot be approved/i);
});
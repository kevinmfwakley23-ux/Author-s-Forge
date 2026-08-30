const assert = require("node:assert/strict");
const test = require("node:test");
const { createLaunchCampaign, approveCampaignAsset, scheduleCampaignAsset } = require("../.forge-build");

const evidence = [{ id: "market-1", claim: "Comparable titles use atmospheric mystery positioning.", source: "Author research note", confidence: "source-supported" }];
const asset = { id: "asset-1", kind: "announcement", channel: "social", title: "Launch announcement", copy: "A new mystery is coming.", audience: "Atmospheric mystery readers", evidenceIds: ["market-1"], status: "draft" };

test("Mission 041 creates an evidence-aware launch campaign", () => {
  const campaign = createLaunchCampaign({ id: "campaign-1", projectId: "project-1", bookId: "book-1", objective: "Build qualified awareness", audience: "Atmospheric mystery readers", corePromise: "A character-driven mystery with an unsettling setting", evidence, assets: [asset], launchDate: "2026-10-01T00:00:00Z" });
  assert.equal(campaign.assets[0].status, "draft");
  assert.match(campaign.guardrails.join(" "), /not a guarantee/i);
});

test("Mission 041 requires author approval before scheduling", () => {
  const campaign = createLaunchCampaign({ id: "campaign-2", projectId: "project-1", bookId: "book-1", objective: "Launch", audience: "Readers", corePromise: "A strong story", evidence, assets: [asset] });
  assert.throws(() => scheduleCampaignAsset(campaign, "asset-1", "2026-10-01T00:00:00Z"), /approved/);
  const approved = approveCampaignAsset(campaign, "asset-1");
  const scheduled = scheduleCampaignAsset(approved, "asset-1", "2026-10-01T00:00:00Z");
  assert.equal(scheduled.assets[0].status, "scheduled");
  assert.equal(scheduled.assets[0].scheduledFor, "2026-10-01T00:00:00.000Z");
});

test("Mission 041 rejects campaign assets that cite missing evidence", () => {
  assert.throws(() => createLaunchCampaign({ id: "campaign-3", projectId: "project-1", bookId: "book-1", objective: "Launch", audience: "Readers", corePromise: "A story", assets: [{ ...asset, evidenceIds: ["missing"] }] }), /missing evidence/);
});

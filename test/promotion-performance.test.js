const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const { createProject, withProjectStudioWorkspace } = require("../.forge-build/domain/project.js");
const { createStudioWorkspace, createWorkspaceBook, addWorkspaceBook } = require("../.forge-build/domain/studio-workspace.js");
const { createPromotionPerformanceSnapshot, derivePromotionPerformanceMetrics, summarizePromotionPerformance } = require("../.forge-build/domain/promotion-performance.js");
const { FileProjectStore } = require("../.forge-build/infrastructure/file-project-store.js");
const { StudioMarketingCampaignService } = require("../.forge-build/application/studio-marketing-campaign.js");
const { StudioPromotionPerformanceService } = require("../.forge-build/application/studio-promotion-performance.js");

function campaign() {
  return {
    id: "launch-1",
    projectId: "project-1",
    bookId: "book-1",
    objective: "Measure an accurate launch campaign.",
    audience: "Parents and teachers.",
    readerPromise: "A warm friendship story.",
    researchReportIds: [],
    assets: [
      { id: "creative-a", channel: "social", kind: "social-post", title: "Creative A", body: "A gentle friendship story.", status: "approved", approvedAt: "2026-08-31T12:02:00.000Z", evidence: [{ source: "book:book-1", claim: "friendship is central", confidence: "known" }] },
      { id: "creative-b", channel: "social", kind: "social-post", title: "Creative B", body: "One brave hello can open a friendship.", status: "approved", approvedAt: "2026-08-31T12:02:00.000Z", evidence: [{ source: "book:book-1", claim: "friendship is central", confidence: "known" }] },
    ],
  };
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "forge-promotion-performance-"));
  const store = new FileProjectStore(root);
  let workspace = createStudioWorkspace();
  workspace = addWorkspaceBook(workspace, createWorkspaceBook({ id: "book-1", title: "Heartwood Friendship", kind: "childrens-book", description: "A gentle friendship story.", now: "2026-08-31T12:00:00.000Z" }));
  await store.create(withProjectStudioWorkspace(createProject({ id: "project-1", title: "Promotion Performance", now: "2026-08-31T12:00:00.000Z" }), workspace, "2026-08-31T12:01:00.000Z"));
  await new StudioMarketingCampaignService(store).save("project-1", "book-1", campaign(), { now: "2026-08-31T12:02:00.000Z" });
  return { root, store };
}

function snapshot(overrides = {}) {
  return createPromotionPerformanceSnapshot({
    id: "perf-a",
    projectId: "project-1",
    bookId: "book-1",
    campaignId: "launch-1",
    assetId: "creative-a",
    source: "bookbub-ads",
    periodStart: "2026-08-31T12:00:00.000Z",
    periodEnd: "2026-08-31T13:00:00.000Z",
    observedAt: "2026-08-31T14:00:00.000Z",
    currency: "USD",
    sourceReference: "BookBub Ads dashboard export",
    sourceUrl: "https://partners.bookbub.com/",
    metrics: { impressions: 10000, clicks: 150, spend: 75, attributedOrders: 15, attributedUnits: 15, attributedRevenue: 120 },
    ...overrides,
  });
}

test("promotion performance derives only metrics supported by observed inputs", () => {
  const derived = derivePromotionPerformanceMetrics(snapshot());
  assert.equal(derived.ctrPercent, 1.5);
  assert.equal(derived.costPerClick, 0.5);
  assert.equal(derived.costPerThousandImpressions, 7.5);
  assert.equal(derived.attributedConversionPercent, 10);
  assert.equal(derived.costPerAttributedOrder, 5);
  assert.equal(derived.acosPercent, 62.5);
  assert.equal(derived.roas, 1.6);

  const noAttribution = snapshot({ id: "perf-gap", metrics: { impressions: 10000, clicks: 150, spend: 75 } });
  const gapDerived = derivePromotionPerformanceMetrics(noAttribution);
  assert.equal(gapDerived.ctrPercent, 1.5);
  assert.equal(gapDerived.roas, undefined);
  assert.equal(gapDerived.acosPercent, undefined);
  const summary = summarizePromotionPerformance([noAttribution]);
  assert.ok(summary.insights.some((item) => item.kind === "data-gap" && /will not calculate ROAS or ACOS/i.test(item.message)));
});

test("performance snapshots reject future-period claims, missing provenance and money without currency", () => {
  assert.throws(() => snapshot({ periodEnd: "2026-08-31T15:00:00.000Z" }), /ending after the observation time/i);
  assert.throws(() => snapshot({ sourceReference: "" }), /source reference is required/i);
  assert.throws(() => snapshot({ currency: undefined }), /currency is required/i);
});

test("promotion performance persists as immutable campaign-scoped evidence across service restarts", async (t) => {
  const { root, store } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const service = new StudioPromotionPerformanceService(store);
  const saved = await service.record("project-1", "book-1", "launch-1", {
    id: "perf-a",
    assetId: "creative-a",
    source: "bookbub-ads",
    periodStart: "2026-08-31T12:00:00.000Z",
    periodEnd: "2026-08-31T13:00:00.000Z",
    observedAt: "2026-08-31T14:00:00.000Z",
    currency: "USD",
    sourceReference: "BookBub Ads dashboard export",
    metrics: { impressions: 10000, clicks: 150, spend: 75 },
  }, { now: "2026-08-31T14:01:00.000Z" });
  assert.equal(saved.snapshot.id, "perf-a");

  await service.record("project-1", "book-1", "launch-1", {
    id: "perf-b",
    assetId: "creative-b",
    source: "bookbub-ads",
    periodStart: "2026-08-31T12:00:00.000Z",
    periodEnd: "2026-08-31T13:00:00.000Z",
    observedAt: "2026-08-31T14:00:30.000Z",
    sourceReference: "BookBub Ads dashboard export",
    metrics: { impressions: 10000, clicks: 200 },
  }, { now: "2026-08-31T14:02:00.000Z" });

  const fresh = new StudioPromotionPerformanceService(new FileProjectStore(root));
  const history = await fresh.list("project-1", "book-1", "launch-1");
  assert.equal(history.length, 2);
  assert.equal(history[0].snapshot.id, "perf-b");
  const summary = await fresh.summary("project-1", "book-1", "launch-1");
  assert.ok(summary.insights.some((item) => item.kind === "next-test" && /creative-b has the higher observed CTR/i.test(item.message)));

  await assert.rejects(() => fresh.record("project-1", "book-1", "launch-1", {
    id: "perf-a", assetId: "creative-a", source: "social", periodStart: "2026-08-31T12:00:00.000Z", periodEnd: "2026-08-31T13:00:00.000Z", observedAt: "2026-08-31T14:03:00.000Z", sourceReference: "Manual platform reading", metrics: { impressions: 1 },
  }), /already exists/i);
  await assert.rejects(() => fresh.record("project-1", "book-1", "launch-1", {
    id: "perf-wrong-asset", assetId: "not-in-campaign", source: "social", periodStart: "2026-08-31T12:00:00.000Z", periodEnd: "2026-08-31T13:00:00.000Z", observedAt: "2026-08-31T14:03:00.000Z", sourceReference: "Manual platform reading", metrics: { impressions: 1 },
  }), /not part of campaign/i);
});

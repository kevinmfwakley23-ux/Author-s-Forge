import assert from "node:assert/strict";
import test from "node:test";
import { createPromotionReadinessReport } from "../src/domain/promotion-readiness";
import { approveMarketingAsset, createMarketingCampaign } from "../src/domain/marketing-campaign";

const draft = createMarketingCampaign({
  id: "c", projectId: "p", bookId: "b", objective: "launch", audience: "parents", readerPromise: "friendship",
  assets: [{ id: "social", channel: "social", kind: "social-post", title: "Friendship", body: "A gentle friendship story.", status: "draft", evidence: [{ source: "manuscript", claim: "friendship theme", confidence: "known" }] }],
  researchReportIds: ["market-1"],
});

test("Promotion readiness blocks remaining drafts and missing approvals", () => {
  const report = createPromotionReadinessReport({ id: "r", projectId: "p", bookId: "b", campaign: draft, now: "2026-09-01T14:00:00Z" });
  assert.equal(report.status, "attention");
  assert.ok(report.errorCount >= 2);
  assert.ok(report.checks.some((item) => item.id === "asset-review" && item.status === "attention"));
  assert.ok(report.checks.some((item) => item.id === "approved-assets" && item.status === "attention"));
});

test("approved compliant campaign can be release-ready while nonblocking platform setup warnings remain", () => {
  const approved = approveMarketingAsset(createMarketingCampaign({
    ...draft,
    assets: [
      { ...draft.assets[0] },
      { id: "aplus", channel: "a-plus", kind: "a-plus-module", title: "Inside Heartwood", body: "A warm look at friendship and belonging.", status: "rejected", evidence: [{ source: "manuscript", claim: "friendship theme", confidence: "known" }] },
    ],
    amazonAdsPlans: [{ marketplace: "Amazon.com", campaignType: "sponsored-brands", targeting: "keyword", keywordTargets: ["making new friends"], productTargets: [], negativeKeywords: [], notes: [] }],
  }), "social", "2026-09-01T14:01:00Z");
  const report = createPromotionReadinessReport({ id: "r", projectId: "p", bookId: "b", campaign: approved, now: "2026-09-01T14:02:00Z" });
  assert.equal(report.errorCount, 0);
  assert.equal(report.status, "ready");
  assert.ok(report.warningCount >= 1, "Sponsored Brands eligibility remains a visible marketplace warning");
});

test("A+ compliance errors block Promotion readiness", () => {
  const bad = createMarketingCampaign({
    id: "bad", projectId: "p", bookId: "b", objective: "launch", audience: "parents", readerPromise: "friendship",
    assets: [{ id: "aplus", channel: "a-plus", kind: "a-plus-module", title: "Buy now", body: "Free bonus at https://example.com", status: "rejected", evidence: [] }],
    researchReportIds: ["market-1"],
  });
  const report = createPromotionReadinessReport({ id: "r", projectId: "p", bookId: "b", campaign: bad });
  assert.ok(report.checks.some((item) => item.id === "asset-compliance-aplus" && item.status === "attention"));
  assert.ok(report.errorCount > 0);
});
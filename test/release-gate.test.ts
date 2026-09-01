import assert from "node:assert/strict";
import test from "node:test";
import { createReleaseGateReport } from "../src/domain/release-gate";
import type { PromotionReadinessReport } from "../src/domain/promotion-readiness";
import type { PublishingReadinessReport } from "../src/domain/publishing-readiness";

const ready: PublishingReadinessReport = { formatVersion: 1, id: "r", projectId: "p", createdAt: "2026-08-29T00:00:00.000Z", checks: [{ id: "c", category: "production", label: "Production", status: "passed", severity: "error", message: "ok" }], passedCount: 1, attentionCount: 0, status: "ready" };
const warningOnly: PublishingReadinessReport = { formatVersion: 1, id: "rw", projectId: "p", createdAt: "2026-08-29T00:00:00.000Z", checks: [{ id: "dedication", category: "manuscript", label: "Dedication", status: "attention", severity: "warning", message: "optional" }], passedCount: 0, attentionCount: 1, status: "attention" };
const promotionReady: PromotionReadinessReport = { formatVersion: 1, id: "pr", projectId: "p", bookId: "b", campaignId: "c", createdAt: "2026-09-01T00:00:00.000Z", checks: [{ id: "ok", label: "Promotion", status: "passed", severity: "error", message: "ok" }], passedCount: 1, errorCount: 0, warningCount: 0, status: "ready" };

test("release gate is ready when publishing is ready", () => {
  const report = createReleaseGateReport({ id: "release", projectId: "p", bookId: "b", publishingReadiness: ready });
  assert.equal(report.status, "ready");
  assert.equal(report.blockers.length, 0);
});

test("warning-only Publishing checks remain visible without blocking release", () => {
  const report = createReleaseGateReport({ id: "release", projectId: "p", bookId: "b", publishingReadiness: warningOnly });
  assert.equal(report.status, "ready");
  assert.equal(report.blockers.length, 0);
});

test("release gate blocks mismatched readiness", () => {
  const report = createReleaseGateReport({ id: "release", projectId: "other", bookId: "b", publishingReadiness: ready });
  assert.equal(report.status, "blocked");
  assert.ok(report.blockers.some((blocker) => blocker.id === "readiness-project-mismatch"));
});

test("promotion can be explicitly required and must be release-ready", () => {
  const missing = createReleaseGateReport({ id: "release", projectId: "p", bookId: "b", publishingReadiness: ready, promotionRequired: true });
  assert.equal(missing.status, "blocked");
  assert.ok(missing.blockers.some((blocker) => blocker.id === "promotion-readiness-missing"));

  const readyReport = createReleaseGateReport({ id: "release", projectId: "p", bookId: "b", publishingReadiness: ready, promotionRequired: true, promotionReadiness: promotionReady });
  assert.equal(readyReport.status, "ready");

  const blockedPromotion: PromotionReadinessReport = { ...promotionReady, checks: [{ id: "drafts", label: "Drafts", status: "attention", severity: "error", message: "review", remediation: "approve" }], passedCount: 0, errorCount: 1, warningCount: 0, status: "attention" };
  const blocked = createReleaseGateReport({ id: "release", projectId: "p", bookId: "b", publishingReadiness: ready, promotionRequired: true, promotionReadiness: blockedPromotion });
  assert.equal(blocked.status, "blocked");
  assert.ok(blocked.blockers.some((blocker) => blocker.id === "promotion-readiness"));
});
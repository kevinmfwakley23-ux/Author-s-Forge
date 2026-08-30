import assert from "node:assert/strict";
import test from "node:test";
import { createReleaseGateReport } from "../src/domain/release-gate";
import type { PublishingReadinessReport } from "../src/domain/publishing-readiness";

const ready: PublishingReadinessReport = { formatVersion: 1, id: "r", projectId: "p", createdAt: "2026-08-29T00:00:00.000Z", checks: [{ id: "c", category: "production", label: "Production", status: "passed", severity: "error", message: "ok" }], passedCount: 1, attentionCount: 0, status: "ready" };

test("release gate is ready when publishing is ready", () => {
  const report = createReleaseGateReport({ id: "release", projectId: "p", bookId: "b", publishingReadiness: ready });
  assert.equal(report.status, "ready");
  assert.equal(report.blockers.length, 0);
});

test("release gate blocks mismatched readiness", () => {
  const report = createReleaseGateReport({ id: "release", projectId: "other", bookId: "b", publishingReadiness: ready });
  assert.equal(report.status, "blocked");
  assert.ok(report.blockers.some((blocker) => blocker.id === "readiness-project-mismatch"));
});

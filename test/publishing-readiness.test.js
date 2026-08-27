const test = require("node:test");
const assert = require("node:assert/strict");
const { createPublishingReadinessReport, validatePublishingReadinessReport } = require("../.forge-build");

const complete = { id: "audit-1", projectId: "project-1", now: "2026-08-27T00:00:00.000Z", manuscript: { title: "The Forge", author: "Author", chapters: [{ number: 1, title: "One" }, { number: 2, title: "Two" }], hasTitlePage: true, hasCopyrightPage: true, hasDedication: true, hasEpigraph: true, hasTableOfContents: true, hasBiography: true, hasAcknowledgments: true, hasAboutTheAuthor: true, hasBackMatter: true, hasSeriesInformation: true, pageCount: 220 }, cover: { format: "paperback", widthInches: 12.9256, heightInches: 9.25, hasFront: true, hasBack: true, hasSpine: true, hasBarcodeSafeArea: true, hasBleed: true, hasTrim: true, hasSafeMargins: true, validated: true, fileType: "pdf" }, metadata: { title: "The Forge", author: "Author", description: "A complete book.", keywords: ["forge"], categories: ["fiction"] }, formatting: { fileTypes: ["docx", "pdf", "epub"], validated: true, pageNumbering: true, headersFooters: true }, images: { count: 3, allResolved: true, allApproved: true, resolutionValidated: true }, production: { trim: true, bleed: true, fileTypes: ["pdf", "epub"], validated: true } };

test("Mission 017 produces a complete publication audit", () => {
  const report = createPublishingReadinessReport(complete);
  assert.equal(report.status, "ready");
  assert.equal(report.attentionCount, 0);
  assert.equal(report.passedCount, report.checks.length);
  assert.ok(report.checks.length >= 35);
  assert.equal(validatePublishingReadinessReport(report).passedCount, report.checks.length);
});

test("Mission 017 reports actionable attention items instead of false readiness", () => {
  const report = createPublishingReadinessReport({ ...complete, id: "audit-2", metadata: { ...complete.metadata, keywords: [], description: "" }, cover: { ...complete.cover, validated: false } });
  assert.equal(report.status, "attention");
  assert.ok(report.attentionCount >= 3);
  assert.ok(report.checks.some(c => c.id === "keywords" && c.status === "attention"));
  assert.ok(report.checks.some(c => c.id === "cover-validation" && c.status === "attention"));
  assert.ok(report.checks.some(c => c.id === "description" && c.status === "attention"));
});

test("Mission 017 rejects tampered audit summaries", () => {
  const report = createPublishingReadinessReport(complete);
  assert.throws(() => validatePublishingReadinessReport({ ...report, passedCount: 0 }), /summary is inconsistent/);
});

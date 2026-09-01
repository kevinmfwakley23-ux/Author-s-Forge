const test = require("node:test");
const assert = require("node:assert/strict");
const { createPublishingReadinessReport, validatePublishingReadinessReport } = require("../.forge-build");

const complete = { id: "audit-1", projectId: "project-1", bookId: "book-1", now: "2026-08-27T00:00:00.000Z", manuscript: { title: "The Forge", author: "Author", chapters: [{ number: 1, title: "One" }, { number: 2, title: "Two" }], hasTitlePage: true, hasCopyrightPage: true, hasDedication: true, hasEpigraph: true, hasTableOfContents: true, hasBiography: true, hasAcknowledgments: true, hasAboutTheAuthor: true, hasBackMatter: true, hasSeriesInformation: true, pageCount: 220 }, cover: { format: "paperback", widthInches: 12.9256, heightInches: 9.25, hasFront: true, hasBack: true, hasSpine: true, hasBarcodeSafeArea: true, hasBleed: true, hasTrim: true, hasSafeMargins: true, validated: true, fileType: "pdf" }, metadata: { title: "The Forge", author: "Author", description: "A complete book.", keywords: ["forge"], categories: ["fiction"] }, formatting: { fileTypes: ["docx", "pdf", "epub"], validated: true, pageNumbering: true, headersFooters: true }, images: { required: true, count: 3, allResolved: true, allApproved: true, resolutionValidated: true }, production: { trim: true, bleed: true, fileTypes: ["pdf", "epub"], validated: true } };

test("Mission 017 produces a complete publication audit", () => {
  const report = createPublishingReadinessReport(complete);
  assert.equal(report.status, "ready");
  assert.equal(report.bookId, "book-1");
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

test("digital releases do not inherit print-only blockers and can explicitly omit non-applicable images or TOC", () => {
  const report = createPublishingReadinessReport({
    ...complete,
    id: "audit-ebook",
    manuscript: { ...complete.manuscript, pageCount: undefined, hasTableOfContents: false, tableOfContentsRequired: false },
    cover: { format: "ebook", widthInches: 1, heightInches: 1.6, hasFront: true, hasBack: false, hasSpine: false, hasBarcodeSafeArea: false, hasBleed: false, hasTrim: false, hasSafeMargins: false, validated: true, fileType: "jpeg" },
    formatting: { fileTypes: ["epub"], validated: true, pageNumbering: false, headersFooters: false },
    images: { required: false, count: 0, allResolved: false, allApproved: false, resolutionValidated: false },
    production: { trim: false, bleed: false, fileTypes: ["epub"], validated: true },
  });
  const byId = Object.fromEntries(report.checks.map((item) => [item.id, item]));
  for (const id of ["toc", "page-count", "cover-back", "cover-spine", "barcode-safe", "cover-bleed", "cover-trim", "cover-margins", "page-numbering", "images-present", "images-resolved", "images-approved", "image-resolution", "production-trim", "production-bleed"]) {
    assert.equal(byId[id].status, "passed", `${id} should not block this digital release`);
  }
  assert.equal(report.checks.filter((item) => item.status === "attention" && item.severity === "error").length, 0);
});

test("Mission 017 rejects tampered audit summaries", () => {
  const report = createPublishingReadinessReport(complete);
  assert.throws(() => validatePublishingReadinessReport({ ...report, passedCount: 0 }), /summary is inconsistent/);
});

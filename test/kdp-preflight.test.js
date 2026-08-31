import test from "node:test";
import assert from "node:assert/strict";
import { createKdpPreflightReport, expectedKdpInteriorPageSize, requiredKdpInsideMargin } from "../dist/domain/kdp-preflight.js";

function validInput(overrides = {}) {
  return {
    id: "preflight-1",
    projectId: "project-1",
    binding: "paperback",
    trimWidthInches: 6,
    trimHeightInches: 9,
    pageCount: 120,
    interiorHasBleed: true,
    expectedCoverWidthInches: 12.52024,
    expectedCoverHeightInches: 9.25,
    interior: {
      format: "pdf",
      sizeBytes: 12_000_000,
      encrypted: false,
      fontsEmbedded: true,
      imagesEmbedded: true,
      minimumImageDpi: 300,
      transparentObjectsFlattened: true,
      hasCropMarks: false,
      hasTrimMarks: false,
      hasBookmarks: false,
      hasComments: false,
      hasAnnotations: false,
      hasPlaceholderText: false,
      hasPdfCreationWatermark: false,
      pageWidthInches: 6.125,
      pageHeightInches: 9.25,
      insideMarginInches: 0.375,
      outsideMarginInches: 0.375,
      topMarginInches: 0.375,
      bottomMarginInches: 0.375,
    },
    cover: {
      format: "pdf",
      sizeBytes: 8_000_000,
      encrypted: false,
      fontsEmbedded: true,
      minimumImageDpi: 300,
      transparentObjectsFlattened: true,
      hasCropMarks: false,
      hasTrimMarks: false,
      hasTemplateText: false,
      titleOnFront: true,
      widthInches: 12.52024,
      heightInches: 9.25,
      spineTextPresent: true,
    },
    now: "2026-08-31T13:30:00.000Z",
    ...overrides,
  };
}

test("Mission 063 KDP preflight accepts a compliant print package", () => {
  const report = createKdpPreflightReport(validInput());
  assert.equal(report.status, "ready");
  assert.equal(report.errorCount, 0);
  assert.equal(report.expectedInteriorPageWidthInches, 6.125);
  assert.equal(report.expectedInteriorPageHeightInches, 9.25);
});

test("KDP interior bleed geometry follows trim plus outside/top/bottom bleed", () => {
  assert.deepEqual(expectedKdpInteriorPageSize(6, 9, true), { widthInches: 6.125, heightInches: 9.25 });
  assert.deepEqual(expectedKdpInteriorPageSize(6, 9, false), { widthInches: 6, heightInches: 9 });
});

test("KDP gutter margin scales with page count", () => {
  assert.equal(requiredKdpInsideMargin(24), 0.375);
  assert.equal(requiredKdpInsideMargin(151), 0.5);
  assert.equal(requiredKdpInsideMargin(301), 0.625);
  assert.equal(requiredKdpInsideMargin(501), 0.75);
  assert.equal(requiredKdpInsideMargin(701), 0.875);
});

test("KDP preflight blocks common upload failures with actionable findings", () => {
  const input = validInput({
    interior: { ...validInput().interior, encrypted: true, fontsEmbedded: false, hasCropMarks: true, minimumImageDpi: 220, insideMarginInches: 0.2 },
    cover: { ...validInput().cover, hasTemplateText: true, titleOnFront: false, widthInches: 12, encrypted: true },
  });
  const report = createKdpPreflightReport(input);
  assert.equal(report.status, "blocked");
  const codes = report.findings.map((finding) => finding.code);
  assert.ok(codes.includes("INTERIOR_ENCRYPTED"));
  assert.ok(codes.includes("INTERIOR_FONTS_NOT_EMBEDDED"));
  assert.ok(codes.includes("INTERIOR_PRINTER_MARKS"));
  assert.ok(codes.includes("INTERIOR_LOW_IMAGE_DPI"));
  assert.ok(codes.includes("INTERIOR_GUTTER_MARGIN"));
  assert.ok(codes.includes("COVER_TEMPLATE_TEXT"));
  assert.ok(codes.includes("COVER_TITLE_MISSING"));
  assert.ok(codes.includes("COVER_DIMENSIONS"));
  assert.ok(codes.includes("COVER_ENCRYPTED"));
  assert.ok(report.findings.every((finding) => finding.remediation.length > 0));
});

test("KDP preflight rejects spine text below 79 pages", () => {
  const report = createKdpPreflightReport(validInput({
    pageCount: 78,
    expectedCoverWidthInches: 12.425656,
    cover: { ...validInput().cover, widthInches: 12.425656, spineTextPresent: true },
  }));
  assert.equal(report.status, "blocked");
  assert.ok(report.findings.some((finding) => finding.code === "SPINE_TEXT_TOO_FEW_PAGES"));
});

test("KDP preflight warns when an odd final page count may affect spine calculation", () => {
  const report = createKdpPreflightReport(validInput({ pageCount: 121 }));
  assert.equal(report.status, "ready");
  assert.ok(report.findings.some((finding) => finding.code === "ODD_PAGE_COUNT" && finding.severity === "warning"));
});

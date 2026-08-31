import test from "node:test";
import assert from "node:assert/strict";
import { KdpPreflightService } from "../dist/application/kdp-preflight.js";
import { calculateKdpCoverLayout } from "../dist/domain/book-cover-studio.js";

const publishing = {
  platform: "kdp",
  binding: "paperback",
  interiorType: "black-white",
  paperType: "white",
  trimWidthInches: 6,
  trimHeightInches: 9,
  pageCount: 120,
  bleedInches: 0.125,
  readingDirection: "ltr",
};

function validFacts() {
  const layout = calculateKdpCoverLayout(publishing);
  return {
    interior: {
      format: "pdf",
      sizeBytes: 1_000_000,
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
      pageWidthInches: 6,
      pageHeightInches: 9,
      insideMarginInches: 0.375,
      outsideMarginInches: 0.25,
      topMarginInches: 0.25,
      bottomMarginInches: 0.25,
    },
    cover: {
      format: "pdf",
      sizeBytes: 2_000_000,
      encrypted: false,
      fontsEmbedded: true,
      minimumImageDpi: 300,
      transparentObjectsFlattened: true,
      hasCropMarks: false,
      hasTrimMarks: false,
      hasTemplateText: false,
      titleOnFront: true,
      widthInches: layout.dimensions.widthInches,
      heightInches: layout.dimensions.heightInches,
      spineTextPresent: true,
    },
  };
}

test("KDP preflight service derives cover geometry from authoritative publishing configuration", () => {
  const service = new KdpPreflightService();
  const facts = validFacts();
  const report = service.audit({
    id: "preflight-1",
    projectId: "project-1",
    publishing,
    interiorHasBleed: false,
    ...facts,
    now: "2026-08-31T13:30:00.000Z",
  });
  assert.equal(report.status, "ready");
  assert.equal(report.errorCount, 0);
});

test("KDP preflight service rejects a cover that disagrees with authoritative geometry", () => {
  const service = new KdpPreflightService();
  const facts = validFacts();
  const report = service.audit({
    id: "preflight-2",
    projectId: "project-1",
    publishing,
    interiorHasBleed: false,
    interior: facts.interior,
    cover: { ...facts.cover, widthInches: facts.cover.widthInches + 0.5 },
  });
  assert.equal(report.status, "blocked");
  assert.ok(report.findings.some((finding) => finding.code === "COVER_DIMENSIONS"));
});

import assert from "node:assert/strict";
import test from "node:test";
import { createProject, withProjectBookCoverPlans } from "../src/domain/project";
import { createBookCoverPlan } from "../src/domain/book-cover-studio";
import { runStudioKdpPreflight } from "../src/application/studio-kdp-preflight-http";

function projectWithPlan() {
  const project = createProject({ id: "project-1", title: "KDP Book" });
  const plan = createBookCoverPlan({
    id: "cover-1",
    projectId: project.metadata.id,
    bookId: "book-1",
    format: "paperback",
    publishing: {
      platform: "kdp",
      binding: "paperback",
      interiorType: "black-white",
      paperType: "white",
      trimWidthInches: 6,
      trimHeightInches: 9,
      pageCount: 120,
      bleedInches: 0.125,
      readingDirection: "ltr",
    },
    title: "KDP Book",
    author: "Author",
    frontPrompt: "Front",
    spineText: "KDP Book",
    backText: "Back",
    outputFormat: "pdf",
    dpi: 300,
    version: 1,
    approvalStatus: "draft",
  });
  return withProjectBookCoverPlans(project, [plan]);
}

const cleanInterior = {
  format: "pdf",
  sizeBytes: 2_000_000,
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
};

const cleanCover = {
  format: "pdf",
  sizeBytes: 3_000_000,
  encrypted: false,
  fontsEmbedded: true,
  minimumImageDpi: 300,
  transparentObjectsFlattened: true,
  hasCropMarks: false,
  hasTrimMarks: false,
  hasTemplateText: false,
  titleOnFront: true,
  widthInches: 12.52,
  heightInches: 9.25,
  spineTextPresent: true,
};

test("Studio KDP preflight derives authoritative publishing geometry from the persisted cover plan", () => {
  const report = runStudioKdpPreflight(projectWithPlan(), {
    bookId: "book-1",
    interiorHasBleed: true,
    interior: cleanInterior,
    cover: cleanCover,
    now: "2026-08-31T18:00:00.000Z",
  });
  assert.equal(report.projectId, "project-1");
  assert.equal(report.expectedInteriorPageWidthInches, 6.125);
  assert.equal(report.expectedInteriorPageHeightInches, 9.25);
  assert.equal(report.status, "ready");
});

test("Studio KDP preflight refuses books without a persisted KDP cover plan", () => {
  const project = createProject({ id: "project-1", title: "KDP Book" });
  assert.throws(() => runStudioKdpPreflight(project, {
    bookId: "book-1",
    interiorHasBleed: true,
    interior: cleanInterior,
    cover: cleanCover,
  }), /Create a KDP cover plan/);
});

test("Studio KDP preflight rejects malformed inspection facts rather than silently coercing them", () => {
  assert.throws(() => runStudioKdpPreflight(projectWithPlan(), {
    bookId: "book-1",
    interiorHasBleed: true,
    interior: { ...cleanInterior, encrypted: "false" },
    cover: cleanCover,
  }), /Interior encrypted must be a boolean/);
});

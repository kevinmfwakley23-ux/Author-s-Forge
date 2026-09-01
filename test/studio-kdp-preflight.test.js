import test from "node:test";
import assert from "node:assert/strict";
import { StudioKdpPreflightService } from "../dist/application/studio-kdp-preflight.js";
import { BookCoverStudioService } from "../dist/application/book-cover-studio.js";
import { calculateKdpCoverLayout } from "../dist/domain/book-cover-studio.js";
import { createProject, withProjectBookCoverPlans } from "../dist/domain/project.js";

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

function projectWithCoverPlan() {
  const project = createProject({ id: "project-1", title: "Production Book", now: "2026-08-31T20:00:00.000Z" });
  const plan = new BookCoverStudioService().create({
    id: "cover-1",
    projectId: project.metadata.id,
    bookId: "book-1",
    format: "paperback",
    publishing,
    title: "Production Book",
    author: "Author",
    frontPrompt: "Front cover",
    spineText: "Production Book",
    backText: "Back cover",
    outputFormat: "pdf",
    dpi: 300,
    version: 1,
    approvalStatus: "draft",
  });
  return withProjectBookCoverPlans(project, [plan], "2026-08-31T20:01:00.000Z");
}

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

test("Studio KDP preflight resolves authoritative cover plan and persists audit evidence", () => {
  const project = projectWithCoverPlan();
  const facts = validFacts();
  const result = new StudioKdpPreflightService().audit({
    project,
    bookId: "book-1",
    interiorHasBleed: false,
    ...facts,
    reportId: "preflight-1",
    now: "2026-08-31T20:02:00.000Z",
  });

  assert.equal(result.coverPlanId, "cover-1");
  assert.equal(result.report.status, "ready");
  assert.equal(result.project.memories.length, project.memories.length + 1);
  assert.equal(result.evidenceMemory.class, "production-memory");
  assert.match(result.evidenceMemory.content, /"coverPlanId": "cover-1"/);
  assert.match(result.evidenceMemory.content, /"id": "preflight-1"/);
});

test("Studio KDP preflight blocks geometry drift and preserves findings in durable evidence", () => {
  const project = projectWithCoverPlan();
  const facts = validFacts();
  const result = new StudioKdpPreflightService().audit({
    project,
    coverPlanId: "cover-1",
    interiorHasBleed: false,
    interior: facts.interior,
    cover: { ...facts.cover, widthInches: facts.cover.widthInches + 0.5 },
    reportId: "preflight-2",
    now: "2026-08-31T20:03:00.000Z",
  });

  assert.equal(result.report.status, "blocked");
  assert.ok(result.report.findings.some((finding) => finding.code === "COVER_DIMENSIONS"));
  assert.match(result.evidenceMemory.content, /COVER_DIMENSIONS/);
});

test("Studio KDP preflight refuses to run without authoritative KDP cover state", () => {
  const project = createProject({ id: "project-2", title: "No Cover" });
  const facts = validFacts();
  assert.throws(
    () => new StudioKdpPreflightService().audit({ project, interiorHasBleed: false, ...facts }),
    /Create a KDP cover plan before running production preflight/,
  );
});

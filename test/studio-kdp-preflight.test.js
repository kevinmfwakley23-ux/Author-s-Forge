const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const { createProject, withProjectBookCoverPlans } = require("../.forge-build/domain/project.js");
const { createBookCoverPlan } = require("../.forge-build/domain/book-cover-studio.js");
const { FileKdpPreflightStore } = require("../.forge-build/infrastructure/file-kdp-preflight-store.js");
const { KdpPreflightHistoryService } = require("../.forge-build/application/kdp-preflight-history.js");
const { StudioKdpPreflightService, resolveKdpCoverPlan } = require("../.forge-build/application/studio-kdp-preflight.js");

function publishing(pageCount = 120) {
  return {
    platform: "kdp",
    binding: "paperback",
    interiorType: "black-white",
    paperType: "white",
    trimWidthInches: 6,
    trimHeightInches: 9,
    pageCount,
    bleedInches: 0.125,
    readingDirection: "ltr",
  };
}

function plan(id, pageCount, now, version = 1) {
  return createBookCoverPlan({
    id,
    projectId: "project-a",
    bookId: "book-a",
    format: "paperback",
    publishing: publishing(pageCount),
    title: "Authoritative Book",
    author: "Author",
    frontPrompt: "Production cover",
    spineText: "Authoritative Book",
    backText: "Back cover copy",
    outputFormat: "pdf",
    dpi: 300,
    version,
    approvalStatus: "approved",
    now,
  });
}

function projectWithPlans(plans) {
  return withProjectBookCoverPlans(
    createProject({ id: "project-a", title: "KDP Authority", now: "2026-09-01T18:00:00.000Z" }),
    plans,
    "2026-09-01T18:10:00.000Z",
  );
}

function fileFacts(coverPlan, pageCount = 120) {
  return {
    interiorHasBleed: false,
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
      insideMarginInches: pageCount <= 150 ? 0.375 : 0.5,
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
      widthInches: coverPlan.dimensions.widthInches,
      heightInches: coverPlan.dimensions.heightInches,
      spineTextPresent: true,
    },
  };
}

test("KDP preflight resolves the newest durable Cover Studio plan deterministically", () => {
  const older = plan("cover-old", 120, "2026-09-01T18:01:00.000Z", 1);
  const newer = plan("cover-new", 200, "2026-09-01T18:05:00.000Z", 2);
  const project = projectWithPlans([newer, older]);
  assert.equal(resolveKdpCoverPlan(project).id, "cover-new");
  assert.equal(resolveKdpCoverPlan(project, "cover-old").id, "cover-old");
  assert.throws(() => resolveKdpCoverPlan(project, "missing"), /was not found/);
});

test("authoritative preflight audits measured files against durable production geometry", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "forge-kdp-authority-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const coverPlan = plan("cover-a", 120, "2026-09-01T18:01:00.000Z");
  const project = projectWithPlans([coverPlan]);
  const history = new KdpPreflightHistoryService(new FileKdpPreflightStore(join(root, "history.json")));
  const service = new StudioKdpPreflightService(history);
  const facts = fileFacts(coverPlan);

  const result = await service.audit({
    project,
    coverPlanId: coverPlan.id,
    ...facts,
    reportId: "authority-ready",
    now: "2026-09-01T18:20:00.000Z",
  });

  assert.equal(result.report.status, "ready");
  assert.equal(result.coverPlanId, coverPlan.id);
  assert.equal(result.coverPlanVersion, 1);
  assert.equal(result.coverPlanApprovalStatus, "approved");
  assert.equal((await history.list("project-a")).length, 1);
});

test("changing file geometry cannot change the expected production truth", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "forge-kdp-authority-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const coverPlan = plan("cover-a", 120, "2026-09-01T18:01:00.000Z");
  const project = projectWithPlans([coverPlan]);
  const history = new KdpPreflightHistoryService(new FileKdpPreflightStore(join(root, "history.json")));
  const service = new StudioKdpPreflightService(history);
  const facts = fileFacts(coverPlan);

  const result = await service.audit({
    project,
    ...facts,
    cover: { ...facts.cover, widthInches: coverPlan.dimensions.widthInches + 0.5 },
    reportId: "authority-blocked",
  });

  assert.equal(result.report.status, "blocked");
  assert.equal(result.report.findings.some((finding) => finding.code === "COVER_DIMENSIONS"), true);
});

test("page-count dependent margins come from the selected durable plan", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "forge-kdp-authority-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const oldPlan = plan("cover-120", 120, "2026-09-01T18:01:00.000Z", 1);
  const latestPlan = plan("cover-200", 200, "2026-09-01T18:05:00.000Z", 2);
  const project = projectWithPlans([oldPlan, latestPlan]);
  const history = new KdpPreflightHistoryService(new FileKdpPreflightStore(join(root, "history.json")));
  const service = new StudioKdpPreflightService(history);
  const facts = fileFacts(latestPlan, 120);

  const result = await service.audit({ project, ...facts, reportId: "margin-blocked" });
  assert.equal(result.coverPlanId, "cover-200");
  assert.equal(result.report.status, "blocked");
  assert.equal(result.report.findings.some((finding) => finding.code === "INTERIOR_GUTTER_MARGIN"), true);
});

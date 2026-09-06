import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { KdpPreflightHistoryService } from "../dist/application/kdp-preflight-history.js";
import { runKdpPreflightFromHttp, listKdpPreflightHistoryFromHttp } from "../dist/application/kdp-preflight-http.js";
import { BookCoverStudioService } from "../dist/application/book-cover-studio.js";
import { FileKdpPreflightStore } from "../dist/infrastructure/file-kdp-preflight-store.js";
import { FileProjectStore } from "../dist/infrastructure/file-project-store.js";
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

function payload() {
  const layout = calculateKdpCoverLayout(publishing);
  return {
    id: "http-audit",
    bookId: "book-1",
    // Deliberately untrusted and wrong. The production adapter must ignore this
    // object and resolve publishing geometry from the persisted Cover Studio plan.
    publishing: { ...publishing, trimWidthInches: 8.5, trimHeightInches: 11, pageCount: 999 },
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
    now: "2026-08-31T20:00:00.000Z",
  };
}

async function fixture(root, projectId = "project-a", includePlan = true) {
  const history = new KdpPreflightHistoryService(new FileKdpPreflightStore(join(root, "history.json")));
  const projectStore = new FileProjectStore(root);
  let project = createProject({ id: projectId, title: "Production Book" });
  if (includePlan) {
    const plan = new BookCoverStudioService().create({
      id: "cover-1",
      projectId,
      bookId: "book-1",
      format: "paperback",
      publishing,
      title: "Production Book",
      author: "Author",
      frontPrompt: "Front",
      spineText: "Production Book",
      backText: "Back",
      outputFormat: "pdf",
      dpi: 300,
      version: 1,
      approvalStatus: "draft",
    });
    project = withProjectBookCoverPlans(project, [plan]);
  }
  await projectStore.create(project);
  return { history, projectStore, projectId };
}

test("KDP preflight HTTP adapter audits against authoritative durable cover geometry", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-kdp-http-"));
  try {
    const deps = await fixture(root);
    const report = await runKdpPreflightFromHttp(deps, payload());
    assert.equal(report.status, "ready");
    const listed = await listKdpPreflightHistoryFromHttp(deps);
    assert.equal(listed.latest.id, "http-audit");
    assert.equal(listed.reports.length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("caller-supplied publishing geometry cannot trick KDP preflight", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-kdp-http-"));
  try {
    const deps = await fixture(root);
    const input = payload();
    input.cover = { ...input.cover, widthInches: input.cover.widthInches + 0.5 };
    const report = await runKdpPreflightFromHttp(deps, input);
    assert.equal(report.status, "blocked");
    assert.ok(report.findings.some((finding) => finding.code === "COVER_DIMENSIONS"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("KDP preflight requires a persisted KDP cover plan", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-kdp-http-"));
  try {
    const deps = await fixture(root, "project-a", false);
    await assert.rejects(() => runKdpPreflightFromHttp(deps, payload()), /KDP cover plan/);
    assert.equal((await deps.history.list("project-a")).length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("KDP preflight HTTP adapter rejects cross-project targeting", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-kdp-http-"));
  try {
    const deps = await fixture(root);
    await assert.rejects(
      runKdpPreflightFromHttp(deps, { ...payload(), projectId: "project-b" }),
      /cannot target another project/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("KDP preflight HTTP adapter rejects malformed production facts before persistence", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-kdp-http-"));
  try {
    const deps = await fixture(root);
    const input = payload();
    input.cover = { ...input.cover, encrypted: "false" };
    await assert.rejects(
      runKdpPreflightFromHttp(deps, input),
      /cover encrypted must be a boolean/,
    );
    assert.equal((await deps.history.list("project-a")).length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

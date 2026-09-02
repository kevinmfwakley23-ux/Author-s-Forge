import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { KdpPreflightHistoryService } from "../dist/application/kdp-preflight-history.js";
import { runKdpPreflightFromHttp, listKdpPreflightHistoryFromHttp } from "../dist/application/kdp-preflight-http.js";
import { FileKdpPreflightStore } from "../dist/infrastructure/file-kdp-preflight-store.js";
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

function projectFixture() {
  const project = createProject({ id: "project-a", title: "KDP HTTP Book", now: "2026-08-31T19:58:00.000Z" });
  const plan = new BookCoverStudioService().create({
    id: "cover-a",
    projectId: "project-a",
    bookId: "book-a",
    format: "paperback",
    publishing,
    title: "KDP HTTP Book",
    author: "Author",
    frontPrompt: "Front",
    spineText: "KDP HTTP Book",
    backText: "Back",
    outputFormat: "pdf",
    dpi: 300,
    version: 1,
    approvalStatus: "draft",
    now: "2026-08-31T19:59:00.000Z",
  });
  return withProjectBookCoverPlans(project, [plan]);
}

function payload() {
  const layout = calculateKdpCoverLayout(publishing);
  return {
    id: "http-audit",
    coverPlanId: "cover-a",
    bookId: "book-a",
    publishing,
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

function projectReader(project = projectFixture()) {
  return { load: async (id) => id === project.metadata.id ? project : null };
}

async function withHistory(run) {
  const root = await mkdtemp(join(tmpdir(), "forge-kdp-http-"));
  try {
    const history = new KdpPreflightHistoryService(new FileKdpPreflightStore(join(root, "history.json")));
    await run(history);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("KDP preflight HTTP adapter loads project authority, audits, persists, and lists history", async () => {
  await withHistory(async (history) => {
    const deps = { history, projectId: "project-a", projects: projectReader() };
    const report = await runKdpPreflightFromHttp(deps, payload());
    assert.equal(report.status, "ready");
    assert.equal(report.coverPlanId, "cover-a");
    assert.equal(report.bookId, "book-a");
    assert.equal(report.authoritativePublishing.trimWidthInches, 6);
    const listed = await listKdpPreflightHistoryFromHttp(deps);
    assert.equal(listed.latest.id, "http-audit");
    assert.equal(listed.reports.length, 1);
  });
});

test("KDP preflight HTTP adapter rejects cross-project targeting", async () => {
  await withHistory(async (history) => {
    await assert.rejects(
      runKdpPreflightFromHttp({ history, projectId: "project-a", projects: projectReader() }, { ...payload(), projectId: "project-b" }),
      /cannot target another project/,
    );
    assert.equal((await history.list("project-a")).length, 0);
  });
});

test("KDP preflight HTTP adapter rejects caller publishing geometry that conflicts with Cover Studio", async () => {
  await withHistory(async (history) => {
    const input = payload();
    input.publishing = { ...publishing, trimWidthInches: 7 };
    await assert.rejects(
      runKdpPreflightFromHttp({ history, projectId: "project-a", projects: projectReader() }, input),
      /disagrees with the durable Cover Studio plan \(trimWidthInches\)/,
    );
    assert.equal((await history.list("project-a")).length, 0);
  });
});

test("KDP preflight HTTP adapter rejects malformed production facts before persistence", async () => {
  await withHistory(async (history) => {
    const input = payload();
    input.cover = { ...input.cover, encrypted: "false" };
    await assert.rejects(
      runKdpPreflightFromHttp({ history, projectId: "project-a", projects: projectReader() }, input),
      /cover encrypted must be a boolean/,
    );
    assert.equal((await history.list("project-a")).length, 0);
  });
});

test("KDP preflight HTTP adapter fails honestly when the durable project cannot be loaded", async () => {
  await withHistory(async (history) => {
    await assert.rejects(
      runKdpPreflightFromHttp({ history, projectId: "project-a", projects: { load: async () => null } }, payload()),
      /Project "project-a" not found/,
    );
    assert.equal((await history.list("project-a")).length, 0);
  });
});

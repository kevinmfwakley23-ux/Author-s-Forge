import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { KdpPreflightHistoryService } from "../dist/application/kdp-preflight-history.js";
import { runKdpPreflightFromHttp, listKdpPreflightHistoryFromHttp } from "../dist/application/kdp-preflight-http.js";
import { FileKdpPreflightStore } from "../dist/infrastructure/file-kdp-preflight-store.js";
import { createBookCoverPlan } from "../dist/domain/book-cover-studio.js";
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

function project() {
  const coverPlan = createBookCoverPlan({
    id: "cover-plan-a",
    projectId: "project-a",
    bookId: "book-a",
    format: "paperback",
    publishing,
    title: "Production Book",
    author: "Author",
    frontPrompt: "Production-ready cover",
    spineText: "Production Book",
    backText: "Back cover",
    outputFormat: "pdf",
    dpi: 300,
    version: 1,
    approvalStatus: "approved",
    now: "2026-08-31T19:00:00.000Z",
  });
  return {
    state: withProjectBookCoverPlans(
      createProject({ id: "project-a", title: "Production Book", now: "2026-08-31T18:00:00.000Z" }),
      [coverPlan],
      "2026-08-31T19:00:00.000Z",
    ),
    coverPlan,
  };
}

function payload(coverPlan) {
  return {
    id: "http-audit",
    coverPlanId: coverPlan.id,
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
      widthInches: coverPlan.dimensions.widthInches,
      heightInches: coverPlan.dimensions.heightInches,
      spineTextPresent: true,
    },
    now: "2026-08-31T20:00:00.000Z",
  };
}

test("KDP preflight HTTP adapter audits measured files against the durable Cover Studio plan", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-kdp-http-"));
  try {
    const history = new KdpPreflightHistoryService(new FileKdpPreflightStore(join(root, "history.json")));
    const fixture = project();
    const deps = { history, project: fixture.state };
    const report = await runKdpPreflightFromHttp(deps, payload(fixture.coverPlan));
    assert.equal(report.status, "ready");
    const listed = await listKdpPreflightHistoryFromHttp(deps);
    assert.equal(listed.latest.id, "http-audit");
    assert.equal(listed.reports.length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("KDP preflight HTTP adapter rejects cross-project targeting", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-kdp-http-"));
  try {
    const history = new KdpPreflightHistoryService(new FileKdpPreflightStore(join(root, "history.json")));
    const fixture = project();
    await assert.rejects(
      runKdpPreflightFromHttp({ history, project: fixture.state }, { ...payload(fixture.coverPlan), projectId: "project-b" }),
      /cannot target another project/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("KDP preflight HTTP adapter rejects caller-supplied publishing geometry before persistence", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-kdp-http-"));
  try {
    const history = new KdpPreflightHistoryService(new FileKdpPreflightStore(join(root, "history.json")));
    const fixture = project();
    await assert.rejects(
      runKdpPreflightFromHttp(
        { history, project: fixture.state },
        { ...payload(fixture.coverPlan), publishing: { ...publishing, trimWidthInches: 7 } },
      ),
      /server-authoritative/,
    );
    assert.equal((await history.list("project-a")).length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("KDP preflight HTTP adapter rejects malformed production facts before persistence", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-kdp-http-"));
  try {
    const history = new KdpPreflightHistoryService(new FileKdpPreflightStore(join(root, "history.json")));
    const fixture = project();
    const input = payload(fixture.coverPlan);
    input.cover = { ...input.cover, encrypted: "false" };
    await assert.rejects(
      runKdpPreflightFromHttp({ history, project: fixture.state }, input),
      /cover encrypted must be a boolean/,
    );
    assert.equal((await history.list("project-a")).length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { KdpPreflightHistoryService } from "../dist/application/kdp-preflight-history.js";
import { runKdpPreflightFromHttp, listKdpPreflightHistoryFromHttp } from "../dist/application/kdp-preflight-http.js";
import { FileKdpPreflightStore } from "../dist/infrastructure/file-kdp-preflight-store.js";
import { calculateKdpCoverLayout } from "../dist/domain/book-cover-studio.js";

function payload() {
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
  const layout = calculateKdpCoverLayout(publishing);
  return {
    id: "http-audit",
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

test("KDP preflight HTTP adapter validates, audits, persists, and lists project history", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-kdp-http-"));
  try {
    const history = new KdpPreflightHistoryService(new FileKdpPreflightStore(join(root, "history.json")));
    const deps = { history, projectId: "project-a" };
    const report = await runKdpPreflightFromHttp(deps, payload());
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
    await assert.rejects(
      runKdpPreflightFromHttp({ history, projectId: "project-a" }, { ...payload(), projectId: "project-b" }),
      /cannot target another project/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("KDP preflight HTTP adapter rejects malformed production facts before persistence", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-kdp-http-"));
  try {
    const history = new KdpPreflightHistoryService(new FileKdpPreflightStore(join(root, "history.json")));
    const input = payload();
    input.cover = { ...input.cover, encrypted: "false" };
    await assert.rejects(
      runKdpPreflightFromHttp({ history, projectId: "project-a" }, input),
      /cover encrypted must be a boolean/,
    );
    assert.equal((await history.list("project-a")).length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

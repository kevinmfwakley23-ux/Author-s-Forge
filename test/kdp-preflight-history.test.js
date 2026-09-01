import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { KdpPreflightHistoryService } from "../dist/application/kdp-preflight-history.js";
import { FileKdpPreflightStore } from "../dist/infrastructure/file-kdp-preflight-store.js";
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

function request(id, projectId, now, coverWidthOffset = 0) {
  const layout = calculateKdpCoverLayout(publishing);
  return {
    id,
    projectId,
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
      widthInches: layout.dimensions.widthInches + coverWidthOffset,
      heightInches: layout.dimensions.heightInches,
      spineTextPresent: true,
    },
    now,
  };
}

test("KDP preflight history survives service restart and stays project scoped", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-kdp-history-"));
  try {
    const path = join(root, "kdp-preflight.json");
    const service = new KdpPreflightHistoryService(new FileKdpPreflightStore(path));
    await service.audit(request("audit-a", "project-a", "2026-08-31T18:00:00.000Z"));
    await service.audit(request("audit-b", "project-b", "2026-08-31T18:01:00.000Z", 0.5));

    const restarted = new KdpPreflightHistoryService(new FileKdpPreflightStore(path));
    const projectA = await restarted.list("project-a");
    const projectB = await restarted.list("project-b");

    assert.equal(projectA.length, 1);
    assert.equal(projectA[0].id, "audit-a");
    assert.equal(projectA[0].status, "ready");
    assert.equal(projectB.length, 1);
    assert.equal(projectB[0].status, "blocked");
    assert.ok(projectB[0].findings.some((finding) => finding.code === "COVER_DIMENSIONS"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("KDP preflight history returns newest report first and protects stored snapshots", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-kdp-history-"));
  try {
    const path = join(root, "kdp-preflight.json");
    const service = new KdpPreflightHistoryService(new FileKdpPreflightStore(path));
    await service.audit(request("audit-old", "project-a", "2026-08-31T18:00:00.000Z", 0.5));
    await service.audit(request("audit-new", "project-a", "2026-08-31T19:00:00.000Z"));

    const list = await service.list("project-a");
    assert.deepEqual(list.map((report) => report.id), ["audit-new", "audit-old"]);
    assert.equal((await service.latest("project-a")).id, "audit-new");

    list[0].findings.push?.({ code: "MUTATION", severity: "error", area: "cover", message: "bad", remediation: "bad" });
    assert.equal((await service.latest("project-a")).findings.some((finding) => finding.code === "MUTATION"), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("KDP preflight history rejects duplicate audit ids", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-kdp-history-"));
  try {
    const service = new KdpPreflightHistoryService(new FileKdpPreflightStore(join(root, "kdp-preflight.json")));
    await service.audit(request("audit-dup", "project-a", "2026-08-31T18:00:00.000Z"));
    await assert.rejects(
      service.audit(request("audit-dup", "project-a", "2026-08-31T18:01:00.000Z")),
      /Duplicate KDP preflight report id/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

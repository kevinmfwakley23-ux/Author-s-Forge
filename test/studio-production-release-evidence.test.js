const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const { mkdtemp, rm } = require("node:fs/promises");
const { join } = require("node:path");
const { tmpdir } = require("node:os");

const { createProject, withProjectStudioWorkspace, withProjectBookCoverPlans } = require("../.forge-build/domain/project.js");
const {
  createStudioWorkspace,
  createWorkspaceBook,
  addWorkspaceBook,
  addWorkspaceChapter,
  addWorkspaceScene,
  saveSceneContent,
} = require("../.forge-build/domain/studio-workspace.js");
const { createBookCoverPlan } = require("../.forge-build/domain/book-cover-studio.js");
const { FileProjectStore } = require("../.forge-build/infrastructure/file-project-store.js");
const { FileProductionArtifactVault } = require("../.forge-build/infrastructure/file-production-artifact-vault.js");
const { StudioPublishingMetadataService } = require("../.forge-build/application/studio-publishing-metadata.js");
const { createStudioProductionExportRoutes } = require("../.forge-build/application/studio-production-export-routes.js");
const { createStudioPublishingRoutes } = require("../.forge-build/application/studio-publishing-routes.js");

async function invoke(handler, projectId, path, method = "GET", payload) {
  const req = Readable.from(payload === undefined ? [] : [JSON.stringify(payload)]);
  req.method = method;
  let status = 0;
  let text = "";
  const res = {
    writeHead(value) { status = value; },
    end(value = "") { text += String(value); },
  };
  const handled = await handler(req, res, new URL(`http://forge.local${path}`), projectId);
  assert.equal(handled, true, `${method} ${path} should be handled`);
  return { status, payload: text ? JSON.parse(text) : null };
}

function check(report, id) {
  const found = report.checks.find((entry) => entry.id === id);
  assert.ok(found, `missing readiness check ${id}`);
  return found;
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "forge-production-release-"));
  const projectId = "project-production-release";
  const bookId = "book-production-release";
  const chapterId = "chapter-production-release";
  const sceneId = "scene-production-release";

  let workspace = createStudioWorkspace();
  workspace = addWorkspaceBook(workspace, createWorkspaceBook({
    id: bookId,
    title: "Current Source Release",
    kind: "novel",
    description: "A text-only release fixture for source-bound production evidence.",
    now: "2026-09-09T12:00:00.000Z",
  }));
  workspace = addWorkspaceChapter(workspace, bookId, {
    id: chapterId,
    number: 1,
    title: "Chapter One",
    synopsis: "The release chapter.",
  });
  workspace = addWorkspaceScene(workspace, bookId, chapterId, {
    id: sceneId,
    number: 1,
    title: "Scene One",
    synopsis: "The release scene.",
  });
  workspace = saveSceneContent(workspace, bookId, chapterId, sceneId, "The first durable manuscript revision.");

  let project = withProjectStudioWorkspace(
    createProject({ id: projectId, title: "Production Release Evidence", now: "2026-09-09T12:00:00.000Z" }),
    workspace,
    "2026-09-09T12:01:00.000Z",
  );
  const cover = createBookCoverPlan({
    id: "ebook-cover-release",
    projectId,
    bookId,
    format: "ebook",
    publishing: {
      platform: "kdp",
      binding: "paperback",
      interiorType: "black-white",
      paperType: "white",
      trimWidthInches: 6,
      trimHeightInches: 9,
      pageCount: 100,
      bleedInches: 0.125,
      readingDirection: "ltr",
    },
    title: "Current Source Release",
    author: "Forge Author",
    frontPrompt: "Approved eBook cover direction.",
    spineText: "Current Source Release",
    backText: "Release fixture cover copy.",
    outputUri: "/artifacts/current-source-release.jpg",
    outputFormat: "jpeg",
    dpi: 300,
    version: 1,
    approvalStatus: "approved",
    now: "2026-09-09T12:02:00.000Z",
  });
  project = withProjectBookCoverPlans(project, [cover], "2026-09-09T12:03:00.000Z");

  const store = new FileProjectStore(root);
  const vault = new FileProductionArtifactVault(root);
  await store.create(project);
  await new StudioPublishingMetadataService(store).save(projectId, bookId, {
    title: "Current Source Release",
    author: "Forge Author",
    contributors: [],
    description: "A complete publication description for source-bound release verification.",
    keywords: ["release integrity"],
    categories: ["Fiction"],
    primaryAudience: "general",
    primaryMarketplace: "Amazon.com",
    language: "en",
    formats: ["ebook"],
    isbnStrategy: "kdp-free",
    lowContent: false,
    aiContent: { text: "none", images: "none", translations: "none" },
  }, { now: "2026-09-09T12:04:00.000Z", reference: "production-release-evidence-test" });

  return { root, store, vault, projectId, bookId, chapterId, sceneId };
}

async function exportEpub(exportRoutes, projectId, bookId) {
  const response = await invoke(
    exportRoutes,
    projectId,
    `/api/projects/${projectId}/export`,
    "POST",
    { bookId, format: "epub", pageSize: "6x9", pageNumbers: true, includeTitlePage: true, includeToc: true },
  );
  assert.equal(response.status, 200);
  assert.equal(response.payload.persisted, true);
  assert.equal(response.payload.format, "epub");
  assert.match(response.payload.evidence.sourceSha256, /^[a-f0-9]{64}$/);
  return response.payload;
}

async function readiness(publishingRoutes, projectId, bookId) {
  const response = await invoke(
    publishingRoutes,
    projectId,
    `/api/projects/${projectId}/publishing/readiness`,
    "POST",
    { bookId, releaseFormat: "ebook", evidence: { manuscript: {}, images: { required: false }, formatting: {} } },
  );
  assert.equal(response.status, 201);
  return response.payload;
}

test("release evidence follows the exact current manuscript and requires re-export after author edits", async (t) => {
  const { root, store, vault, projectId, bookId, chapterId, sceneId } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const exportRoutes = createStudioProductionExportRoutes(store, vault);
  const publishingRoutes = createStudioPublishingRoutes(store, vault);

  const firstExport = await exportEpub(exportRoutes, projectId, bookId);
  const firstReadiness = await readiness(publishingRoutes, projectId, bookId);
  assert.equal(check(firstReadiness, "production-validation").status, "passed");
  assert.equal(firstReadiness.checks.filter((entry) => entry.status === "attention" && entry.severity === "error").length, 0);

  const loaded = await store.load(projectId);
  assert.ok(loaded?.studioWorkspace);
  const changedWorkspace = saveSceneContent(
    loaded.studioWorkspace,
    bookId,
    chapterId,
    sceneId,
    "The author changed the durable manuscript after the first export, so the previous EPUB must become stale.",
  );
  await store.save(withProjectStudioWorkspace(loaded, changedWorkspace, new Date().toISOString()));

  const gate = await invoke(
    publishingRoutes,
    projectId,
    `/api/projects/${projectId}/release-gate?bookId=${encodeURIComponent(bookId)}&format=ebook`,
  );
  assert.equal(gate.status, 200);
  assert.equal(gate.payload.status, "blocked");
  const stale = gate.payload.blockers.find((entry) => entry.id === "publishing-readiness-stale");
  assert.ok(stale, "release gate should report stale Publishing readiness after manuscript drift");
  assert.match(stale.message, /no verified ebook production artifact matches the current manuscript/i);

  const staleReadiness = await readiness(publishingRoutes, projectId, bookId);
  assert.equal(check(staleReadiness, "production-validation").status, "attention", "old EPUB cannot validate the edited manuscript");
  assert.equal(check(staleReadiness, "format-validation").status, "attention");

  const secondExport = await exportEpub(exportRoutes, projectId, bookId);
  assert.notEqual(secondExport.evidence.sourceSha256, firstExport.evidence.sourceSha256, "author manuscript edit must change the production source fingerprint");
  const restored = await readiness(publishingRoutes, projectId, bookId);
  assert.equal(check(restored, "production-validation").status, "passed");
  assert.equal(restored.checks.filter((entry) => entry.status === "attention" && entry.severity === "error").length, 0);

  const records = await vault.list(projectId, { bookId, formats: ["epub"] });
  assert.equal(records.length, 2, "both historical production artifacts should remain auditable");
  assert.notEqual(records[0].sourceSha256, records[1].sourceSha256, "artifact history must preserve both manuscript revisions");
});

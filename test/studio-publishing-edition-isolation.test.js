const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const { createProject, withProjectStudioWorkspace, withProjectBookCoverPlans } = require("../.forge-build/domain/project.js");
const { createStudioWorkspace, createWorkspaceBook, addWorkspaceBook, addWorkspaceChapter } = require("../.forge-build/domain/studio-workspace.js");
const { createBookCoverPlan } = require("../.forge-build/domain/book-cover-studio.js");
const { FileProjectStore } = require("../.forge-build/infrastructure/file-project-store.js");
const { StudioPublishingMetadataService } = require("../.forge-build/application/studio-publishing-metadata.js");
const { createStudioPublishingRoutes } = require("../.forge-build/application/studio-publishing-routes.js");

async function invoke(handler, projectId, path, payload) {
  const req = Readable.from(payload === undefined ? [] : [JSON.stringify(payload)]);
  req.method = payload === undefined ? "GET" : "POST";
  let status = 0;
  let text = "";
  const res = {
    writeHead(value) { status = value; },
    end(value = "") { text += String(value); },
  };
  const handled = await handler(req, res, new URL(`http://forge.local${path}`), projectId);
  assert.equal(handled, true);
  return { status, payload: text ? JSON.parse(text) : null };
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "forge-edition-isolation-"));
  const projectId = "project-edition-isolation";
  const bookId = "book-edition-isolation";
  let workspace = createStudioWorkspace();
  workspace = addWorkspaceBook(workspace, createWorkspaceBook({
    id: bookId,
    title: "Edition Isolation",
    kind: "novel",
    description: "A release-integrity fixture that proves evidence stays scoped to the exact edition.",
    now: "2026-08-31T10:00:00.000Z",
  }));
  workspace = addWorkspaceChapter(workspace, bookId, {
    id: "chapter-1",
    number: 1,
    title: "Chapter One",
    synopsis: "The first chapter.",
  });
  let project = withProjectStudioWorkspace(
    createProject({ id: projectId, title: "Edition Isolation", now: "2026-08-31T10:00:00.000Z" }),
    workspace,
    "2026-08-31T10:01:00.000Z",
  );
  const paperback = createBookCoverPlan({
    id: "paperback-cover-only",
    projectId,
    bookId,
    format: "paperback",
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
    title: "Edition Isolation",
    author: "Forge Author",
    frontPrompt: "A production-ready paperback cover concept.",
    spineText: "Edition Isolation",
    backText: "A valid paperback back cover.",
    outputUri: "/artifacts/edition-isolation-paperback.pdf",
    outputFormat: "pdf",
    dpi: 300,
    version: 1,
    approvalStatus: "approved",
    now: "2026-08-31T10:02:00.000Z",
  });
  project = withProjectBookCoverPlans(project, [paperback], "2026-08-31T10:03:00.000Z");
  const store = new FileProjectStore(root);
  await store.create(project);
  await new StudioPublishingMetadataService(store).save(projectId, bookId, {
    title: "Edition Isolation",
    author: "Forge Author",
    contributors: [],
    description: "A sufficiently detailed publication description used to verify exact-edition release evidence inside Author's Forge.",
    keywords: ["edition isolation"],
    categories: ["Fiction"],
    primaryAudience: "general",
    primaryMarketplace: "Amazon.com",
    language: "en",
    formats: ["ebook", "paperback"],
    isbnStrategy: "kdp-free",
    lowContent: false,
    aiContent: { text: "none", images: "none", translations: "none" },
  }, { now: "2026-08-31T10:04:00.000Z", reference: "edition-isolation-test" });
  return { root, store, projectId, bookId };
}

function ebookReadinessEvidence(withCover = false) {
  return {
    manuscript: {
      hasTitlePage: true,
      hasCopyrightPage: true,
      hasTableOfContents: true,
    },
    ...(withCover ? { cover: { format: "ebook", fileType: "jpeg", hasFront: true, validated: true } } : {}),
    images: { required: false },
    formatting: { fileTypes: ["epub"], validated: true },
    production: { fileTypes: ["epub"], validated: true },
  };
}

test("ebook readiness cannot inherit an approved paperback cover from the same book", async (t) => {
  const { root, store, projectId, bookId } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const handler = createStudioPublishingRoutes(store);
  const response = await invoke(handler, projectId, `/api/projects/${projectId}/publishing/readiness`, {
    bookId,
    releaseFormat: "ebook",
    now: "2026-08-31T10:05:00.000Z",
    evidence: ebookReadinessEvidence(false),
  });

  assert.equal(response.status, 201);
  assert.equal(response.payload.releaseFormat, "ebook");
  const coverFile = response.payload.checks.find((check) => check.id === "cover-file");
  const coverFront = response.payload.checks.find((check) => check.id === "cover-front");
  const coverValidation = response.payload.checks.find((check) => check.id === "cover-validation");
  assert.equal(coverFile.status, "attention", "paperback PDF must not become ebook cover-file evidence");
  assert.equal(coverFront.status, "attention", "paperback front cover must not satisfy ebook front-cover evidence");
  assert.equal(coverValidation.status, "attention", "paperback approval must not satisfy ebook cover validation");
  assert.equal(response.payload.checks.find((check) => check.id === "cover-back").status, "passed", "ebook correctly does not require a back cover");
  assert.equal(response.payload.checks.find((check) => check.id === "cover-spine").status, "passed", "ebook correctly does not require a spine");
});

test("release gate blocks an ebook readiness audit after Publishing metadata changes", async (t) => {
  const { root, store, projectId, bookId } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const handler = createStudioPublishingRoutes(store);
  const readiness = await invoke(handler, projectId, `/api/projects/${projectId}/publishing/readiness`, {
    bookId,
    releaseFormat: "ebook",
    now: "2026-08-31T10:05:00.000Z",
    evidence: ebookReadinessEvidence(true),
  });
  assert.equal(readiness.status, 201);
  assert.equal(readiness.payload.checks.filter((check) => check.status === "attention" && check.severity === "error").length, 0, "fixture should have no release-blocking Publishing errors before mutation");

  const metadataService = new StudioPublishingMetadataService(store);
  const current = await metadataService.get(projectId, bookId);
  assert.ok(current);
  const { formatVersion, projectId: ignoredProject, bookId: ignoredBook, updatedAt, ...editable } = current.metadata;
  await metadataService.save(projectId, bookId, {
    ...editable,
    description: `${editable.description} This later revision intentionally invalidates the earlier readiness audit.`,
  }, { now: "2026-08-31T10:06:00.000Z", reference: "stale-readiness-test" });

  const gate = await invoke(handler, projectId, `/api/projects/${projectId}/release-gate?bookId=${encodeURIComponent(bookId)}&format=ebook`);
  assert.equal(gate.status, 200);
  assert.equal(gate.payload.status, "blocked");
  const stale = gate.payload.blockers.find((blocker) => blocker.id === "publishing-readiness-stale");
  assert.ok(stale, "release gate must surface a stale Publishing readiness blocker");
  assert.match(stale.message, /metadata changed after the readiness audit/i);
  assert.match(stale.remediation, /run Publishing readiness again/i);
});

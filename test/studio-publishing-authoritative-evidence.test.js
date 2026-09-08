const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const {
  createProject,
  withProjectStudioWorkspace,
  withProjectBookCoverPlans,
  withProjectIllustrationAssetLibrary,
} = require("../.forge-build/domain/project.js");
const { createStudioWorkspace, createWorkspaceBook, addWorkspaceBook, addWorkspaceChapter } = require("../.forge-build/domain/studio-workspace.js");
const { createBookCoverPlan } = require("../.forge-build/domain/book-cover-studio.js");
const { createIllustrationAsset } = require("../.forge-build/domain/illustration-asset-library.js");
const { FileProjectStore } = require("../.forge-build/infrastructure/file-project-store.js");
const { StudioPublishingMetadataService } = require("../.forge-build/application/studio-publishing-metadata.js");
const { createStudioPublishingRoutes } = require("../.forge-build/application/studio-publishing-routes.js");

async function invoke(handler, projectId, payload) {
  const req = Readable.from([JSON.stringify(payload)]);
  req.method = "POST";
  let status = 0;
  let text = "";
  const res = {
    writeHead(value) { status = value; },
    end(value = "") { text += String(value); },
  };
  const handled = await handler(req, res, new URL(`http://forge.local/api/projects/${projectId}/publishing/readiness`), projectId);
  assert.equal(handled, true);
  return { status, payload: JSON.parse(text) };
}

async function fixture({ withProductionAssets = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), "forge-publishing-authority-"));
  const projectId = "publishing-authority";
  const bookId = "book-authority";
  let workspace = createStudioWorkspace();
  workspace = addWorkspaceBook(workspace, createWorkspaceBook({
    id: bookId,
    title: "Durable Project Truth",
    kind: "childrens-book",
    description: "A fixture for authoritative publishing readiness.",
    now: "2026-09-08T18:00:00.000Z",
  }));
  workspace = addWorkspaceChapter(workspace, bookId, {
    id: "chapter-1",
    number: 1,
    title: "Chapter One",
    synopsis: "The durable chapter that browser evidence cannot replace.",
  });
  let project = withProjectStudioWorkspace(
    createProject({ id: projectId, title: "Publishing Authority", now: "2026-09-08T18:00:00.000Z" }),
    workspace,
    "2026-09-08T18:01:00.000Z",
  );

  if (withProductionAssets) {
    const cover = createBookCoverPlan({
      id: "paperback-cover",
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
        pageCount: 120,
        bleedInches: 0.125,
        readingDirection: "ltr",
      },
      title: "Durable Project Truth",
      author: "Forge Author",
      frontPrompt: "Approved production cover",
      spineText: "Durable Project Truth",
      backText: "Approved back cover copy",
      outputUri: "/artifacts/durable-project-truth.pdf",
      outputFormat: "pdf",
      dpi: 300,
      version: 1,
      approvalStatus: "approved",
      now: "2026-09-08T18:02:00.000Z",
    });
    project = withProjectBookCoverPlans(project, [cover], "2026-09-08T18:03:00.000Z");
    const illustration = createIllustrationAsset({
      id: "illustration-1",
      projectId,
      bookId,
      chapterId: "chapter-1",
      sceneId: "scene-1",
      characterId: "character-1",
      locationId: "location-1",
      prompt: "Approved production illustration",
      references: [],
      style: "children's publishing test",
      generationSettings: { dpi: 300 },
      approvalStatus: "approved",
      assetUri: "/artifacts/illustration-1.png",
      now: "2026-09-08T18:04:00.000Z",
    });
    project = withProjectIllustrationAssetLibrary(project, {
      formatVersion: 1,
      projectId,
      assets: [illustration],
      characterDesignLocks: [],
    }, "2026-09-08T18:05:00.000Z");
  }

  const store = new FileProjectStore(root);
  await store.create(project);
  await new StudioPublishingMetadataService(store).save(projectId, bookId, {
    title: "Durable Project Truth",
    author: "Forge Author",
    contributors: [],
    description: "A complete publishing description used by the authoritative readiness regression test.",
    keywords: ["publishing integrity"],
    categories: ["Children's Fiction"],
    primaryAudience: "children",
    readingAgeMin: 5,
    readingAgeMax: 9,
    primaryMarketplace: "Amazon.com",
    language: "en",
    formats: ["paperback"],
    isbnStrategy: "kdp-free",
    lowContent: false,
    aiContent: { text: "none", images: "none", translations: "none" },
  }, { now: "2026-09-08T18:06:00.000Z", reference: "authoritative-evidence-test" });
  return { root, store, projectId, bookId };
}

function evidence() {
  return {
    manuscript: {
      title: "FORGED BROWSER TITLE",
      author: "FORGED BROWSER AUTHOR",
      chapters: [{ title: "Forged Chapter", number: 1 }],
      hasTitlePage: true,
      hasCopyrightPage: true,
      hasTableOfContents: true,
      pageCount: 120,
    },
    cover: {
      format: "paperback",
      fileType: "pdf",
      hasFront: true,
      hasBack: true,
      hasSpine: true,
      hasBarcodeSafeArea: true,
      hasBleed: true,
      hasTrim: true,
      hasSafeMargins: true,
      widthInches: 99,
      heightInches: 99,
      validated: true,
    },
    images: {
      required: false,
      count: 999,
      allResolved: true,
      allApproved: true,
      resolutionValidated: true,
    },
    formatting: {
      fileTypes: ["pdf"],
      validated: true,
      pageNumbering: true,
      headersFooters: true,
    },
    production: {
      trim: true,
      bleed: true,
      fileTypes: ["pdf"],
      validated: true,
    },
  };
}

function check(report, id) {
  const found = report.checks.find((entry) => entry.id === id);
  assert.ok(found, `missing readiness check ${id}`);
  return found;
}

test("browser assertions cannot manufacture cover or illustration readiness", async (t) => {
  const { root, store, projectId, bookId } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const response = await invoke(createStudioPublishingRoutes(store), projectId, {
    bookId,
    releaseFormat: "paperback",
    evidence: evidence(),
    now: "2026-09-08T18:07:00.000Z",
  });

  assert.equal(response.status, 201);
  assert.equal(check(response.payload, "cover-file").status, "attention");
  assert.equal(check(response.payload, "cover-front").status, "attention");
  assert.equal(check(response.payload, "cover-validation").status, "attention");
  assert.equal(check(response.payload, "images-present").status, "attention", "a children's book cannot disable required images from the browser");
  assert.equal(check(response.payload, "image-resolution").status, "attention", "browser resolution claims cannot replace saved image evidence");
});

test("saved approved Cover Studio and illustration evidence satisfies those readiness checks", async (t) => {
  const { root, store, projectId, bookId } = await fixture({ withProductionAssets: true });
  t.after(() => rm(root, { recursive: true, force: true }));
  const response = await invoke(createStudioPublishingRoutes(store), projectId, {
    bookId,
    releaseFormat: "paperback",
    evidence: evidence(),
    now: "2026-09-08T18:08:00.000Z",
  });

  assert.equal(response.status, 201);
  assert.equal(check(response.payload, "cover-file").status, "passed");
  assert.equal(check(response.payload, "cover-front").status, "passed");
  assert.equal(check(response.payload, "cover-validation").status, "passed");
  assert.equal(check(response.payload, "images-present").status, "passed");
  assert.equal(check(response.payload, "images-resolved").status, "passed");
  assert.equal(check(response.payload, "images-approved").status, "passed");
  assert.equal(check(response.payload, "image-resolution").status, "passed");
});

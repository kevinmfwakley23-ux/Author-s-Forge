const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { spawn } = require("node:child_process");
const { BookCoverStudioService } = require("../dist/application/book-cover-studio.js");
const { calculateKdpCoverLayout } = require("../dist/domain/book-cover-studio.js");
const { createProject, withProjectBookCoverPlans } = require("../dist/domain/project.js");
const { FileProjectStore } = require("../dist/infrastructure/file-project-store.js");

const projectId = "forge-studio";
const bookId = "kdp-route-book";
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

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Studio server did not start within 5 seconds.")), 5000);
    const onData = (chunk) => {
      if (String(chunk).includes("Author's Forge Studio:")) {
        clearTimeout(timeout);
        child.stdout.off("data", onData);
        resolve();
      }
    };
    child.stdout.on("data", onData);
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Studio server exited before startup: ${code}`));
    });
  });
}

function validPayload() {
  const layout = calculateKdpCoverLayout(publishing);
  return {
    id: "studio-preflight-1",
    bookId,
    // The route must ignore caller publishing geometry and use the durable Cover Studio plan below.
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
    now: "2026-08-31T21:00:00.000Z",
  };
}

async function seedAuthoritativeCoverPlan(dataDir) {
  const store = new FileProjectStore(dataDir);
  const plan = new BookCoverStudioService().create({
    id: "kdp-route-cover-plan",
    projectId,
    bookId,
    format: "paperback",
    publishing,
    title: "Production Book",
    author: "Forge Author",
    frontPrompt: "Author-approved front-cover direction",
    spineText: "Production Book",
    backText: "Author-approved back-cover copy",
    outputFormat: "pdf",
    dpi: 300,
    version: 1,
    approvalStatus: "draft",
  });
  const project = withProjectBookCoverPlans(createProject({ id: projectId, title: "KDP Route Test" }), [plan]);
  await store.create(project);
}

test("Studio exposes durable KDP production preflight and restores history after restart", async () => {
  const port = 5600 + Math.floor(Math.random() * 300);
  const dataDir = await mkdtemp(join(tmpdir(), "authors-forge-kdp-route-"));
  const env = { ...process.env, PORT: String(port), HOST: "127.0.0.1", FORGE_DATA_DIR: dataDir, OPENAI_API_KEY: "", OPENAI_MODEL: "" };
  let child;
  try {
    await seedAuthoritativeCoverPlan(dataDir);
    child = spawn(process.execPath, ["dist/studio-server.js"], { env, stdio: ["ignore", "pipe", "pipe"] });
    await waitForServer(child);
    const base = `http://127.0.0.1:${port}`;
    const create = await fetch(`${base}/api/projects/${projectId}/production/kdp-preflight`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validPayload()),
    });
    const created = await create.json();
    assert.equal(create.status, 201, JSON.stringify(created));
    assert.equal(created.status, "ready");
    assert.equal(created.projectId, projectId);

    const historyResponse = await fetch(`${base}/api/projects/${projectId}/production/kdp-preflight`);
    const history = await historyResponse.json();
    assert.equal(historyResponse.ok, true, JSON.stringify(history));
    assert.equal(history.latest.id, "studio-preflight-1");
    assert.equal(history.reports.length, 1);

    const crossProject = await fetch(`${base}/api/projects/${projectId}/production/kdp-preflight`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...validPayload(), id: "cross-project", projectId: "another-project" }),
    });
    const crossPayload = await crossProject.json();
    assert.equal(crossProject.status, 400);
    assert.match(crossPayload.error, /cannot target another project/);

    child.kill("SIGTERM");
    await new Promise((resolve) => child.once("exit", resolve));
    child = spawn(process.execPath, ["dist/studio-server.js"], { env, stdio: ["ignore", "pipe", "pipe"] });
    await waitForServer(child);

    const recoveredResponse = await fetch(`${base}/api/projects/${projectId}/production/kdp-preflight`);
    const recovered = await recoveredResponse.json();
    assert.equal(recoveredResponse.ok, true, JSON.stringify(recovered));
    assert.equal(recovered.latest.id, "studio-preflight-1");
    assert.equal(recovered.reports.length, 1);
  } finally {
    if (child) {
      child.kill("SIGTERM");
      await new Promise((resolve) => {
        if (child.exitCode !== null) return resolve();
        const timer = setTimeout(resolve, 1000);
        child.once("exit", () => { clearTimeout(timer); resolve(); });
      });
    }
    await rm(dataDir, { recursive: true, force: true });
  }
});

const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { createProject, withProjectStudioWorkspace } = require("../.forge-build/domain/project.js");
const { createStudioWorkspace, createWorkspaceBook, addWorkspaceBook, addWorkspaceChapter, addWorkspaceScene } = require("../.forge-build/domain/studio-workspace.js");
const { FileProjectStore } = require("../.forge-build/infrastructure/file-project-store.js");
const { StudioImageLabService } = require("../.forge-build/application/studio-image-lab.js");

async function fixture(generator) {
  const root = await mkdtemp(join(tmpdir(), "forge-image-lab-"));
  const store = new FileProjectStore(root);
  let workspace = createStudioWorkspace();
  workspace = addWorkspaceBook(workspace, createWorkspaceBook({ id: "book-1", title: "Illustrated Book", kind: "childrens-book", now: "2026-09-01T18:00:00.000Z" }));
  workspace = addWorkspaceChapter(workspace, "book-1", { id: "chapter-1", number: 1, title: "Opening", now: "2026-09-01T18:01:00.000Z" });
  workspace = addWorkspaceScene(workspace, "book-1", "chapter-1", { id: "scene-1", number: 1, title: "Forest", now: "2026-09-01T18:02:00.000Z" });
  const project = withProjectStudioWorkspace(createProject({ id: "project-1", title: "Image Lab Acceptance", now: "2026-09-01T18:00:00.000Z" }), workspace, "2026-09-01T18:02:00.000Z");
  await store.create(project);
  return { root, store, service: new StudioImageLabService(store, generator) };
}

function successfulGenerator(calls) {
  return async (request) => {
    calls.push(request);
    return Object.freeze({ provider: "openai", model: "gpt-image-2", mimeType: "image/png", bytesBase64: "QUJDRA==", dataUri: "data:image/png;base64,QUJDRA==", requestId: `req-${calls.length}`, size: request.size || "1024x1024", quality: request.quality || "medium" });
  };
}

test("new Image Lab generations persist as pending durable assets and survive restart", async (t) => {
  const calls = [], { root, store, service } = await fixture(successfulGenerator(calls));
  t.after(() => rm(root, { recursive: true, force: true }));
  const result = await service.generate({ projectId: "project-1", prompt: "A moonlit forest clearing", style: "watercolor picture book", purpose: "illustration", now: "2026-09-01T18:03:00.000Z" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].context.projectId, "project-1");
  assert.match(calls[0].prompt, /moonlit forest clearing/i);
  assert.equal(result.asset.approvalStatus, "pending");
  assert.equal(result.asset.assetUri, "data:image/png;base64,QUJDRA==");
  assert.equal(result.asset.reusedFromAssetId, undefined);
  assert.equal(result.provider, "openai");
  const persisted = await store.load("project-1");
  assert.equal(persisted.illustrationAssetLibrary.assets.length, 1);
  const restarted = new StudioImageLabService(new FileProjectStore(root), successfulGenerator([]));
  const history = await restarted.list("project-1");
  assert.equal(history.length, 1);
  assert.equal(history[0].id, result.asset.id);
});

test("uploaded source images are preserved and edits create pending derivative lineage", async (t) => {
  const calls = [], { root, store, service } = await fixture(successfulGenerator(calls));
  t.after(() => rm(root, { recursive: true, force: true }));
  const original = "data:image/png;base64,QUJDRA==";
  const result = await service.generate({ projectId: "project-1", prompt: "Keep the character exactly the same but change the sky to dawn", style: "soft watercolor", purpose: "character-reference", referenceImage: original, referenceLabel: "Author-approved Luke design", now: "2026-09-01T18:04:00.000Z" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].referenceImages.length, 1);
  assert.equal(calls[0].referenceImages[0].dataUri, original);
  assert.ok(result.sourceAsset);
  assert.equal(result.sourceAsset.assetUri, original);
  assert.equal(result.sourceAsset.approvalStatus, "approved");
  assert.equal(result.asset.reusedFromAssetId, result.sourceAsset.id);
  assert.equal(result.asset.approvalStatus, "pending");
  assert.equal(result.asset.references[0].uri, original);
  const persisted = await store.load("project-1");
  assert.equal(persisted.illustrationAssetLibrary.assets.length, 2);
  assert.equal(persisted.illustrationAssetLibrary.assets.find((asset) => asset.id === result.sourceAsset.id).assetUri, original);
});

test("editing an existing stored image never mutates the source and review is explicit", async (t) => {
  const calls = [], { root, store, service } = await fixture(successfulGenerator(calls));
  t.after(() => rm(root, { recursive: true, force: true }));
  const first = await service.generate({ projectId: "project-1", prompt: "Forest guardian", now: "2026-09-01T18:05:00.000Z" });
  const accepted = await service.review({ projectId: "project-1", assetId: first.asset.id, decision: "approved", now: "2026-09-01T18:06:00.000Z" });
  assert.equal(accepted.asset.approvalStatus, "approved");
  const edited = await service.generate({ projectId: "project-1", prompt: "Keep identity and composition; add gentle falling snow", sourceAssetId: first.asset.id, now: "2026-09-01T18:07:00.000Z" });
  assert.equal(edited.asset.reusedFromAssetId, first.asset.id);
  assert.equal(edited.asset.approvalStatus, "pending");
  const rejected = await service.review({ projectId: "project-1", assetId: edited.asset.id, decision: "rejected", now: "2026-09-01T18:08:00.000Z" });
  assert.equal(rejected.asset.approvalStatus, "rejected");
  const persisted = await store.load("project-1");
  const source = persisted.illustrationAssetLibrary.assets.find((asset) => asset.id === first.asset.id);
  assert.equal(source.approvalStatus, "approved");
  assert.equal(source.assetUri, first.asset.assetUri);
  await assert.rejects(() => service.generate({ projectId: "project-1", prompt: "Try rejected image", sourceAssetId: edited.asset.id }), /Rejected artwork cannot be used/);
});

test("provider failure does not fabricate or persist source/derivative assets", async (t) => {
  const { root, store, service } = await fixture(async () => { throw new Error("No real image provider is configured."); });
  t.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(() => service.generate({ projectId: "project-1", prompt: "A real provider is required", referenceImage: "data:image/png;base64,QUJDRA==" }), /No real image provider/);
  const persisted = await store.load("project-1");
  assert.equal(persisted.illustrationAssetLibrary, undefined);
});

test("Image Lab rejects unsafe references and invalid option values before provider execution", async (t) => {
  let calls = 0;
  const { root, service } = await fixture(async () => { calls += 1; throw new Error("should not run"); });
  t.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(() => service.generate({ projectId: "project-1", prompt: "x", referenceImage: "https://example.com/image.png" }), /inline PNG, JPEG, or WebP/);
  await assert.rejects(() => service.generate({ projectId: "project-1", prompt: "x", size: "999x999" }), /Invalid image size/);
  await assert.rejects(() => service.generate({ projectId: "project-1", prompt: "x", quality: "ultra" }), /Invalid image quality/);
  assert.equal(calls, 0);
});

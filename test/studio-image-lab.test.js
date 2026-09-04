const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { createProject, withProjectStudioWorkspace } = require("../.forge-build/domain/project.js");
const { createStudioWorkspace, createWorkspaceBook, addWorkspaceBook, addWorkspaceChapter, addWorkspaceScene } = require("../.forge-build/domain/studio-workspace.js");
const { FileProjectStore } = require("../.forge-build/infrastructure/file-project-store.js");
const { StudioImageLabService } = require("../.forge-build/application/studio-image-lab.js");

const PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl5ZVQAAAAASUVORK5CYII=";
const PNG_DATA_URI = `data:image/png;base64,${PNG_BASE64}`;

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
    return Object.freeze({ provider: "openai", model: "gpt-image-2", mimeType: "image/png", bytesBase64: PNG_BASE64, dataUri: PNG_DATA_URI, requestId: `req-${calls.length}`, size: request.size || "1024x1024", quality: request.quality || "medium" });
  };
}

const authorOwnedRights = Object.freeze({
  rightsBasis: "author-owned",
  authorDeclaresPublicationClearance: true,
  containsRealPerson: false,
  modelReleaseStatus: "not-applicable",
  containsTrademark: false,
  sourceReference: "Author original artwork",
  rightsUsageTerms: "Author controls this source for the intended book use.",
});

test("new Image Lab generations persist pending assets plus AI provenance and survive restart", async (t) => {
  const calls = [], { root, store, service } = await fixture(successfulGenerator(calls));
  t.after(() => rm(root, { recursive: true, force: true }));
  const result = await service.generate({ projectId: "project-1", prompt: "A moonlit forest clearing", style: "watercolor picture book", purpose: "illustration", now: "2026-09-01T18:03:00.000Z" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].context.projectId, "project-1");
  assert.match(calls[0].prompt, /moonlit forest clearing/i);
  assert.equal(result.asset.approvalStatus, "pending");
  assert.equal(result.asset.assetUri, PNG_DATA_URI);
  assert.equal(result.asset.reusedFromAssetId, undefined);
  assert.equal(result.provider, "openai");
  assert.equal(result.assetProvenance.eventType, "generation");
  assert.equal(result.assetProvenance.provenance.kind, "ai-generated");
  assert.equal(result.assetProvenance.provider, "openai");
  assert.equal(result.assetProvenance.model, "gpt-image-2");
  assert.equal(result.assetProvenance.digitalSourceType, "trained-algorithmic-media");
  assert.equal(result.assetProvenance.publicationClearance, "review-required");
  assert.equal(result.assetProvenance.aiPromptInformation, "A moonlit forest clearing");
  const persisted = await store.load("project-1");
  assert.equal(persisted.illustrationAssetLibrary.assets.length, 1);
  assert.equal(persisted.assetRightsRegistry.records.length, 1);
  const restarted = new StudioImageLabService(new FileProjectStore(root), successfulGenerator([]));
  const history = await restarted.list("project-1");
  const rights = await restarted.rights("project-1");
  assert.equal(history.length, 1);
  assert.equal(history[0].id, result.asset.id);
  assert.equal(rights[0].artifactId, result.asset.id);
});

test("reference images require explicit consent before any provider execution", async (t) => {
  const calls = [], { root, service } = await fixture(successfulGenerator(calls));
  t.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(() => service.generate({
    projectId: "project-1",
    prompt: "Edit the author image",
    referenceImage: PNG_DATA_URI,
    referenceRights: authorOwnedRights,
  }), /Explicit author consent/);
  assert.equal(calls.length, 0);
});

test("uploaded source images are preserved with rights and per-request consent before derivative generation", async (t) => {
  const calls = [], { root, store, service } = await fixture(successfulGenerator(calls));
  t.after(() => rm(root, { recursive: true, force: true }));
  const original = PNG_DATA_URI;
  const result = await service.generate({ projectId: "project-1", prompt: "Keep the character exactly the same but change the sky to dawn", style: "soft watercolor", purpose: "character-reference", referenceImage: original, referenceLabel: "Author-approved Luke design", referenceRights: authorOwnedRights, externalProcessingConsent: true, now: "2026-09-01T18:04:00.000Z" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].referenceImages.length, 1);
  assert.equal(calls[0].referenceImages[0].dataUri, original);
  assert.ok(result.sourceAsset);
  assert.equal(result.sourceAsset.assetUri, original);
  assert.equal(result.sourceAsset.approvalStatus, "approved");
  assert.equal(result.sourceDeclaration.rightsBasis, "author-owned");
  assert.equal(result.sourceDeclaration.publicationClearance, "author-declared-cleared");
  assert.equal(result.processingConsent.eventType, "external-processing-consent");
  assert.equal(result.processingConsent.provenance.consentStatus, "granted");
  assert.equal(result.processingConsent.provider, "openai");
  assert.equal(result.asset.reusedFromAssetId, result.sourceAsset.id);
  assert.equal(result.asset.approvalStatus, "pending");
  assert.equal(result.asset.references[0].uri, original);
  assert.equal(result.assetProvenance.digitalSourceType, "composite-synthetic");
  const persisted = await store.load("project-1");
  assert.equal(persisted.illustrationAssetLibrary.assets.length, 2);
  assert.equal(persisted.assetRightsRegistry.records.length, 3);
  assert.equal(persisted.illustrationAssetLibrary.assets.find((asset) => asset.id === result.sourceAsset.id).assetUri, original);
});

test("editing existing generated artwork requires fresh external-processing consent but not a fabricated rights declaration", async (t) => {
  const calls = [], { root, store, service } = await fixture(successfulGenerator(calls));
  t.after(() => rm(root, { recursive: true, force: true }));
  const first = await service.generate({ projectId: "project-1", prompt: "Forest guardian", now: "2026-09-01T18:05:00.000Z" });
  const accepted = await service.review({ projectId: "project-1", assetId: first.asset.id, decision: "approved", now: "2026-09-01T18:06:00.000Z" });
  assert.equal(accepted.asset.approvalStatus, "approved");
  await assert.rejects(() => service.generate({ projectId: "project-1", prompt: "Add snow", sourceAssetId: first.asset.id }), /Explicit author consent/);
  const edited = await service.generate({ projectId: "project-1", prompt: "Keep identity and composition; add gentle falling snow", sourceAssetId: first.asset.id, externalProcessingConsent: true, now: "2026-09-01T18:07:00.000Z" });
  assert.equal(edited.asset.reusedFromAssetId, first.asset.id);
  assert.equal(edited.asset.approvalStatus, "pending");
  const rejected = await service.review({ projectId: "project-1", assetId: edited.asset.id, decision: "rejected", now: "2026-09-01T18:08:00.000Z" });
  assert.equal(rejected.asset.approvalStatus, "rejected");
  const persisted = await store.load("project-1");
  const source = persisted.illustrationAssetLibrary.assets.find((asset) => asset.id === first.asset.id);
  assert.equal(source.approvalStatus, "approved");
  assert.equal(source.assetUri, first.asset.assetUri);
  const sourceEvents = persisted.assetRightsRegistry.records.filter((record) => record.artifactId === first.asset.id);
  assert.equal(sourceEvents.some((record) => record.eventType === "generation"), true);
  assert.equal(sourceEvents.some((record) => record.eventType === "external-processing-consent"), true);
  await assert.rejects(() => service.generate({ projectId: "project-1", prompt: "Try rejected image", sourceAssetId: edited.asset.id, externalProcessingConsent: true }), /Rejected artwork cannot be used/);
});

test("authors can separately declare publication rights without changing creative approval", async (t) => {
  const calls = [], { root, store, service } = await fixture(successfulGenerator(calls));
  t.after(() => rm(root, { recursive: true, force: true }));
  const generated = await service.generate({ projectId: "project-1", prompt: "Quiet river", now: "2026-09-01T18:09:00.000Z" });
  const declaration = await service.declareRights({ projectId: "project-1", assetId: generated.asset.id, declaration: { rightsBasis: "author-owned", authorDeclaresPublicationClearance: true, sourceReference: "Author review after generation", rightsUsageTerms: "Cleared by author for this project." }, now: "2026-09-01T18:10:00.000Z" });
  assert.equal(declaration.record.publicationClearance, "author-declared-cleared");
  const persisted = await store.load("project-1");
  assert.equal(persisted.illustrationAssetLibrary.assets[0].approvalStatus, "pending", "rights declaration must not silently approve creative artwork");
  assert.equal(persisted.assetRightsRegistry.records.length, 2);
});

test("completed image generation merges into latest project instead of overwriting concurrent author work", async (t) => {
  const calls = [];
  const { root, store } = await fixture(successfulGenerator([]));
  t.after(() => rm(root, { recursive: true, force: true }));
  const provider = successfulGenerator(calls);
  const service = new StudioImageLabService(store, async (request) => {
    const concurrent = await store.load("project-1");
    await store.save({ ...concurrent, metadata: { ...concurrent.metadata, title: "Concurrent author title edit", updatedAt: "2026-09-01T18:03:30.000Z" } });
    return provider(request);
  });
  const result = await service.generate({ projectId: "project-1", prompt: "Preserve concurrent work", now: "2026-09-01T18:04:00.000Z" });
  const persisted = await store.load("project-1");
  assert.equal(calls.length, 1);
  assert.equal(persisted.metadata.title, "Concurrent author title edit");
  assert.equal(persisted.illustrationAssetLibrary.assets.length, 1);
  assert.equal(persisted.illustrationAssetLibrary.assets[0].id, result.asset.id);
  assert.equal(persisted.assetRightsRegistry.records.length, 1);
});

test("provider failure preserves consented uploaded source and transmission audit but never fabricates derivative output", async (t) => {
  const { root, store, service } = await fixture(async () => { throw new Error("No real image provider is configured."); });
  t.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(() => service.generate({ projectId: "project-1", prompt: "A real provider is required", referenceImage: PNG_DATA_URI, referenceRights: authorOwnedRights, externalProcessingConsent: true, now: "2026-09-01T18:11:00.000Z" }), /No real image provider/);
  const persisted = await store.load("project-1");
  assert.equal(persisted.illustrationAssetLibrary.assets.length, 1, "consented uploaded original must survive provider failure");
  assert.equal(persisted.illustrationAssetLibrary.assets[0].style, "author-uploaded-source");
  assert.equal(persisted.assetRightsRegistry.records.length, 2, "source declaration and transmission consent must survive provider failure");
  assert.equal(persisted.assetRightsRegistry.records.some((record) => record.eventType === "generation"), false, "failed provider must not fabricate generation provenance");
});

test("Image Lab rejects unsafe references, contradictory rights, invalid options, and fake image bytes before provider execution", async (t) => {
  let calls = 0;
  const { root, service } = await fixture(async () => { calls += 1; throw new Error("should not run"); });
  t.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(() => service.generate({ projectId: "project-1", prompt: "x", referenceImage: "https://example.com/image.png", referenceRights: authorOwnedRights, externalProcessingConsent: true }), /inline PNG, JPEG, or WebP/);
  await assert.rejects(() => service.generate({ projectId: "project-1", prompt: "x", referenceImage: "data:image/png;base64,QUJDRA==", referenceRights: authorOwnedRights, externalProcessingConsent: true }), /not a valid PNG byte stream/);
  await assert.rejects(() => service.generate({ projectId: "project-1", prompt: "x", referenceImage: PNG_DATA_URI, referenceRights: { rightsBasis: "unknown", authorDeclaresPublicationClearance: true }, externalProcessingConsent: true }), /Unknown or external-reference rights cannot be marked publication-cleared/);
  await assert.rejects(() => service.generate({ projectId: "project-1", prompt: "x", size: "999x999" }), /Invalid image size/);
  await assert.rejects(() => service.generate({ projectId: "project-1", prompt: "x", quality: "ultra" }), /Invalid image quality/);
  assert.equal(calls, 0);
});

test("Image Lab refuses fake or mismatched provider image bytes instead of persisting them", async (t) => {
  const { root, store, service } = await fixture(async () => Object.freeze({
    provider: "openai",
    model: "gpt-image-2",
    mimeType: "image/png",
    bytesBase64: "QUJDRA==",
    dataUri: "data:image/png;base64,QUJDRA==",
    size: "1024x1024",
    quality: "medium",
  }));
  t.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(() => service.generate({ projectId: "project-1", prompt: "fake provider image" }), /not a valid PNG byte stream/);
  const persisted = await store.load("project-1");
  assert.equal(persisted.illustrationAssetLibrary?.assets.length ?? 0, 0, "invalid provider bytes must not create an illustration asset library entry");
  assert.equal(persisted.assetRightsRegistry?.records.length ?? 0, 0, "invalid provider bytes must not create generation provenance");

  const mismatchedBytes = Buffer.from(PNG_BASE64, "base64");
  mismatchedBytes[mismatchedBytes.length - 1] ^= 0x01;
  const mismatch = new StudioImageLabService(store, async () => Object.freeze({
    provider: "openai",
    model: "gpt-image-2",
    mimeType: "image/png",
    bytesBase64: PNG_BASE64,
    dataUri: `data:image/png;base64,${mismatchedBytes.toString("base64")}`,
    size: "1024x1024",
    quality: "medium",
  }));
  await assert.rejects(() => mismatch.generate({ projectId: "project-1", prompt: "mismatched provider image" }), /does not match the returned image data URI/);
  const afterMismatch = await store.load("project-1");
  assert.equal(afterMismatch.illustrationAssetLibrary?.assets.length ?? 0, 0, "mismatched provider payloads must not persist artwork");
  assert.equal(afterMismatch.assetRightsRegistry?.records.length ?? 0, 0, "mismatched provider payloads must not persist generation provenance");
});

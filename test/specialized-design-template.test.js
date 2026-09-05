"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const {
  captureSpecializedDesignTemplate,
  instantiateSpecializedDesignTemplate,
  validateSpecializedDesignTemplate,
} = require("../dist/domain/specialized-design-template");
const {
  FileSpecializedDesignTemplateStore,
} = require("../dist/infrastructure/file-specialized-design-template-store");

function sourceDocument() {
  return {
    formatVersion: 1,
    id: "source-flyer-document",
    projectId: "source-flyer-project",
    title: "Launch Night Flyer",
    mode: "flyer",
    surfaces: [{
      id: "front",
      kind: "front",
      label: "Front",
      widthInches: 8.5,
      heightInches: 11,
      bleedInches: 0.125,
      safeMarginInches: 0.25,
      readingOrder: 1,
      elements: [
        {
          id: "headline",
          kind: "text",
          role: "headline",
          box: { x: 0.75, y: 0.75, width: 7, height: 1 },
          text: "Launch Night",
          locked: false,
          zIndex: 2,
          rotationDegrees: 0,
          style: { fontFamily: "Georgia", fontSizePt: 30, fill: "#1f5d3a" },
          metadata: { semanticField: "headline" },
        },
        {
          id: "hero-art",
          kind: "image",
          role: "hero-art",
          box: { x: 0.75, y: 2, width: 7, height: 6 },
          assetId: "source-artwork-42",
          locked: false,
          zIndex: 1,
          rotationDegrees: 0,
          style: { opacity: 1 },
          metadata: { cropMode: "cover" },
        },
        {
          id: "brand-lock",
          kind: "text",
          role: "brand",
          box: { x: 0.75, y: 9.75, width: 4, height: 0.5 },
          text: "Forge House",
          locked: true,
          zIndex: 3,
          rotationDegrees: 0,
          style: { fontFamily: "Arial", fontSizePt: 11, fill: "#1f5d3a" },
          metadata: {},
        },
      ],
    }],
    styleTokens: { primary: "#1f5d3a", spacing: 0.25 },
    createdAt: "2026-09-05T17:00:00.000Z",
    updatedAt: "2026-09-05T17:00:00.000Z",
  };
}

function sourceProfile() {
  return {
    formatVersion: 1,
    id: "flyer-letter",
    label: "US Letter Flyer",
    widthInches: 8.5,
    heightInches: 11,
    bleedInches: 0.125,
    safeMarginInches: 0.25,
    dpi: 300,
    colorIntent: "sRGB",
    artifactKinds: ["pdf", "svg", "png", "jpeg"],
    duplex: false,
    notes: ["Author-approved launch layout."],
  };
}

function capture() {
  return captureSpecializedDesignTemplate({
    forgeProjectId: "forge-project",
    sourceSpecializedProjectId: "source-flyer-project",
    sourceDocument: sourceDocument(),
    sourceProfile: sourceProfile(),
    title: "Royal Launch Flyer",
    description: "Reusable semantic launch layout.",
    tags: ["Launch", "Flyer", "Launch"],
    brandKitId: "forge-house",
    now: "2026-09-05T17:10:00.000Z",
  });
}

test("capturing a design template detaches source assets without flattening semantic structure", () => {
  const source = sourceDocument();
  const snapshot = JSON.stringify(source);
  const template = captureSpecializedDesignTemplate({
    forgeProjectId: "forge-project",
    sourceSpecializedProjectId: "source-flyer-project",
    sourceDocument: source,
    sourceProfile: sourceProfile(),
    title: "Royal Launch Flyer",
    tags: ["Flyer", "Launch", "flyer"],
    brandKitId: "forge-house",
    now: "2026-09-05T17:10:00.000Z",
  });

  assert.equal(JSON.stringify(source), snapshot, "template capture must not mutate the saved source document");
  assert.equal(template.mode, "flyer");
  assert.equal(template.assetPolicy, "detached-placeholders");
  assert.deepEqual(template.tags, ["flyer", "launch"]);
  assert.equal(template.brandKitId, "forge-house");
  assert.equal(template.document.surfaces[0].elements[0].role, "headline", "semantic text roles must survive capture");
  assert.equal(template.document.surfaces[0].elements[2].locked, true, "locked brand elements must survive capture");
  const image = template.document.surfaces[0].elements[1];
  assert.equal(image.assetId, undefined, "source-specific asset reference must not become a hidden template dependency");
  assert.equal(image.metadata["forge.template.sourceAssetId"], "source-artwork-42");
  assert.equal(image.metadata["forge.template.assetSlot"], "hero-art");
  assert.equal(image.metadata["forge.template.assetRequired"], true);
  assert.doesNotThrow(() => validateSpecializedDesignTemplate(template));
});

test("template instantiation produces fresh editable identities and exact production settings", () => {
  const template = capture();
  const candidate = instantiateSpecializedDesignTemplate({
    template,
    targetSpecializedProjectId: "target-flyer-project",
    targetMode: "flyer",
    title: "Book Two Launch Flyer",
    now: "2026-09-05T17:20:00.000Z",
  });

  assert.equal(candidate.persisted, false);
  assert.equal(candidate.document.projectId, "target-flyer-project");
  assert.equal(candidate.document.title, "Book Two Launch Flyer");
  assert.notEqual(candidate.document.id, template.document.id);
  assert.notEqual(candidate.document.surfaces[0].id, template.document.surfaces[0].id);
  assert.notEqual(candidate.document.surfaces[0].elements[0].id, template.document.surfaces[0].elements[0].id);
  assert.equal(candidate.document.surfaces[0].elements[0].metadata["forge.template.sourceElementId"], "headline");
  assert.equal(candidate.document.surfaces[0].elements[2].locked, true, "brand lock must remain present in editable copy");
  assert.equal(candidate.profile.widthInches, 8.5);
  assert.equal(candidate.profile.heightInches, 11);
  assert.equal(candidate.profile.dpi, 300);
  assert.equal(candidate.detachedAssetSlots.length, 1);
  assert.equal(candidate.detachedAssetSlots[0].sourceAssetId, "source-artwork-42");
  assert.equal(candidate.detachedAssetSlots[0].slot, "hero-art");
});

test("design templates cannot silently cross incompatible Specialized modes", () => {
  assert.throws(
    () => instantiateSpecializedDesignTemplate({
      template: capture(),
      targetSpecializedProjectId: "target-card-project",
      targetMode: "greeting-card",
    }),
    /cannot be applied to target mode/i,
  );
});

test("file store durably creates lists reads and deletes validated templates", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-design-template-store-"));
  try {
    const store = new FileSpecializedDesignTemplateStore(join(root, "templates.json"));
    const template = capture();
    const saved = await store.create(template);
    assert.equal(saved.id, template.id);

    const list = await store.list("forge-project");
    assert.equal(list.length, 1);
    assert.equal(list[0].title, "Royal Launch Flyer");

    const read = await store.get("forge-project", template.id);
    assert.equal(read?.source.documentId, "source-flyer-document");
    assert.equal(read?.brandKitId, "forge-house");

    await store.delete("forge-project", template.id);
    assert.equal((await store.list("forge-project")).length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

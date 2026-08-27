const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createIllustrationReferenceImage,
  MAX_ILLUSTRATION_REFERENCE_IMAGE_BYTES,
} = require("../dist/domain/illustration-reference-image.js");

test("reference images accept supported formats and preserve metadata", () => {
  const image = createIllustrationReferenceImage({
    id: "reference-001",
    projectId: "forge-studio",
    originalFileName: "character.webp",
    mimeType: "image/webp",
    byteLength: 4096,
    assetUri: "/api/projects/forge-studio/assets/reference-001.webp",
    now: "2026-08-27T12:00:00.000Z",
  });
  assert.equal(image.mimeType, "image/webp");
  assert.equal(image.byteLength, 4096);
  assert.equal(image.originalFileName, "character.webp");
});

test("reference images reject unsupported media types", () => {
  assert.throws(() => createIllustrationReferenceImage({
    id: "reference-bad",
    projectId: "forge-studio",
    originalFileName: "reference.gif",
    mimeType: "image/gif",
    byteLength: 100,
    assetUri: "/assets/reference-bad.gif",
  }), /Unsupported reference image type/);
});

test("reference images reject files larger than the local safety limit", () => {
  assert.throws(() => createIllustrationReferenceImage({
    id: "reference-large",
    projectId: "forge-studio",
    originalFileName: "reference.png",
    mimeType: "image/png",
    byteLength: MAX_ILLUSTRATION_REFERENCE_IMAGE_BYTES + 1,
    assetUri: "/assets/reference-large.png",
  }), /5 MiB/);
});

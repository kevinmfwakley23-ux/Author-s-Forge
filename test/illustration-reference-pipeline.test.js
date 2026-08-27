const test = require("node:test");
const assert = require("node:assert/strict");
const { IllustrationReferencePipeline } = require("../dist/application/illustration-reference-pipeline.js");

test("reference pipeline creates a validated upload record", () => {
  const pipeline = new IllustrationReferencePipeline();
  const reference = pipeline.createReference({
    projectId: "forge-studio",
    originalFileName: "character.png",
    mimeType: "image/png",
    bytes: new Uint8Array([1, 2, 3]),
    assetUri: "/api/projects/forge-studio/assets/reference-character.png",
  }, "2026-08-27T12:00:00.000Z");
  assert.equal(reference.projectId, "forge-studio");
  assert.equal(reference.byteLength, 3);
  assert.equal(reference.mimeType, "image/png");
});

test("reference pipeline fails closed without an OpenAI key", async () => {
  const pipeline = new IllustrationReferencePipeline();
  const reference = pipeline.createReference({
    projectId: "forge-studio",
    originalFileName: "character.png",
    mimeType: "image/png",
    bytes: new Uint8Array([1]),
    assetUri: "/assets/reference-character.png",
  });
  await assert.rejects(() => pipeline.editWithOpenAi({
    prompt: "Preserve the character identity and change the background.",
    reference,
    referenceBytes: new Uint8Array([1]),
    size: "1024x1024",
    quality: "high",
  }, ""), /OPENAI_API_KEY/);
});

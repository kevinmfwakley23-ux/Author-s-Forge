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

test("reference pipeline sends the reference as a real multipart image edit", async () => {
  const pipeline = new IllustrationReferencePipeline();
  const reference = pipeline.createReference({
    projectId: "forge-studio",
    originalFileName: "character.png",
    mimeType: "image/png",
    bytes: new Uint8Array([137, 80, 78, 71]),
    assetUri: "/assets/reference-character.png",
  });
  const originalFetch = global.fetch;
  let capturedBody;
  let capturedHeaders;
  try {
    global.fetch = async (_url, init) => {
      capturedBody = init.body;
      capturedHeaders = init.headers;
      return new Response(JSON.stringify({ data: [{ b64_json: "generated-png-base64" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const result = await pipeline.editWithOpenAi({
      prompt: "Preserve the character identity and change the background.",
      reference,
      referenceBytes: referenceBytes = new Uint8Array([137, 80, 78, 71]),
      size: "1024x1536",
      quality: "high",
    }, "test-key");

    assert.equal(result.provider, "openai");
    assert.equal(result.model, "gpt-image-1");
    assert.equal(result.b64Json, "generated-png-base64");
    assert.ok(capturedBody instanceof FormData);
    assert.equal(capturedBody.get("model"), "gpt-image-1");
    assert.equal(capturedBody.get("prompt"), "Preserve the character identity and change the background.");
    assert.equal(capturedBody.get("size"), "1024x1536");
    assert.equal(capturedBody.get("quality"), "high");
    const image = capturedBody.get("image");
    assert.ok(image instanceof Blob);
    assert.equal(image.type, "image/png");
    assert.equal(image.size, 4);
    assert.equal(capturedHeaders.authorization, "Bearer test-key");
  } finally {
    global.fetch = originalFetch;
  }
});

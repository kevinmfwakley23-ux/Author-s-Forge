const assert = require("node:assert/strict");
const test = require("node:test");
const { createAuthorInput } = require("../.forge-build/domain/author-input.js");
const { classifyAuthorInput } = require("../.forge-build/application/input-router.js");

test("typed and dictated input share one canonical contract", () => {
  const typed = createAuthorInput({ id: "typed-1", mode: "typed", text: "A woman stood beneath the bridge.", createdAt: "2026-01-01T00:00:00.000Z" });
  const dictated = createAuthorInput({
    id: "voice-1",
    mode: "dictated",
    text: "A woman stood beneath the bridge.",
    createdAt: "2026-01-01T00:00:01.000Z",
    provenance: { provider: "browser", language: "en-US", confidence: 0.97 }
  });

  assert.equal(typed.text, dictated.text);
  assert.equal(dictated.originalText, dictated.text);
  assert.equal(dictated.provenance.provider, "browser");
  assert.equal(dictated.provenance.confidence, 0.97);
});

test("ordinary prose remains author content", () => {
  const input = createAuthorInput({ id: "content-1", mode: "dictated", text: "New chapter begins with a storm outside." });
  assert.equal(classifyAuthorInput(input).intent, "content");
});

test("known voice commands are classified without rewriting source text", () => {
  const input = createAuthorInput({ id: "command-1", mode: "dictated", text: "New chapter" });
  const result = classifyAuthorInput(input);
  assert.equal(result.intent, "new-chapter");
  assert.equal(result.input.originalText, "New chapter");
});

test("rewrite and expand commands retain their requested text", () => {
  const rewrite = classifyAuthorInput(createAuthorInput({ id: "rewrite-1", mode: "typed", text: "Rewrite this as darker prose" }));
  const expand = classifyAuthorInput(createAuthorInput({ id: "expand-1", mode: "dictated", text: "Expand this with sensory detail" }));
  assert.equal(rewrite.intent, "rewrite");
  assert.equal(rewrite.commandText, "darker prose");
  assert.equal(expand.intent, "expand");
  assert.equal(expand.commandText, "sensory detail");
});

test("slash commands are isolated from ordinary content", () => {
  const result = classifyAuthorInput(createAuthorInput({ id: "command-2", mode: "typed", text: "/save" }));
  assert.equal(result.intent, "unknown-command");
  assert.equal(result.commandText, "/save");
});

test("empty input is rejected", () => {
  assert.throws(() => createAuthorInput({ id: "empty", mode: "typed", text: "   " }), /text is required/);
});

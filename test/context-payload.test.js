const test = require("node:test");
const assert = require("node:assert/strict");
const { classifyContextPayload } = require("../dist/application/context-payload.js");

test("classifies JSON payloads", () => {
  assert.equal(classifyContextPayload('{"chapter":1,"title":"Opening"}').kind, "json");
});

test("classifies diffs before generic code", () => {
  assert.equal(classifyContextPayload("diff --git a/book.md b/book.md\n--- a/book.md\n+++ b/book.md\n@@ -1 +1 @@\n-old\n+new").kind, "diff");
});

test("classifies diagnostic logs", () => {
  assert.equal(classifyContextPayload("2026-08-28T01:00:00 ERROR request failed\n2026-08-28T01:00:01 INFO retrying\nstack trace follows").kind, "log");
});

test("classifies source code", () => {
  assert.equal(classifyContextPayload("export const draft = (title) => { return title.trim(); }").kind, "code");
});

test("keeps ordinary prose as text", () => {
  assert.equal(classifyContextPayload("Mara walked toward the reservoir as winter settled over the valley.").kind, "text");
});

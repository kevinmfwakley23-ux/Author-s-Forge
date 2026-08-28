import assert from "node:assert/strict";
import test from "node:test";
import { compressContextPayload } from "../dist/application/context-compressor.js";

test("context compressor preserves JSON syntax and only normalizes line endings", () => {
  const input = '{"canon":"keep","items":[1,2]}';
  const result = compressContextPayload("json", input);
  assert.equal(result.text, input);
  assert.equal(result.changed, false);
});

test("context compressor removes repeated log lines", () => {
  const line = "2026-08-28 INFO durable project state loaded successfully";
  const input = `${line}\n${line}\n${line}\nnext event`;
  const result = compressContextPayload("log", input);
  assert.ok(result.changed);
  assert.ok(result.text.length < input.length);
  assert.match(result.text, /next event/);
});

test("context compressor does not rewrite code or diffs", () => {
  const code = "const value = {\n  important: true,\n};";
  const diff = "diff --git a/a.ts b/a.ts\n@@ -1 +1 @@\n-old\n+new";
  assert.equal(compressContextPayload("code", code).text, code);
  assert.equal(compressContextPayload("diff", diff).text, diff);
});

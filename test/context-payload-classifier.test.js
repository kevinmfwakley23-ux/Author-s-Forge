import assert from "node:assert/strict";
import test from "node:test";
import { classifyContextPayload } from "../dist/application/context-payload-classifier.js";

test("classifies JSON payloads", () => {
  assert.deepEqual(classifyContextPayload('{"chapter":1}'), { kind: "json", confidence: "high" });
});

test("classifies source files as code", () => {
  assert.deepEqual(classifyContextPayload("const answer = 42;", "scene.ts"), { kind: "code", confidence: "high" });
});

test("classifies diffs before generic code", () => {
  assert.deepEqual(classifyContextPayload("diff --git a/a.ts b/a.ts\n@@ -1 +1 @@"), { kind: "diff", confidence: "high" });
});

test("classifies log-heavy payloads", () => {
  const log = "INFO startup\nERROR failed\nWARN retry\nINFO ready";
  assert.equal(classifyContextPayload(log).kind, "log");
});

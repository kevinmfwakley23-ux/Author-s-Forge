import assert from "node:assert/strict";
import test from "node:test";
import { createProductionContextEngineRegistry, CONTEXT_ENGINE_CAPABILITIES } from "./context-engine-stack";

test("production context engine stack is lossless-first", () => {
  const registry = createProductionContextEngineRegistry();
  const result = registry.optimize({
    kind: "json",
    text: '{\n  "title": "Forge",\n  "items": [1, 2, 3]\n}',
  });
  assert.equal(JSON.parse(result.text).title, "Forge");
  assert.equal(result.changed, true);
  assert.ok(result.optimizedLength < result.originalLength);
});

test("production capability catalog keeps risky engines out of the default path", () => {
  const registry = createProductionContextEngineRegistry();
  const ids = new Set(registry.list().map((engine) => engine.id));
  assert.ok(ids.has("deterministic-lossless-first"));
  assert.ok(ids.has("structured-data-compaction"));
  assert.ok(!ids.has("llmlingua-2-onnx"));
  assert.ok(CONTEXT_ENGINE_CAPABILITIES.some((capability) => capability.id === "llmlingua-2-onnx" && !capability.production));
});

test("invalid structured data is preserved rather than rewritten", () => {
  const registry = createProductionContextEngineRegistry();
  const text = '{invalid-json';
  const result = registry.optimize({ kind: "json", text });
  assert.equal(result.text, text);
});

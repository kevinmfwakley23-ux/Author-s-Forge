import test from "node:test";
import assert from "node:assert/strict";
import { createProductionContextEngineRegistry, CONTEXT_ENGINE_CAPABILITIES } from "../dist/application/context-engine-stack.js";

test("production context stack includes deterministic and lossless structured engines", () => {
  const registry = createProductionContextEngineRegistry();
  assert.deepEqual(registry.list().map((engine) => engine.id), ["deterministic-lossless-first", "structured-data-compaction"]);
});

test("structured data compaction preserves parsed JSON semantics", () => {
  const registry = createProductionContextEngineRegistry();
  const source = '{\n  "title": "Forge",\n  "items": [1, 2, 3],\n  "nested": { "enabled": true }\n}';
  const result = registry.optimize({ text: source, kind: "json", sourceName: "state.json" });
  assert.equal(JSON.stringify(JSON.parse(result.text)), JSON.stringify(JSON.parse(source)));
  assert.ok(result.changed);
  assert.ok(result.strategy.includes("structured-data-compaction"));
});

test("capability catalog keeps risky engines outside the production path", () => {
  const risky = CONTEXT_ENGINE_CAPABILITIES.filter((item) => item.safety === "optional-model" || item.safety === "experimental");
  assert.ok(risky.length >= 3);
  assert.ok(risky.every((item) => item.production === false));
});

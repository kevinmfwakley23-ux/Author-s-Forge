import assert from "node:assert/strict";
import test from "node:test";
import { createProductionContextEngineRegistry, CONTEXT_ENGINE_CAPABILITIES } from "../src/application/context-engine-stack";

test("production context registry prioritizes deterministic lossless engines", () => {
  const registry = createProductionContextEngineRegistry();
  const engines = registry.list();
  assert.equal(engines[0]?.id, "deterministic-lossless-first");
  assert.equal(engines[1]?.id, "structured-data-compaction");
});

test("structured data compaction preserves parsed JSON value", () => {
  const registry = createProductionContextEngineRegistry();
  const input = JSON.stringify({ title: "Book", tags: ["canon", "draft"], nested: { enabled: true } }, null, 2);
  const result = registry.optimize({ kind: "json", text: input });
  assert.deepEqual(JSON.parse(result.text), JSON.parse(input));
  assert.equal(result.changed, true);
  assert.ok(result.optimizedLength < result.originalLength);
});

test("all documented optimization capabilities have an explicit safety tier", () => {
  assert.equal(CONTEXT_ENGINE_CAPABILITIES.length, 12);
  for (const capability of CONTEXT_ENGINE_CAPABILITIES) {
    assert.ok(capability.id.length > 0);
    assert.ok(capability.description.length > 0);
    assert.ok(["lossless", "derived", "optional-model", "experimental"].includes(capability.safety));
  }
});

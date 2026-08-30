import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultContextEngineRegistry } from "../src/application/context-engines";
import { ContextEngineRegistry, type ContextCompressionEngine } from "../src/application/context-engine-registry";

test("default registry exposes deterministic compression as a registered engine", () => {
  const registry = createDefaultContextEngineRegistry();
  assert.deepEqual(registry.list().map((engine) => engine.id), ["deterministic-lossless-first"]);
});

test("registry applies enabled engines in priority order", () => {
  const calls: string[] = [];
  const first: ContextCompressionEngine = {
    id: "first",
    priority: 20,
    enabled: true,
    supportedKinds: ["text"],
    supports: () => true,
    apply: ({ text }) => {
      calls.push("first");
      return { text: `${text}-1`, changed: true, strategy: ["first-step"] };
    },
  };
  const second: ContextCompressionEngine = {
    id: "second",
    priority: 10,
    enabled: true,
    supportedKinds: ["text"],
    supports: () => true,
    apply: ({ text }) => {
      calls.push("second");
      return { text: `${text}-2`, changed: true, strategy: ["second-step"] };
    },
  };

  const result = new ContextEngineRegistry([second, first]).optimize({ text: "seed", kind: "text" });
  assert.equal(result.text, "seed-1-2");
  assert.deepEqual(calls, ["first", "second"]);
  assert.deepEqual(result.strategy, ["first", "first-step", "second", "second-step"]);
});

test("disabled engines and no-op engines do not mutate context", () => {
  const disabled: ContextCompressionEngine = {
    id: "disabled",
    priority: 30,
    enabled: false,
    supportedKinds: ["text"],
    supports: () => true,
    apply: () => ({ text: "bad", changed: true, strategy: ["must-not-run"] }),
  };
  const noop: ContextCompressionEngine = {
    id: "noop",
    priority: 20,
    enabled: true,
    supportedKinds: ["text"],
    supports: () => true,
    apply: ({ text }) => ({ text, changed: false, strategy: ["noop"] }),
  };

  const result = new ContextEngineRegistry([disabled, noop]).optimize({ text: "source", kind: "text" });
  assert.equal(result.text, "source");
  assert.equal(result.changed, false);
  assert.deepEqual(result.strategy, []);
});

test("duplicate engine identifiers are rejected", () => {
  const engine: ContextCompressionEngine = {
    id: "duplicate",
    priority: 1,
    enabled: true,
    supportedKinds: ["text"],
    supports: () => true,
    apply: ({ text }) => ({ text, changed: false, strategy: [] }),
  };
  const registry = new ContextEngineRegistry([engine]);
  assert.throws(() => registry.register(engine), /already registered/);
});

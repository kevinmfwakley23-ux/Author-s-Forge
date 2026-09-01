const assert = require("node:assert/strict");
const test = require("node:test");
const { createProjectPackage } = require("../.forge-build/domain/project-package.js");
const { ProjectPackageService } = require("../.forge-build/application/project-package.js");

function state(extra = {}) {
  return { metadata: { id: "p1", title: "JSON fidelity" }, memories: [], ...extra };
}

function create(projectState) {
  return createProjectPackage({ projectId: "p1", projectState, exportedAt: "2026-09-01T00:00:00.000Z" });
}

test("project package rejects state values JSON would silently coerce or discard", () => {
  assert.throws(() => create(state({ bad: undefined })), /unsupported JSON value type "undefined"/i);
  assert.throws(() => create(state({ bad: () => "lost" })), /unsupported JSON value type "function"/i);
  assert.throws(() => create(state({ bad: Symbol("lost") })), /unsupported JSON value type "symbol"/i);
  assert.throws(() => create(state({ bad: 1n })), /unsupported JSON value type "bigint"/i);
  assert.throws(() => create(state({ bad: Number.NaN })), /non-finite number/i);
  assert.throws(() => create(state({ bad: Number.POSITIVE_INFINITY })), /non-finite number/i);
});

test("project package rejects class instances, accessors, non-enumerable state and symbol keys", () => {
  assert.throws(() => create(state({ bad: new Date("2026-09-01T00:00:00.000Z") })), /plain JSON objects/i);

  const accessor = state();
  Object.defineProperty(accessor, "computed", { enumerable: true, get() { return "not durable"; } });
  assert.throws(() => create(accessor), /accessor property/i);

  const hidden = state();
  Object.defineProperty(hidden, "hidden", { enumerable: false, value: "discarded" });
  assert.throws(() => create(hidden), /non-enumerable/i);

  const symbolKey = state();
  symbolKey[Symbol("hidden")] = "discarded";
  assert.throws(() => create(symbolKey), /symbol-keyed property/i);
});

test("project package rejects cycles, sparse arrays and array side-properties", () => {
  const cyclic = state();
  cyclic.self = cyclic;
  assert.throws(() => create(cyclic), /cyclic reference/i);

  const sparse = state({ values: ["first", , "third"] });
  assert.throws(() => create(sparse), /sparse at index 1/i);

  const values = ["first"];
  values.note = "JSON ignores this";
  assert.throws(() => create(state({ values })), /extra array property/i);
});

test("ProjectPackageService rejects non-JSON state before snapshot stringification", () => {
  const service = new ProjectPackageService();
  assert.throws(
    () => service.exportSnapshot({ projectId: "p1", projectState: state({ revision: 7n }), exportedAt: "2026-09-01T00:00:00.000Z" }),
    /unsupported JSON value type "bigint"/i,
  );
});

test("valid nested JSON state remains stable across package export and restore", () => {
  const service = new ProjectPackageService();
  const projectState = state({
    nested: {
      enabled: true,
      count: 3,
      optional: null,
      tags: ["canon", "portable"],
      unicode: "Heartwood — café 🌳",
    },
  });
  const pkg = service.exportSnapshot({ projectId: "p1", projectState, exportedAt: "2026-09-01T00:00:00.000Z" });
  assert.deepEqual(service.restoreSnapshot(pkg, "p1"), projectState);
});

const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const test = require("node:test");
const {
  PROJECT_PACKAGE_FORMAT_VERSION,
  PROJECT_PACKAGE_NAME,
  createProjectPackage,
  validateProjectPackage,
  serializeProjectPackage,
  deserializeProjectPackage,
} = require("../.forge-build/domain/project-package.js");

function digest(content) {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function state() {
  return { metadata: { id: "p1", title: "Portable project" }, memories: [] };
}

function stateFile(projectState = state(), overrides = {}) {
  const content = JSON.stringify(projectState, null, 2);
  return {
    path: "project-state.json",
    content,
    encoding: "utf8",
    mediaType: "application/json",
    sha256: digest(content),
    ...overrides,
  };
}

test("project package boundary rejects malformed runtime containers deliberately", () => {
  assert.throws(() => createProjectPackage(null), /input must be an object/i);
  assert.throws(() => createProjectPackage({ projectId: "p1", projectState: state(), files: {} }), /files must be an array/i);
  assert.throws(() => validateProjectPackage(null), /must be an object/i);
  assert.throws(() => validateProjectPackage({ manifest: null }), /manifest must be an object/i);
  assert.throws(() => deserializeProjectPackage("   "), /non-empty string/i);
});

test("import rejects duplicate package paths even when manifest duplicates match files", () => {
  const projectState = state();
  const valid = createProjectPackage({ projectId: "p1", projectState, files: [stateFile(projectState)], exportedAt: "2026-09-01T00:00:00.000Z" });
  const duplicate = {
    ...valid,
    manifest: { ...valid.manifest, paths: ["project-state.json", "project-state.json"] },
    files: [valid.files[0], { ...valid.files[0] }],
  };
  assert.throws(() => validateProjectPackage(duplicate), /duplicate package path/i);
});

test("project-state.json must be UTF-8 JSON and cryptographically bound to projectState", () => {
  const projectState = state();
  const content = JSON.stringify(projectState, null, 2);
  const base64 = Buffer.from(content, "utf8").toString("base64");
  const base64Package = {
    manifest: { formatVersion: PROJECT_PACKAGE_FORMAT_VERSION, packageName: PROJECT_PACKAGE_NAME, projectId: "p1", exportedAt: "2026-09-01T00:00:00.000Z", paths: ["project-state.json"] },
    projectState,
    files: [{ path: "project-state.json", content: base64, encoding: "base64", mediaType: "application/json", sha256: digest(content) }],
  };
  assert.throws(() => validateProjectPackage(base64Package), /must use UTF-8 encoding/i);

  const wrongType = {
    ...base64Package,
    files: [stateFile(projectState, { mediaType: "text/plain" })],
  };
  assert.throws(() => validateProjectPackage(wrongType), /application\/json/i);

  const drifted = {
    ...base64Package,
    files: [stateFile({ ...projectState, memories: [{ id: "not-the-envelope-state" }] })],
  };
  assert.throws(() => validateProjectPackage(drifted), /does not match projectState/i);
});

test("package paths reject platform-dependent backslashes and non-normalized segments", () => {
  const content = "safe";
  const unsafe = { path: "assets\\cover.txt", content, encoding: "utf8", mediaType: "text/plain", sha256: digest(content) };
  assert.throws(() => createProjectPackage({ projectId: "p1", projectState: state(), files: [unsafe] }), /relative, normalized, and traversal-safe/i);

  const dotSegment = { ...unsafe, path: "assets/./cover.txt" };
  assert.throws(() => createProjectPackage({ projectId: "p1", projectState: state(), files: [dotSegment] }), /relative, normalized, and traversal-safe/i);
});

test("valid package round-trip remains deterministic after runtime hardening", () => {
  const projectState = state();
  const content = "cover notes";
  const pkg = createProjectPackage({
    projectId: "p1",
    projectState,
    exportedAt: "2026-09-01T00:00:00.000Z",
    files: [
      stateFile(projectState),
      { path: "assets/cover-notes.txt", content, encoding: "utf8", mediaType: "text/plain", sha256: digest(content) },
    ],
  });
  const serialized = serializeProjectPackage(pkg);
  assert.deepEqual(deserializeProjectPackage(serialized), pkg);
});

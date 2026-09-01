const assert = require("node:assert/strict");
const test = require("node:test");
const { createProject, withProjectStudioWorkspace } = require("../.forge-build/domain/project.js");
const { createStudioWorkspace, addWorkspaceBook, createWorkspaceBook } = require("../.forge-build/domain/studio-workspace.js");
const { ProjectPackageService } = require("../.forge-build/application/project-package.js");

function project(id = "p1") {
  return createProject({ id, title: `Project ${id}`, now: "2026-09-01T00:00:00.000Z" });
}

function workspace(bookId) {
  const empty = createStudioWorkspace();
  if (!bookId) return empty;
  return addWorkspaceBook(empty, createWorkspaceBook({ id: bookId, title: `Book ${bookId}`, kind: "novel", description: "Envelope test" }));
}

test("Studio snapshot export makes nested project/workspace identity explicit and restorable", () => {
  const service = new ProjectPackageService();
  const activeWorkspace = workspace("book-1");
  const pkg = service.exportStudioSnapshot({
    projectId: "p1",
    project: project("p1"),
    studioWorkspace: activeWorkspace,
    exportedAt: "2026-09-01T01:00:00.000Z",
  });

  assert.equal(pkg.projectState.project.metadata.id, "p1");
  assert.deepEqual(pkg.projectState.project.studioWorkspace, activeWorkspace);
  assert.deepEqual(pkg.projectState.studioWorkspace, activeWorkspace);

  const restored = service.restoreStudioSnapshot(pkg, "p1");
  assert.equal(restored.metadata.id, "p1");
  assert.deepEqual(restored.studioWorkspace, activeWorkspace);
});

test("Studio snapshot restore rejects a nested project identity that disagrees with the manifest", () => {
  const service = new ProjectPackageService();
  const activeWorkspace = workspace("book-1");
  const pkg = service.exportSnapshot({
    projectId: "p1",
    projectState: { project: project("p2"), studioWorkspace: activeWorkspace },
    exportedAt: "2026-09-01T01:00:00.000Z",
  });

  assert.throws(() => service.restoreStudioSnapshot(pkg, "p1"), /nested project id does not match/i);
});

test("Studio snapshot restore rejects drift between top-level and nested workspace state", () => {
  const service = new ProjectPackageService();
  const nestedWorkspace = workspace("nested-book");
  const topWorkspace = workspace("top-book");
  const nestedProject = withProjectStudioWorkspace(project("p1"), nestedWorkspace, "2026-09-01T00:30:00.000Z");
  const pkg = service.exportSnapshot({
    projectId: "p1",
    projectState: { project: nestedProject, studioWorkspace: topWorkspace },
    exportedAt: "2026-09-01T01:00:00.000Z",
  });

  assert.throws(() => service.restoreStudioSnapshot(pkg, "p1"), /workspace does not match/i);
});

test("Studio snapshot export refuses pre-existing project/workspace drift instead of silently choosing a source", () => {
  const service = new ProjectPackageService();
  const nestedProject = withProjectStudioWorkspace(project("p1"), workspace("nested-book"), "2026-09-01T00:30:00.000Z");

  assert.throws(
    () => service.exportStudioSnapshot({ projectId: "p1", project: nestedProject, studioWorkspace: workspace("top-book") }),
    /workspace does not match/i,
  );
});

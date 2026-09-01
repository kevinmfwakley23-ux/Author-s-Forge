const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { createProject, withProjectStudioWorkspace } = require("../.forge-build/domain/project.js");
const { createStudioWorkspace, createWorkspaceBook, addWorkspaceBook, addWorkspaceChapter, addWorkspaceScene, saveSceneContent, getBook } = require("../.forge-build/domain/studio-workspace.js");
const { FileProjectStore } = require("../.forge-build/infrastructure/file-project-store.js");
const { StudioBookVersioningService } = require("../.forge-build/application/studio-book-versioning.js");

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "forge-book-versions-"));
  const store = new FileProjectStore(root);
  let workspace = createStudioWorkspace();
  workspace = addWorkspaceBook(workspace, createWorkspaceBook({ id: "book-1", title: "Versioned Book", kind: "novel", now: "2026-09-01T10:00:00.000Z" }));
  workspace = addWorkspaceChapter(workspace, "book-1", { id: "chapter-1", number: 1, title: "Opening", now: "2026-09-01T10:01:00.000Z" });
  workspace = addWorkspaceScene(workspace, "book-1", "chapter-1", { id: "scene-1", number: 1, title: "Arrival", now: "2026-09-01T10:02:00.000Z" });
  workspace = saveSceneContent(workspace, "book-1", "chapter-1", "scene-1", "Draft one text.", "2026-09-01T10:03:00.000Z");
  const project = withProjectStudioWorkspace(createProject({ id: "project-1", title: "Versioning Acceptance", now: "2026-09-01T10:00:00.000Z" }), workspace, "2026-09-01T10:03:00.000Z");
  await store.create(project);
  return { root, store, service: new StudioBookVersioningService(store) };
}

async function mutateScene(store, content, now) {
  const project = await store.load("project-1");
  let workspace = project.studioWorkspace;
  workspace = saveSceneContent(workspace, "book-1", "chapter-1", "scene-1", content, now);
  await store.save(withProjectStudioWorkspace(project, workspace, now));
}

test("capture and compare preserve durable structured versions across a fresh service instance", async (t) => {
  const { root, store, service } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const draft1 = await service.capture("project-1", "book-1", { id: "v1", label: "draft-1", name: "Draft 1", now: "2026-09-01T11:00:00.000Z" });
  await mutateScene(store, "Draft two changed text.", "2026-09-01T11:01:00.000Z");
  const draft2 = await service.capture("project-1", "book-1", { id: "v2", label: "draft-2", name: "Draft 2", now: "2026-09-01T11:02:00.000Z" });
  const restarted = new StudioBookVersioningService(new FileProjectStore(root));
  const history = await restarted.list("project-1", "book-1");
  assert.deepEqual(history.versions.map((version) => version.id), ["v1", "v2"]);
  assert.equal(history.versions[0].workspaceBook.chapters[0].scenes[0].content, "Draft one text.");
  assert.equal(history.versions[1].workspaceBook.chapters[0].scenes[0].content, "Draft two changed text.");
  const comparison = await restarted.compare("project-1", "book-1", draft1.id, draft2.id);
  assert.equal(comparison.identical, false);
  assert.deepEqual(comparison.changes.map((change) => change.chapterId), ["chapter-1"]);
});

test("restore requires approval, creates a rollback checkpoint and persists author attribution", async (t) => {
  const { root, store, service } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  await service.capture("project-1", "book-1", { id: "v1", label: "draft-1", name: "Draft 1", now: "2026-09-01T11:00:00.000Z" });
  await mutateScene(store, "Later working text that must remain recoverable.", "2026-09-01T11:03:00.000Z");
  await assert.rejects(() => service.restore("project-1", "book-1", "v1", { authorApproved: false, reason: "No approval" }), /explicit author approval/i);
  let persisted = await store.load("project-1");
  assert.equal(getBook(persisted.studioWorkspace, "book-1").chapters[0].scenes[0].content, "Later working text that must remain recoverable.");

  const restored = await service.restore("project-1", "book-1", "v1", { authorApproved: true, reason: "Return to the approved first draft.", rollbackVersionId: "rollback-1", decisionId: "decision-restore-1", now: "2026-09-01T11:04:00.000Z" });
  assert.equal(restored.rollbackVersion.id, "rollback-1");
  persisted = await store.load("project-1");
  assert.equal(getBook(persisted.studioWorkspace, "book-1").chapters[0].scenes[0].content, "Draft one text.");
  assert.equal(persisted.bookVersionHistories[0].versions.at(-1).id, "rollback-1");
  assert.equal(persisted.bookVersionHistories[0].versions.at(-1).workspaceBook.chapters[0].scenes[0].content, "Later working text that must remain recoverable.");
  assert.equal(persisted.authorDecisions.at(-1).id, "decision-restore-1");
  assert.equal(persisted.authorDecisions.at(-1).status, "author-approved");
  assert.match(persisted.authorDecisions.at(-1).content, /rollback-1/);

  await service.restore("project-1", "book-1", "rollback-1", { authorApproved: true, reason: "Undo the prior restore.", rollbackVersionId: "rollback-2", now: "2026-09-01T11:05:00.000Z" });
  persisted = await store.load("project-1");
  assert.equal(getBook(persisted.studioWorkspace, "book-1").chapters[0].scenes[0].content, "Later working text that must remain recoverable.");
});

test("branch and three-way merge remain durable and conflict-aware", async (t) => {
  const { root, store, service } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  await service.capture("project-1", "book-1", { id: "base", label: "draft-1", name: "Base", now: "2026-09-01T12:00:00.000Z" });
  const branch = await service.createBranch("project-1", "book-1", { id: "branch-1", name: "Alternate opening", baseVersionId: "base", now: "2026-09-01T12:01:00.000Z" });
  assert.equal(branch.headVersionId, "base");

  await mutateScene(store, "Target version text.", "2026-09-01T12:02:00.000Z");
  await service.capture("project-1", "book-1", { id: "target", label: "custom", name: "Target", now: "2026-09-01T12:03:00.000Z" });
  await service.restore("project-1", "book-1", "base", { authorApproved: true, reason: "Build source branch from base.", rollbackVersionId: "target-working-checkpoint", now: "2026-09-01T12:04:00.000Z" });
  const project = await store.load("project-1");
  let workspace = project.studioWorkspace;
  const book = getBook(workspace, "book-1");
  const changed = JSON.parse(JSON.stringify(book));
  changed.description = "Source branch changed only the book description.";
  workspace = { ...workspace, books: workspace.books.map((item) => item.id === "book-1" ? changed : item) };
  await store.save(withProjectStudioWorkspace(project, workspace, "2026-09-01T12:05:00.000Z"));
  await service.capture("project-1", "book-1", { id: "source", label: "custom", name: "Source", now: "2026-09-01T12:06:00.000Z" });

  const merged = await service.merge("project-1", "book-1", { targetVersionId: "target", sourceVersionId: "source", baseVersionId: "base", mergedVersionId: "merged", name: "Merged alternate", now: "2026-09-01T12:07:00.000Z" });
  assert.equal(merged.id, "merged");
  assert.equal(merged.workspaceBook.chapters[0].scenes[0].content, "Target version text.");
  assert.equal(merged.workspaceBook.description, "Source branch changed only the book description.");
  const persisted = await store.load("project-1");
  assert.ok(persisted.bookVersionHistories[0].versions.some((version) => version.id === "merged"));
});

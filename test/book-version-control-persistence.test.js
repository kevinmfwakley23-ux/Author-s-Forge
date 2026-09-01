const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { FileProjectStore } = require("../.forge-build/infrastructure/file-project-store.js");
const { createProject, withProjectStudioWorkspace, withProjectBookVersionHistories } = require("../.forge-build/domain/project.js");
const {
  createStudioWorkspace,
  createWorkspaceBook,
  addWorkspaceBook,
  addWorkspaceChapter,
  addWorkspaceScene,
  saveSceneContent,
  getBook,
} = require("../.forge-build/domain/studio-workspace.js");
const { createWorkspaceBookSnapshot, extractWorkspaceBook } = require("../.forge-build/domain/book-version-control.js");

function fixture() {
  let workspace = createStudioWorkspace();
  workspace = addWorkspaceBook(workspace, createWorkspaceBook({ id: "book-persist", title: "Persisted Versions", kind: "novel", now: "2026-09-01T12:00:00.000Z" }));
  workspace = addWorkspaceChapter(workspace, "book-persist", { id: "chapter-persist", number: 1, title: "Chapter One", synopsis: "Persistence proof", now: "2026-09-01T12:01:00.000Z" });
  workspace = addWorkspaceScene(workspace, "book-persist", "chapter-persist", { id: "scene-persist", number: 1, title: "Scene One", synopsis: "Durable structure", now: "2026-09-01T12:02:00.000Z" });
  workspace = saveSceneContent(workspace, "book-persist", "chapter-persist", "scene-persist", "This scene must survive a full project-store round trip.", "2026-09-01T12:03:00.000Z");
  return workspace;
}

test("FileProjectStore validates and round-trips structured book versions without losing workspace state", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-version-persistence-"));
  try {
    const store = new FileProjectStore(root);
    const workspace = fixture();
    const snapshot = createWorkspaceBookSnapshot({
      id: "version-persist",
      projectId: "project-persist",
      book: getBook(workspace, "book-persist"),
      label: "draft-1",
      name: "Draft 1",
      createdAt: "2026-09-01T12:04:00.000Z",
    });
    let project = createProject({ id: "project-persist", title: "Persisted Version Project", now: "2026-09-01T12:00:00.000Z" });
    project = withProjectStudioWorkspace(project, workspace, "2026-09-01T12:05:00.000Z");
    project = withProjectBookVersionHistories(project, [{ projectId: project.metadata.id, bookId: "book-persist", versions: [snapshot], branches: [] }], "2026-09-01T12:06:00.000Z");

    await store.create(project);
    const reloaded = await store.load(project.metadata.id);
    assert.ok(reloaded);
    assert.equal(reloaded.bookVersionHistories.length, 1);
    assert.equal(reloaded.bookVersionHistories[0].versions.length, 1);
    assert.deepEqual(extractWorkspaceBook(reloaded.bookVersionHistories[0].versions[0]), getBook(workspace, "book-persist"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("FileProjectStore rejects corrupt structured version state instead of persisting a lossy mismatch", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-version-corrupt-"));
  try {
    const store = new FileProjectStore(root);
    const workspace = fixture();
    const snapshot = createWorkspaceBookSnapshot({
      id: "version-corrupt",
      projectId: "project-corrupt",
      book: getBook(workspace, "book-persist"),
      label: "draft-1",
      name: "Draft 1",
      createdAt: "2026-09-01T12:07:00.000Z",
    });
    const corrupt = JSON.parse(JSON.stringify(snapshot));
    corrupt.workspaceBook.id = "wrong-book";
    const project = {
      ...createProject({ id: "project-corrupt", title: "Corrupt Version Project", now: "2026-09-01T12:00:00.000Z" }),
      studioWorkspace: workspace,
      bookVersionHistories: [{ projectId: "project-corrupt", bookId: "book-persist", versions: [corrupt], branches: [] }],
    };

    await assert.rejects(() => store.create(project), /structured book id does not match snapshot book id/i);
    assert.equal(await store.exists("project-corrupt"), false, "invalid version history must not leave a durable project file");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

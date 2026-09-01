const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createBookSnapshot,
  createWorkspaceBookSnapshot,
  extractWorkspaceBook,
  compareBookVersions,
  mergeVersions,
} = require("../.forge-build/domain/book-version-control.js");
const {
  createStudioWorkspace,
  createWorkspaceBook,
  addWorkspaceBook,
  addWorkspaceChapter,
  addWorkspaceScene,
  saveSceneContent,
  getBook,
} = require("../.forge-build/domain/studio-workspace.js");

function structuredBook() {
  let workspace = createStudioWorkspace();
  workspace = addWorkspaceBook(workspace, createWorkspaceBook({
    id: "book-1",
    title: "Lossless Versioning",
    kind: "novel",
    description: "A structured manuscript used to prove version fidelity.",
    now: "2026-09-01T09:00:00.000Z",
  }));
  workspace = addWorkspaceChapter(workspace, "book-1", {
    id: "chapter-1", number: 1, title: "Opening", synopsis: "Open the story.", now: "2026-09-01T09:01:00.000Z",
  });
  workspace = addWorkspaceScene(workspace, "book-1", "chapter-1", {
    id: "scene-1", number: 1, title: "Arrival", synopsis: "The protagonist arrives.", now: "2026-09-01T09:02:00.000Z",
  });
  workspace = saveSceneContent(workspace, "book-1", "chapter-1", "scene-1", "Marcus arrived before dawn.", "2026-09-01T09:03:00.000Z");
  workspace = addWorkspaceChapter(workspace, "book-1", {
    id: "chapter-2", number: 2, title: "Discovery", synopsis: "Reveal the first clue.", now: "2026-09-01T09:04:00.000Z",
  });
  workspace = addWorkspaceScene(workspace, "book-1", "chapter-2", {
    id: "scene-2", number: 1, title: "Archive", synopsis: "The clue is found.", now: "2026-09-01T09:05:00.000Z",
  });
  workspace = saveSceneContent(workspace, "book-1", "chapter-2", "scene-2", "He found the photograph in the archive.", "2026-09-01T09:06:00.000Z");
  return getBook(workspace, "book-1");
}

function snapshot(book, id, name, label = "custom", parentId) {
  return createWorkspaceBookSnapshot({
    id,
    projectId: "project-1",
    book,
    label,
    name,
    createdAt: `2026-09-01T10:${id.slice(-2).padStart(2, "0")}:00.000Z`,
    ...(parentId ? { parentId } : {}),
  });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test("structured snapshots preserve the complete WorkspaceBook and derive legacy text fields", () => {
  const book = structuredBook();
  const version = createWorkspaceBookSnapshot({
    id: "version-01",
    projectId: "project-1",
    book,
    label: "draft-1",
    name: "Draft 1",
    createdAt: "2026-09-01T10:01:00.000Z",
  });

  assert.deepEqual(extractWorkspaceBook(version), book);
  assert.equal(version.bookId, "book-1");
  assert.equal(version.chapters["chapter-1"], "Marcus arrived before dawn.");
  assert.equal(version.chapters["chapter-2"], "He found the photograph in the archive.");
  assert.equal(version.manuscript, "Marcus arrived before dawn.\n\nHe found the photograph in the archive.");

  const detached = extractWorkspaceBook(version);
  detached.chapters[0].scenes[0].content = "mutated outside snapshot";
  assert.equal(version.workspaceBook.chapters[0].scenes[0].content, "Marcus arrived before dawn.", "snapshot must remain immutable by copy semantics");
});

test("legacy text-only snapshots remain comparable but are refused for lossless structured restore", () => {
  const legacy = createBookSnapshot({
    id: "legacy-01",
    projectId: "project-1",
    bookId: "book-1",
    label: "draft-1",
    name: "Legacy Draft",
    createdAt: "2026-09-01T10:02:00.000Z",
    manuscript: "Legacy manuscript.",
    chapters: { "chapter-1": "Legacy manuscript." },
  });
  const changed = createBookSnapshot({ ...legacy, id: "legacy-02", name: "Legacy Draft 2", chapters: { "chapter-1": "Changed legacy manuscript." } });

  assert.equal(compareBookVersions(legacy, changed).changedChapterCount, 1);
  assert.throws(() => extractWorkspaceBook(legacy), /legacy text-only snapshot.*cannot be losslessly restored/i);
});

test("structured comparison detects scene metadata changes even when prose text is unchanged", () => {
  const baseBook = structuredBook();
  const changedBook = clone(baseBook);
  changedBook.chapters[0].scenes[0].title = "Arrival at Dawn";
  changedBook.chapters[0].updatedAt = "2026-09-01T11:00:00.000Z";
  changedBook.chapters[0].scenes[0].updatedAt = "2026-09-01T11:00:00.000Z";

  const before = snapshot(baseBook, "version-03", "Before metadata edit");
  const after = snapshot(changedBook, "version-04", "After metadata edit", "custom", before.id);
  const comparison = compareBookVersions(before, after);

  assert.equal(before.chapters["chapter-1"], after.chapters["chapter-1"], "legacy prose projection intentionally stays identical");
  assert.equal(comparison.identical, false);
  assert.equal(comparison.changedChapterCount, 1);
  assert.deepEqual(comparison.changes.map((change) => change.chapterId), ["chapter-1"]);
});

test("structured three-way merge combines non-overlapping chapter changes without mutating sources", () => {
  const baseBook = structuredBook();
  const targetBook = clone(baseBook);
  const sourceBook = clone(baseBook);
  targetBook.chapters[0].scenes[0].content = "Marcus arrived before sunrise and locked the door behind him.";
  targetBook.chapters[0].scenes[0].wordCount = 10;
  targetBook.chapters[0].scenes[0].updatedAt = "2026-09-01T11:01:00.000Z";
  targetBook.chapters[0].updatedAt = "2026-09-01T11:01:00.000Z";
  sourceBook.chapters[1].scenes[0].content = "He found two photographs in the archive.";
  sourceBook.chapters[1].scenes[0].wordCount = 7;
  sourceBook.chapters[1].scenes[0].updatedAt = "2026-09-01T11:02:00.000Z";
  sourceBook.chapters[1].updatedAt = "2026-09-01T11:02:00.000Z";

  const base = snapshot(baseBook, "version-05", "Base");
  const target = snapshot(targetBook, "version-06", "Target", "custom", base.id);
  const source = snapshot(sourceBook, "version-07", "Source", "custom", base.id);
  const targetBefore = clone(target);
  const sourceBefore = clone(source);

  const merged = mergeVersions(target, source, base);
  const mergedBook = extractWorkspaceBook(merged);

  assert.equal(merged.parentId, target.id);
  assert.equal(merged.label, "custom");
  assert.equal(mergedBook.chapters[0].scenes[0].content, targetBook.chapters[0].scenes[0].content);
  assert.equal(mergedBook.chapters[1].scenes[0].content, sourceBook.chapters[1].scenes[0].content);
  assert.deepEqual(target, targetBefore, "merge must not mutate target snapshot");
  assert.deepEqual(source, sourceBefore, "merge must not mutate source snapshot");
});

test("structured merge surfaces conflicting edits and refuses mixed legacy/structured histories", () => {
  const baseBook = structuredBook();
  const targetBook = clone(baseBook);
  const sourceBook = clone(baseBook);
  targetBook.chapters[0].title = "Opening — Target";
  targetBook.chapters[0].updatedAt = "2026-09-01T11:03:00.000Z";
  sourceBook.chapters[0].title = "Opening — Source";
  sourceBook.chapters[0].updatedAt = "2026-09-01T11:04:00.000Z";

  const base = snapshot(baseBook, "version-08", "Base");
  const target = snapshot(targetBook, "version-09", "Target", "custom", base.id);
  const source = snapshot(sourceBook, "version-10", "Source", "custom", base.id);
  assert.throws(() => mergeVersions(target, source, base), /Merge conflict in chapter "chapter-1"/);

  const legacy = createBookSnapshot({
    id: "legacy-03",
    projectId: "project-1",
    bookId: "book-1",
    label: "custom",
    name: "Legacy",
    createdAt: "2026-09-01T11:05:00.000Z",
    manuscript: base.manuscript,
    chapters: base.chapters,
  });
  assert.throws(() => mergeVersions(target, legacy, base), /Cannot merge structured and legacy text-only book versions/);
});

test("structured snapshot validation rejects a WorkspaceBook scoped to another book id", () => {
  const book = structuredBook();
  assert.throws(() => createBookSnapshot({
    id: "version-11",
    projectId: "project-1",
    bookId: "different-book",
    label: "draft-1",
    name: "Invalid scope",
    createdAt: "2026-09-01T11:06:00.000Z",
    manuscript: "",
    chapters: {},
    workspaceBook: book,
  }), /structured book id does not match snapshot book id/i);
});

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createManuscriptState,
  createBook,
  createChapter,
  createScene,
  addBook,
  addChapter,
  addScene,
  insertChapter,
  insertScene,
  validateManuscriptState
} = require("../.forge-build/index.js");

function book() { return createBook({ id: "book-1", projectId: "project-1", title: "The First Book" }); }
function chapter(id, number) { return createChapter({ id, bookId: "book-1", number, title: `Chapter ${number}` }); }
function scene(id, order, chapterId = "chapter-1") { return createScene({ id, chapterId, order, title: `Scene ${order}` }); }

function stateWithBook() { return addBook(createManuscriptState(), book()); }
function stateWithChapter() { return addChapter(stateWithBook(), chapter("chapter-1", 1)); }

 test("creates canonical book, chapter, and scene records with explicit lifecycle", () => {
  const current = addScene(stateWithChapter(), scene("scene-1", 1));
  assert.equal(current.books[0].lifecycle, "planned");
  assert.equal(current.chapters[0].lifecycle, "planned");
  assert.equal(current.scenes[0].lifecycle, "planned");
  assert.deepEqual(current.books[0].chapterIds, ["chapter-1"]);
  assert.deepEqual(current.chapters[0].sceneIds, ["scene-1"]);
});

test("rejects invalid identifiers, structural values, and lifecycle values", () => {
  assert.throws(() => createBook({ id: "", projectId: "p", title: "Book" }), /Book id is required/);
  assert.throws(() => createChapter({ id: "c", bookId: "b", number: 0, title: "Chapter" }), /Chapter number must be a positive integer/);
  assert.throws(() => createScene({ id: "s", chapterId: "c", order: 1.5, title: "Scene" }), /Scene order must be a positive integer/);
  assert.throws(() => createBook({ id: "b", projectId: "p", title: "Book", lifecycle: "invalid" }), /Invalid book lifecycle/);
});

test("rejects duplicate manuscript identifiers across all structural levels", () => {
  assert.throws(() => addChapter(stateWithBook(), createChapter({ id: "book-1", bookId: "book-1", number: 1, title: "Collision" })), /Duplicate manuscript identifier/);
  const current = stateWithChapter();
  assert.throws(() => addScene(current, scene("chapter-1", 1)), /Duplicate manuscript identifier/);
});

test("rejects duplicate chapter numbers within one book but permits them in another book", () => {
  assert.throws(() => addChapter(stateWithChapter(), chapter("chapter-2", 1)), /Duplicate chapter number/);
  const otherBook = createBook({ id: "book-2", projectId: "project-1", title: "Second Book" });
  let current = addBook(stateWithChapter(), otherBook);
  current = addChapter(current, createChapter({ id: "chapter-2", bookId: "book-2", number: 1, title: "Chapter 1" }));
  assert.equal(current.chapters.length, 2);
});

test("rejects duplicate scene order within one chapter but permits it in another chapter", () => {
  const secondChapter = chapter("chapter-2", 2);
  let current = addChapter(stateWithChapter(), secondChapter);
  current = addScene(current, scene("scene-1", 1));
  assert.throws(() => addScene(current, scene("scene-2", 1)), /Duplicate scene order/);
  current = addScene(current, scene("scene-2", 1, "chapter-2"));
  assert.equal(current.scenes.length, 2);
});

test("maintains deterministic chapter and scene ordering regardless of insertion order", () => {
  let current = stateWithBook();
  current = insertChapter(current, chapter("chapter-3", 3));
  current = insertChapter(current, chapter("chapter-1", 1));
  current = insertChapter(current, chapter("chapter-2", 2));
  current = insertScene(current, scene("scene-3", 3));
  current = insertScene(current, scene("scene-1", 1));
  current = insertScene(current, scene("scene-2", 2));
  assert.deepEqual(current.books[0].chapterIds, ["chapter-1", "chapter-2", "chapter-3"]);
  assert.deepEqual(current.chapters.find((item) => item.id === "chapter-1").sceneIds, ["scene-1", "scene-2", "scene-3"]);
  validateManuscriptState(current);
});

test("preserves exact parent relationships and rejects orphaned structural state", () => {
  const current = addScene(stateWithChapter(), scene("scene-1", 1));
  assert.equal(current.chapters[0].bookId, current.books[0].id);
  assert.equal(current.scenes[0].chapterId, current.chapters[0].id);
  assert.throws(() => validateManuscriptState({ ...current, chapters: [{ ...current.chapters[0], bookId: "missing-book" }] }), /unknown book/);
  assert.throws(() => validateManuscriptState({ ...current, scenes: [{ ...current.scenes[0], chapterId: "missing-chapter" }] }), /unknown chapter/);
});

test("rejects invalid cross-parent child references and missing child references", () => {
  const secondBook = createBook({ id: "book-2", projectId: "project-1", title: "Second Book" });
  let current = addChapter(stateWithChapter(), chapter("chapter-2", 2));
  current = addBook(current, secondBook);
  assert.throws(() => validateManuscriptState({ ...current, books: current.books.map((item) => item.id === "book-2" ? { ...item, chapterIds: ["chapter-1"] } : item) }), /invalid chapter relationship/);
  assert.throws(() => validateManuscriptState({ ...current, books: current.books.map((item) => item.id === "book-1" ? { ...item, chapterIds: [] } : item) }), /invalid chapter relationship/);
});

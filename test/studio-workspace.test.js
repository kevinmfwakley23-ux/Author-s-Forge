const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createStudioWorkspace,
  createWorkspaceBook,
  addWorkspaceBook,
  addWorkspaceChapter,
  addWorkspaceScene,
  saveSceneContent,
  getBook,
  validateStudioWorkspace,
} = require("../dist/domain/studio-workspace.js");

test("Studio workspace persists a real book -> chapter -> scene -> manuscript content path", () => {
  let state = createStudioWorkspace();
  const book = createWorkspaceBook({ id: "book-1", title: "The Working Book", kind: "memoir" });
  state = addWorkspaceBook(state, book);
  state = addWorkspaceChapter(state, book.id, { id: "chapter-1", number: 1, title: "The Beginning", synopsis: "Open the story." });
  state = addWorkspaceScene(state, book.id, "chapter-1", { id: "scene-1", number: 1, title: "First Scene", synopsis: "Establish the voice." });
  state = saveSceneContent(state, book.id, "chapter-1", "scene-1", "This is real manuscript content saved in the workspace.");
  const restored = validateStudioWorkspace(JSON.parse(JSON.stringify(state)));
  const scene = getBook(restored, book.id).chapters[0].scenes[0];
  assert.equal(scene.content, "This is real manuscript content saved in the workspace.");
  assert.equal(scene.wordCount, 9);
  assert.equal(restored.activeBookId, book.id);
});

test("Studio workspace rejects duplicate chapter numbers", () => {
  let state = addWorkspaceBook(createStudioWorkspace(), createWorkspaceBook({ id: "book-2", title: "Book", kind: "novel" }));
  state = addWorkspaceChapter(state, "book-2", { id: "chapter-a", number: 1, title: "One" });
  assert.throws(() => addWorkspaceChapter(state, "book-2", { id: "chapter-b", number: 1, title: "Duplicate" }), /already exists/);
});

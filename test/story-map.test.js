import test from "node:test";
import assert from "node:assert/strict";
import { createManuscriptState, createBook, createChapter, createScene, addBook, addChapter, addScene, createStoryMap, StoryMapService } from "../.forge-build/index.js";

test("story map deterministically projects manuscript hierarchy into visual planning data", () => {
  let state = createManuscriptState();
  state = addBook(state, createBook({ id: "book-1", projectId: "project-1", title: "The Book", lifecycle: "active" }));
  state = addChapter(state, createChapter({ id: "chapter-2", bookId: "book-1", number: 2, title: "Second", lifecycle: "drafting" }));
  state = addChapter(state, createChapter({ id: "chapter-1", bookId: "book-1", number: 1, title: "First", lifecycle: "complete" }));
  state = addScene(state, createScene({ id: "scene-2", chapterId: "chapter-1", order: 2, title: "Two", lifecycle: "planned" }));
  state = addScene(state, createScene({ id: "scene-1", chapterId: "chapter-1", order: 1, title: "One", lifecycle: "complete" }));
  const map = createStoryMap(state);
  assert.equal(map.formatVersion, 1);
  assert.equal(map.totals.books, 1);
  assert.equal(map.totals.chapters, 2);
  assert.equal(map.totals.scenes, 2);
  assert.equal(map.totals.completedScenes, 1);
  assert.equal(map.totals.completionPercent, 50);
  assert.deepEqual(map.books[0].chapters.map((chapter) => chapter.number), [1, 2]);
  assert.deepEqual(map.books[0].chapters[0].scenes.map((scene) => scene.order), [1, 2]);
  assert.equal(map.books[0].chapters[0].completionPercent, 50);
});

test("StoryMapService exposes the same deterministic projection through the application boundary", () => {
  let state = createManuscriptState();
  state = addBook(state, createBook({ id: "book-1", projectId: "project-1", title: "The Book" }));
  const result = new StoryMapService().build({ manuscript: state });
  assert.equal(result.books[0].title, "The Book");
  assert.equal(result.totals.completionPercent, 0);
});

test("empty manuscripts produce a safe zero-progress story map", () => {
  const map = createStoryMap(createManuscriptState());
  assert.deepEqual(map.totals, { books: 0, chapters: 0, scenes: 0, completedScenes: 0, completionPercent: 0 });
});

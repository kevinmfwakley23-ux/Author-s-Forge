import test from "node:test";
import assert from "node:assert/strict";
import { createAuthorGoal, createAuthorGoalsSnapshot } from "../dist/domain/author-goals.js";
import { createManuscriptState, createBook, createChapter, createScene, addBook, addChapter, addScene } from "../dist/domain/manuscript.js";

test("author goals calculate progress from authoritative manuscript state", () => {
  let manuscript = createManuscriptState();
  manuscript = addBook(manuscript, createBook({ id: "book-1", projectId: "project-1", title: "Test Book" }));
  manuscript = addChapter(manuscript, createChapter({ id: "chapter-1", bookId: "book-1", number: 1, title: "Chapter One", lifecycle: "complete" }));
  manuscript = addScene(manuscript, createScene({ id: "scene-1", chapterId: "chapter-1", order: 1, title: "Opening", lifecycle: "complete" }));
  const goal = createAuthorGoal({ id: "daily-scenes", metric: "scenes", target: 2 });
  const snapshot = createAuthorGoalsSnapshot(manuscript, [goal], 1200);
  assert.equal(snapshot.manuscript.words, 1200);
  assert.equal(snapshot.manuscript.completedScenes, 1);
  assert.equal(snapshot.progress[0].current, 1);
  assert.equal(snapshot.progress[0].remaining, 1);
  assert.equal(snapshot.progress[0].percent, 50);
  assert.equal(snapshot.progress[0].complete, false);
});

test("author goals clamp completion and reject invalid targets", () => {
  let manuscript = createManuscriptState();
  manuscript = addBook(manuscript, createBook({ id: "book-1", projectId: "project-1", title: "Test Book" }));
  const goal = createAuthorGoal({ id: "project-chapters", metric: "chapters", target: 1, period: "project" });
  const snapshot = createAuthorGoalsSnapshot(manuscript, [goal], 0);
  assert.equal(snapshot.progress[0].percent, 0);
  assert.equal(snapshot.progress[0].complete, false);
  assert.throws(() => createAuthorGoal({ id: "bad", metric: "words", target: 0 }));
});

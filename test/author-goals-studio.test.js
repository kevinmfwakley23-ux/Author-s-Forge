import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProject } from "../dist/domain/project.js";
import { createAuthorGoal } from "../dist/domain/author-goals.js";
import { FileProjectStore } from "../dist/infrastructure/file-project-store.js";
import { StudioAuthorGoalsService } from "../dist/application/author-goals-studio.js";
import { createStudioWorkspace, addWorkspaceBook, addWorkspaceChapter, addWorkspaceScene, saveSceneContent } from "../dist/domain/studio-workspace.js";

async function fixture(root) {
  const projects = new FileProjectStore(root);
  let workspace = createStudioWorkspace();
  workspace = addWorkspaceBook(workspace, { id: "book-1", title: "Book", kind: "novel", lifecycle: "active", description: "", chapters: [], updatedAt: "2026-08-30T09:00:00.000Z" });
  workspace = addWorkspaceChapter(workspace, "book-1", { id: "chapter-1", number: 1, title: "Chapter One", now: "2026-08-30T09:00:00.000Z" });
  workspace = addWorkspaceScene(workspace, "book-1", "chapter-1", { id: "scene-1", number: 1, title: "Opening", now: "2026-08-30T09:00:00.000Z" });
  workspace = saveSceneContent(workspace, "book-1", "chapter-1", "scene-1", "one two three four five six seven eight nine ten", "2026-08-30T09:01:00.000Z");
  await projects.create({ ...createProject({ id: "project-1", title: "Goals", now: "2026-08-30T08:00:00.000Z" }), studioWorkspace: workspace });
  return projects;
}

test("Studio Author Goals persist in durable project state and survive a fresh store boundary", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-goals-studio-"));
  try {
    const projects = await fixture(root);
    const service = new StudioAuthorGoalsService(projects);
    await service.upsert("project-1", createAuthorGoal({ id: "daily-words", metric: "words", target: 20, period: "day" }), "2026-08-30T09:02:00.000Z");
    const snapshot = await service.snapshot("project-1");
    assert.equal(snapshot.manuscript.words, 10);
    assert.equal(snapshot.progress[0].current, 10);
    assert.equal(snapshot.progress[0].percent, 50);

    const reopened = new StudioAuthorGoalsService(new FileProjectStore(root));
    const goals = await reopened.list("project-1");
    assert.equal(goals.length, 1);
    assert.equal(goals[0].id, "daily-words");
    assert.equal((await reopened.snapshot("project-1")).progress[0].remaining, 10);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Studio Author Goals replace and remove operations reject duplicate or missing ids", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-goals-studio-guard-"));
  try {
    const projects = await fixture(root);
    const service = new StudioAuthorGoalsService(projects);
    const goal = createAuthorGoal({ id: "chapter-goal", metric: "chapters", target: 2, period: "project" });
    await assert.rejects(() => service.replace("project-1", [goal, goal]), /Duplicate author goal id/);
    await service.replace("project-1", [goal]);
    await assert.rejects(() => service.remove("project-1", "missing"), /not found/);
    assert.deepEqual(await service.remove("project-1", "chapter-goal"), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

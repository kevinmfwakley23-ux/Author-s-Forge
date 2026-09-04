"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { Readable } = require("node:stream");

const {
  createStudioWorkspace,
  createWorkspaceBook,
  addWorkspaceBook,
  addWorkspaceChapter,
  addWorkspaceScene,
  saveSceneContent,
} = require("../dist/domain/studio-workspace");
const { sceneContentSha256 } = require("../dist/domain/human-review");
const { FileHumanReviewStore } = require("../dist/infrastructure/file-human-review-store");
const { createStudioHumanReviewRoutes } = require("../dist/application/studio-human-review-routes");

function request(method, payload, token) {
  const raw = payload === undefined ? "" : JSON.stringify(payload);
  const req = Readable.from(raw ? [raw] : []);
  req.method = method;
  req.headers = token ? { "x-forge-review-token": token } : {};
  return req;
}
function capture() {
  let status = 0, raw = "";
  return { res: { writeHead(code) { status = code; }, end(value) { raw += value ? String(value) : ""; } }, result: () => ({ status, json: raw ? JSON.parse(raw) : undefined }) };
}
async function call(handler, method, url, projectId, payload, token) {
  const c = capture();
  const handled = await handler(request(method, payload, token), c.res, new URL(url, "http://localhost"), projectId);
  assert.equal(handled, true);
  return c.result();
}
function addBook(workspace, id, title) {
  let next = addWorkspaceBook(workspace, createWorkspaceBook({ id, title, kind: "novel", now: "2026-09-04T12:00:00.000Z" }));
  next = addWorkspaceChapter(next, id, { id: `${id}-chapter`, number: 1, title: "Chapter", now: "2026-09-04T12:00:00.000Z" });
  next = addWorkspaceScene(next, id, `${id}-chapter`, { id: `${id}-scene`, number: 1, title: "Scene", now: "2026-09-04T12:00:00.000Z" });
  return saveSceneContent(next, id, `${id}-chapter`, `${id}-scene`, `${title} text`, "2026-09-04T12:00:00.000Z");
}

test("book-scoped reviewer sees only assigned book and cannot target another book", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "forge-review-scope-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const projectId = "scoped-project";
  let workspace = createStudioWorkspace();
  workspace = addBook(workspace, "book-a", "Allowed Book");
  workspace = addBook(workspace, "book-b", "Private Book");
  const project = { metadata: { id: projectId }, studioWorkspace: workspace };
  const projects = { async load(id) { return id === projectId ? project : null; }, async save() { throw new Error("reviewers must not save project state directly"); } };
  const reviews = new FileHumanReviewStore(join(root, "reviews.json"));
  const handler = createStudioHumanReviewRoutes(projects, reviews);

  const invitation = await call(handler, "POST", `/api/projects/${projectId}/human-review/reviewers`, projectId, {
    id: "editor-a", displayName: "Scoped Editor", role: "editor", scope: { kind: "book", bookId: "book-a" },
  });
  assert.deepEqual(invitation.json.reviewer.scope, { kind: "book", bookId: "book-a" });
  const token = invitation.json.token;

  const context = await call(handler, "GET", `/api/projects/${projectId}/human-review/context`, projectId, undefined, token);
  assert.equal(context.json.workspace.books.length, 1);
  assert.equal(context.json.workspace.books[0].id, "book-a");
  assert.equal(context.json.workspace.activeBookId, "book-a");

  const allowedTarget = { bookId: "book-a", chapterId: "book-a-chapter", sceneId: "book-a-scene" };
  const allowed = await call(handler, "POST", `/api/projects/${projectId}/human-review/suggestions`, projectId, {
    id: "allowed", target: allowedTarget, baseContentSha256: sceneContentSha256("Allowed Book text"), replacementContent: "Allowed revised text", rationale: "Scoped edit",
  }, token);
  assert.equal(allowed.status, 201);

  const forbiddenTarget = { bookId: "book-b", chapterId: "book-b-chapter", sceneId: "book-b-scene" };
  await assert.rejects(() => call(handler, "POST", `/api/projects/${projectId}/human-review/comments`, projectId, {
    id: "forbidden-comment", target: forbiddenTarget, body: "I should not be able to see this book.",
  }, token), /outside this reviewer's assigned scope/i);
  await assert.rejects(() => call(handler, "POST", `/api/projects/${projectId}/human-review/suggestions`, projectId, {
    id: "forbidden-suggestion", target: forbiddenTarget, baseContentSha256: sceneContentSha256("Private Book text"), replacementContent: "Unauthorized replacement", rationale: "Should fail",
  }, token), /outside this reviewer's assigned scope/i);
});

test("legacy reviewer records without scope load as project scope", async () => {
  const { validateHumanReviewState } = require("../dist/domain/human-review");
  const state = validateHumanReviewState({
    formatVersion: 1,
    reviewers: [{ id: "legacy", projectId: "p", displayName: "Legacy", role: "beta-reader", tokenHash: "a".repeat(64), status: "active", createdAt: "2026-09-04T12:00:00.000Z" }],
    comments: [], suggestions: [],
  });
  assert.deepEqual(state.reviewers[0].scope, { kind: "project" });
});

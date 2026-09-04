"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { Readable } = require("node:stream");

const { FileHumanReviewStore } = require("../dist/infrastructure/file-human-review-store");
const { createStudioHumanReviewRoutes } = require("../dist/application/studio-human-review-routes");

function request(method, headers = {}) {
  const req = Readable.from([]);
  req.method = method;
  req.headers = headers;
  return req;
}

function responseCapture() {
  let status = 0;
  let raw = "";
  return {
    res: { writeHead(code) { status = code; }, end(value) { raw += value ? String(value) : ""; } },
    result() { return { status, json: raw ? JSON.parse(raw) : undefined }; },
  };
}

async function call(handler, projectId, resource, token) {
  const capture = responseCapture();
  const handled = await handler(
    request("GET", { "x-forge-review-token": token }),
    capture.res,
    new URL(`http://localhost/api/projects/${projectId}/human-review/${resource}`),
    projectId,
  );
  assert.equal(handled, true);
  return capture.result();
}

test("each reviewer can read only their own comments and suggestions", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "forge-review-isolation-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const projectId = "p";
  const reviews = new FileHumanReviewStore(join(root, "reviews.json"));
  const first = await reviews.createReviewer({ id: "r1", projectId, displayName: "Reviewer One", role: "editor" });
  const second = await reviews.createReviewer({ id: "r2", projectId, displayName: "Reviewer Two", role: "editor" });
  const target = { bookId: "book", chapterId: "chapter", sceneId: "scene" };
  const hash = "a".repeat(64);
  await reviews.addComment({ id: "c1", projectId, reviewerId: "r1", target, body: "First reviewer comment." });
  await reviews.addComment({ id: "c2", projectId, reviewerId: "r2", target, body: "Second reviewer comment." });
  await reviews.addSuggestion({ id: "s1", projectId, reviewerId: "r1", target, baseContentSha256: hash, replacementContent: "First replacement", rationale: "First rationale" });
  await reviews.addSuggestion({ id: "s2", projectId, reviewerId: "r2", target, baseContentSha256: hash, replacementContent: "Second replacement", rationale: "Second rationale" });

  const projects = { async load(id) { return id === projectId ? { metadata: { id }, studioWorkspace: { formatVersion: 1, activeBookId: null, books: [] } } : null; } };
  const handler = createStudioHumanReviewRoutes(projects, reviews);

  const firstComments = await call(handler, projectId, "comments", first.token);
  assert.deepEqual(firstComments.json.comments.map((item) => item.id), ["c1"]);
  const secondComments = await call(handler, projectId, "comments", second.token);
  assert.deepEqual(secondComments.json.comments.map((item) => item.id), ["c2"]);
  const firstSuggestions = await call(handler, projectId, "suggestions", first.token);
  assert.deepEqual(firstSuggestions.json.suggestions.map((item) => item.id), ["s1"]);
  const secondSuggestions = await call(handler, projectId, "suggestions", second.token);
  assert.deepEqual(secondSuggestions.json.suggestions.map((item) => item.id), ["s2"]);
});

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, readFile, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { Readable } = require("node:stream");

const { createProject, withProjectStudioWorkspace } = require("../dist/domain/project");
const {
  createStudioWorkspace,
  createWorkspaceBook,
  addWorkspaceBook,
  addWorkspaceChapter,
  addWorkspaceScene,
  saveSceneContent,
  getBook,
  getScene,
} = require("../dist/domain/studio-workspace");
const { sceneContentSha256 } = require("../dist/domain/human-review");
const { verifyCreativeProvenanceChain } = require("../dist/domain/creative-provenance");
const { FileProjectStore } = require("../dist/infrastructure/file-project-store");
const { FileHumanReviewStore } = require("../dist/infrastructure/file-human-review-store");
const { FileCreativeProvenanceStore } = require("../dist/infrastructure/file-creative-provenance-store");
const { createStudioHumanReviewRoutes } = require("../dist/application/studio-human-review-routes");
const { createStudioProvenanceRoutes } = require("../dist/application/studio-provenance-routes");

function request(method, payload, headers = {}) {
  const text = payload === undefined ? "" : JSON.stringify(payload);
  const req = Readable.from(text ? [text] : []);
  req.method = method;
  req.headers = headers;
  return req;
}

function responseCapture() {
  let status = 0;
  let headers = {};
  let body = "";
  return {
    res: {
      writeHead(code, nextHeaders) { status = code; headers = nextHeaders || {}; },
      end(value) { body += value ? String(value) : ""; },
    },
    result() { return { status, headers, body, json: body ? JSON.parse(body) : undefined }; },
  };
}

async function call(handler, method, url, projectId, payload, headers) {
  const capture = responseCapture();
  const handled = await handler(request(method, payload, headers), capture.res, new URL(url, "http://localhost"), projectId);
  assert.equal(handled, true);
  return capture.result();
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "forge-human-review-"));
  const projectId = "review-project";
  const projects = new FileProjectStore(join(root, "projects"));
  let workspace = createStudioWorkspace();
  workspace = addWorkspaceBook(workspace, createWorkspaceBook({ id: "book-1", title: "Review Book", kind: "novel", now: "2026-09-04T12:00:00.000Z" }));
  workspace = addWorkspaceChapter(workspace, "book-1", { id: "chapter-1", number: 1, title: "Opening", now: "2026-09-04T12:00:00.000Z" });
  workspace = addWorkspaceScene(workspace, "book-1", "chapter-1", { id: "scene-1", number: 1, title: "Arrival", now: "2026-09-04T12:00:00.000Z" });
  workspace = saveSceneContent(workspace, "book-1", "chapter-1", "scene-1", "The old scene.", "2026-09-04T12:00:00.000Z");
  await projects.create(withProjectStudioWorkspace(createProject({ id: projectId, title: "Review Test", now: "2026-09-04T12:00:00.000Z" }), workspace, "2026-09-04T12:00:00.000Z"));
  const reviewPath = join(root, "human-reviews.json");
  const provenancePath = join(root, "creative-provenance.json");
  const reviews = new FileHumanReviewStore(reviewPath);
  const provenance = new FileCreativeProvenanceStore(provenancePath);
  return {
    root, projectId, projects, reviews, provenance, reviewPath, provenancePath,
    review: createStudioHumanReviewRoutes(projects, reviews, provenance),
    provenanceRoutes: createStudioProvenanceRoutes(projects, provenance),
  };
}

const target = { bookId: "book-1", chapterId: "chapter-1", sceneId: "scene-1" };

test("review credentials are hashed at rest and beta readers cannot mutate or suggest manuscript replacements", async (t) => {
  const f = await fixture();
  t.after(() => rm(f.root, { recursive: true, force: true }));
  const invitation = await call(f.review, "POST", `/api/projects/${f.projectId}/human-review/reviewers`, f.projectId, { id: "beta", displayName: "Beta One", role: "beta-reader" });
  assert.equal(invitation.status, 201);
  assert.equal(invitation.json.tokenShownOnce, true);
  assert.match(invitation.json.reviewUrl, /#token=/);
  const rawToken = invitation.json.token;
  const stored = await readFile(f.reviewPath, "utf8");
  assert.equal(stored.includes(rawToken), false, "raw review token must never be persisted");
  assert.match(stored, /"tokenHash":\s*"[a-f0-9]{64}"/);

  const context = await call(f.review, "GET", `/api/projects/${f.projectId}/human-review/context`, f.projectId, undefined, { "x-forge-review-token": rawToken });
  assert.equal(context.json.permissions.comment, true);
  assert.equal(context.json.permissions.suggest, false);
  assert.equal(context.json.permissions.directManuscriptMutation, false);

  await assert.rejects(() => call(f.review, "POST", `/api/projects/${f.projectId}/human-review/suggestions`, f.projectId, {
    target,
    baseContentSha256: sceneContentSha256("The old scene."),
    replacementContent: "A beta reader must not be able to replace this.",
    rationale: "Attempted direct editorial suggestion.",
  }, { "x-forge-review-token": rawToken }), /cannot propose manuscript replacements/i);
});

test("editor suggestion requires author acceptance, blocks stale content, applies durably, and writes verified provenance", async (t) => {
  const f = await fixture();
  t.after(() => rm(f.root, { recursive: true, force: true }));
  const invitation = await call(f.review, "POST", `/api/projects/${f.projectId}/human-review/reviewers`, f.projectId, { id: "editor", displayName: "Editor One", role: "editor" });
  const token = invitation.json.token;
  const proposed = "The revised scene arrives with stronger momentum.";
  const suggestion = await call(f.review, "POST", `/api/projects/${f.projectId}/human-review/suggestions`, f.projectId, {
    id: "suggestion-1", target,
    baseContentSha256: sceneContentSha256("The old scene."),
    replacementContent: proposed,
    rationale: "Tighten the opening and make the action more immediate.",
  }, { "x-forge-review-token": token });
  assert.equal(suggestion.status, 201);
  assert.equal(suggestion.json.status, "pending");

  await assert.rejects(() => call(f.review, "POST", `/api/projects/${f.projectId}/human-review/suggestions/suggestion-1/apply`, f.projectId, {}), /must be accepted/);
  const accepted = await call(f.review, "POST", `/api/projects/${f.projectId}/human-review/suggestions/suggestion-1/review`, f.projectId, { decision: "accepted" });
  assert.equal(accepted.json.status, "accepted");
  const applied = await call(f.review, "POST", `/api/projects/${f.projectId}/human-review/suggestions/suggestion-1/apply`, f.projectId, { now: "2026-09-04T13:00:00.000Z" });
  assert.equal(applied.json.suggestion.status, "applied");
  assert.equal(applied.json.provenanceRecorded, true);

  const project = await f.projects.load(f.projectId);
  const scene = getScene(getBook(project.studioWorkspace, "book-1"), "chapter-1", "scene-1");
  assert.equal(scene.content, proposed);

  const records = await f.provenance.list(f.projectId);
  assert.equal(records.length, 1);
  assert.equal(records[0].action, "applied");
  assert.equal(records[0].sourceType, "human-edited");
  assert.equal(records[0].humanOversight, "author-reviewed");
  assert.equal(records[0].beforeSha256, sceneContentSha256("The old scene."));
  assert.equal(records[0].afterSha256, sceneContentSha256(proposed));
  assert.equal(records[0].details.reviewSuggestionId, "suggestion-1");
  assert.equal((await f.provenance.verify(f.projectId)).valid, true);

  const exported = await call(f.provenanceRoutes, "GET", `/api/projects/${f.projectId}/provenance/export`, f.projectId);
  assert.equal(exported.json.integrity.valid, true);
  assert.equal(exported.json.contentCredentials.signed, false);
  assert.equal(exported.json.contentCredentials.c2paCompliant, false);
});

test("stale reviewer suggestions are rejected after the author changes the scene", async (t) => {
  const f = await fixture();
  t.after(() => rm(f.root, { recursive: true, force: true }));
  const invitation = await call(f.review, "POST", `/api/projects/${f.projectId}/human-review/reviewers`, f.projectId, { id: "editor", displayName: "Editor", role: "editor" });
  const token = invitation.json.token;
  await call(f.review, "POST", `/api/projects/${f.projectId}/human-review/suggestions`, f.projectId, {
    id: "stale", target, baseContentSha256: sceneContentSha256("The old scene."), replacementContent: "Reviewer version.", rationale: "Suggested rewrite.",
  }, { "x-forge-review-token": token });
  await call(f.review, "POST", `/api/projects/${f.projectId}/human-review/suggestions/stale/review`, f.projectId, { decision: "accepted" });

  const project = await f.projects.load(f.projectId);
  const changed = saveSceneContent(project.studioWorkspace, "book-1", "chapter-1", "scene-1", "Author changed this independently.", "2026-09-04T12:30:00.000Z");
  await f.projects.save({ ...project, studioWorkspace: changed, metadata: { ...project.metadata, updatedAt: "2026-09-04T12:30:00.000Z" } });
  await assert.rejects(() => call(f.review, "POST", `/api/projects/${f.projectId}/human-review/suggestions/stale/apply`, f.projectId, {}), /stale because the target scene changed/i);
  assert.equal((await f.provenance.list(f.projectId)).length, 0);
});

test("provenance chain detects tampering and rejects scene events that do not match durable content", async (t) => {
  const f = await fixture();
  t.after(() => rm(f.root, { recursive: true, force: true }));
  const first = await f.provenance.append({
    id: "p1", projectId: f.projectId, action: "created", sourceType: "human-created",
    actor: { kind: "human", role: "author" }, asset: { kind: "scene", id: "scene-1", ...target }, humanOversight: "author-directed",
    afterSha256: sceneContentSha256("The old scene."), createdAt: "2026-09-04T12:00:00.000Z",
  });
  const second = await f.provenance.append({
    id: "p2", projectId: f.projectId, action: "reviewed", sourceType: "human-created",
    actor: { kind: "human", role: "editor", id: "editor" }, asset: { kind: "scene", id: "scene-1", ...target }, humanOversight: "reviewer-suggested",
    afterSha256: sceneContentSha256("The old scene."), createdAt: "2026-09-04T12:01:00.000Z",
  });
  assert.equal(second.previousRecordSha256, first.recordSha256);
  assert.equal(verifyCreativeProvenanceChain([first, second]).valid, true);
  assert.equal(verifyCreativeProvenanceChain([first, { ...second, action: "edited" }]).valid, false);

  await assert.rejects(() => call(f.provenanceRoutes, "POST", `/api/projects/${f.projectId}/provenance/events`, f.projectId, {
    id: "bad-grounding", action: "edited", sourceType: "human-edited", actor: { kind: "human", role: "author" },
    asset: { kind: "scene", id: "scene-1", ...target }, humanOversight: "author-directed", afterSha256: sceneContentSha256("Not the actual scene"),
  }), /after-hash does not match/i);
});

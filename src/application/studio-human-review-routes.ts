import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { FileProjectStore } from "../infrastructure/file-project-store";
import type { FileCreativeProvenanceStore } from "../infrastructure/file-creative-provenance-store";
import type { FileHumanReviewStore } from "../infrastructure/file-human-review-store";
import { humanReviewRole, reviewerPermissions, sceneContentSha256, type HumanReviewTarget } from "../domain/human-review";
import { getBook, getScene, saveSceneContent, validateStudioWorkspace } from "../domain/studio-workspace";

export type StudioHumanReviewRouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL, projectId: string) => Promise<boolean>;

export function createStudioHumanReviewRoutes(
  projects: Pick<FileProjectStore, "load" | "save">,
  reviews: FileHumanReviewStore,
  provenance?: FileCreativeProvenanceStore,
): StudioHumanReviewRouteHandler {
  return async (req, res, url, projectId) => {
    const root = `/api/projects/${projectId}/human-review`;

    if (url.pathname === root && req.method === "GET") {
      await requireProject(projects, projectId);
      const [reviewers, comments, suggestions] = await Promise.all([
        reviews.listReviewers(projectId), reviews.listComments(projectId), reviews.listSuggestions(projectId),
      ]);
      json(res, 200, { reviewers: reviewers.map(publicReviewer), comments, suggestions });
      return true;
    }

    if (url.pathname === `${root}/reviewers` && req.method === "POST") {
      await requireProject(projects, projectId);
      const input = await body(req);
      const created = await reviews.createReviewer({
        id: String(input.id ?? `reviewer-${randomUUID()}`),
        projectId,
        displayName: requiredText(input.displayName, "Reviewer display name", 160),
        role: humanReviewRole(input.role),
        now: optionalTimestamp(input.now),
      });
      const fragmentUrl = `/review.html?project=${encodeURIComponent(projectId)}#token=${encodeURIComponent(created.token)}`;
      json(res, 201, { reviewer: publicReviewer(created.reviewer), token: created.token, reviewUrl: fragmentUrl, tokenShownOnce: true });
      return true;
    }

    const revoke = url.pathname.match(new RegExp(`^${escapeRegex(root)}/reviewers/([^/]+)/revoke$`));
    if (revoke && req.method === "POST") {
      await requireProject(projects, projectId);
      const reviewer = await reviews.revokeReviewer(projectId, decodeURIComponent(revoke[1]), optionalTimestamp((await body(req)).now));
      json(res, 200, publicReviewer(reviewer));
      return true;
    }

    if (url.pathname === `${root}/context` && req.method === "GET") {
      const project = await requireProject(projects, projectId);
      const reviewer = await authenticateReviewer(req, reviews, projectId);
      const workspace = workspaceOf(project);
      json(res, 200, { reviewer: publicReviewer(reviewer), permissions: reviewerPermissions(reviewer.role), workspace });
      return true;
    }

    if (url.pathname === `${root}/comments` && req.method === "GET") {
      await requireProject(projects, projectId);
      const token = reviewToken(req);
      if (token) await reviews.authenticate(projectId, token);
      json(res, 200, { comments: await reviews.listComments(projectId) });
      return true;
    }

    if (url.pathname === `${root}/comments` && req.method === "POST") {
      const project = await requireProject(projects, projectId);
      const reviewer = await authenticateReviewer(req, reviews, projectId);
      const input = await body(req);
      const target = reviewTarget(input.target);
      const scene = sceneFor(project, target);
      const currentHash = sceneContentSha256(scene.content);
      const rawSelection = input.selection;
      let selection;
      if (rawSelection !== undefined) {
        if (!rawSelection || typeof rawSelection !== "object" || Array.isArray(rawSelection)) throw new Error("Review selection must be an object.");
        const candidate = rawSelection as Record<string, unknown>;
        const start = Number(candidate.start), end = Number(candidate.end), quote = String(candidate.quote ?? ""), baseContentSha256 = String(candidate.baseContentSha256 ?? "").toLowerCase();
        if (baseContentSha256 !== currentHash) throw new Error("Selected-text comment is stale because the scene changed. Reload the scene before commenting.");
        if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > scene.content.length) throw new Error("Selected-text comment offsets are invalid.");
        if (scene.content.slice(start, end) !== quote) throw new Error("Selected-text comment quote does not match the current scene revision.");
        selection = { start, end, quote, baseContentSha256 };
      }
      const comment = await reviews.addComment({
        id: String(input.id ?? `comment-${randomUUID()}`), projectId, reviewerId: reviewer.id, target,
        body: requiredText(input.body, "Review comment", 8_000), ...(selection ? { selection } : {}), now: optionalTimestamp(input.now),
      });
      json(res, 201, comment);
      return true;
    }

    const resolve = url.pathname.match(new RegExp(`^${escapeRegex(root)}/comments/([^/]+)/resolve$`));
    if (resolve && req.method === "POST") {
      await requireProject(projects, projectId);
      const input = await body(req);
      const comment = await reviews.resolveComment(projectId, decodeURIComponent(resolve[1]), optionalText(input.note, 4_000), optionalTimestamp(input.now));
      json(res, 200, comment);
      return true;
    }

    if (url.pathname === `${root}/suggestions` && req.method === "GET") {
      await requireProject(projects, projectId);
      const token = reviewToken(req);
      if (token) await reviews.authenticate(projectId, token);
      json(res, 200, { suggestions: await reviews.listSuggestions(projectId) });
      return true;
    }

    if (url.pathname === `${root}/suggestions` && req.method === "POST") {
      const project = await requireProject(projects, projectId);
      const reviewer = await authenticateReviewer(req, reviews, projectId);
      if (!reviewerPermissions(reviewer.role).suggest) throw new Error(`Review role "${reviewer.role}" can comment but cannot propose manuscript replacements.`);
      const input = await body(req);
      const target = reviewTarget(input.target);
      const scene = sceneFor(project, target);
      const baseContentSha256 = String(input.baseContentSha256 ?? "").trim().toLowerCase();
      if (baseContentSha256 !== sceneContentSha256(scene.content)) throw new Error("Review suggestion is stale because the scene changed. Reload before proposing a replacement.");
      const suggestion = await reviews.addSuggestion({
        id: String(input.id ?? `suggestion-${randomUUID()}`), projectId, reviewerId: reviewer.id, target,
        baseContentSha256, replacementContent: String(input.replacementContent ?? ""),
        rationale: requiredText(input.rationale, "Review suggestion rationale", 8_000), now: optionalTimestamp(input.now),
      });
      json(res, 201, suggestion);
      return true;
    }

    const decision = url.pathname.match(new RegExp(`^${escapeRegex(root)}/suggestions/([^/]+)/review$`));
    if (decision && req.method === "POST") {
      await requireProject(projects, projectId);
      const input = await body(req);
      const value = input.decision === "accepted" || input.decision === "rejected" ? input.decision : (() => { throw new Error("Suggestion decision must be accepted or rejected."); })();
      const suggestion = await reviews.reviewSuggestion(projectId, decodeURIComponent(decision[1]), value, optionalText(input.note, 4_000), optionalTimestamp(input.now));
      json(res, 200, suggestion);
      return true;
    }

    const apply = url.pathname.match(new RegExp(`^${escapeRegex(root)}/suggestions/([^/]+)/apply$`));
    if (apply && req.method === "POST") {
      const project = await requireProject(projects, projectId);
      const input = await body(req);
      const suggestion = await reviews.getSuggestion(projectId, decodeURIComponent(apply[1]));
      if (suggestion.status !== "accepted") throw new Error(`Review suggestion "${suggestion.id}" must be accepted before it can be applied.`);
      const workspace = workspaceOf(project);
      const scene = getScene(getBook(workspace, suggestion.target.bookId), suggestion.target.chapterId, suggestion.target.sceneId);
      if (sceneContentSha256(scene.content) !== suggestion.baseContentSha256 && scene.content !== suggestion.replacementContent) {
        throw new Error(`Review suggestion "${suggestion.id}" is stale because the target scene changed after the reviewer proposed it.`);
      }
      const now = optionalTimestamp(input.now) ?? new Date().toISOString();
      if (scene.content !== suggestion.replacementContent) {
        const updatedWorkspace = saveSceneContent(workspace, suggestion.target.bookId, suggestion.target.chapterId, suggestion.target.sceneId, suggestion.replacementContent, now);
        await projects.save({ ...project, studioWorkspace: updatedWorkspace, metadata: { ...project.metadata, updatedAt: now } } as never);
      }
      if (provenance) {
        const provenanceId = `human-review-apply-${suggestion.id}`;
        const existing = (await provenance.list(projectId)).find((record) => record.id === provenanceId);
        if (!existing) {
          const reviewer = (await reviews.listReviewers(projectId)).find((item) => item.id === suggestion.reviewerId);
          await provenance.append({
            id: provenanceId,
            projectId,
            action: "applied",
            sourceType: "human-edited",
            actor: { kind: "human", role: "author" },
            asset: {
              kind: "scene",
              id: suggestion.target.sceneId,
              bookId: suggestion.target.bookId,
              chapterId: suggestion.target.chapterId,
              sceneId: suggestion.target.sceneId,
              mediaType: "text/plain",
            },
            humanOversight: "author-reviewed",
            createdAt: now,
            beforeSha256: suggestion.baseContentSha256,
            afterSha256: sceneContentSha256(suggestion.replacementContent),
            ingredients: [{ kind: "scene", id: suggestion.target.sceneId, bookId: suggestion.target.bookId, chapterId: suggestion.target.chapterId, sceneId: suggestion.target.sceneId, mediaType: "text/plain" }],
            details: {
              reviewSuggestionId: suggestion.id,
              reviewerId: suggestion.reviewerId,
              reviewerRole: reviewer?.role ?? "unknown",
              reviewerName: reviewer?.displayName ?? "unknown",
              rationale: suggestion.rationale,
            },
          });
        }
      }
      const applied = await reviews.markApplied(projectId, suggestion.id, now);
      json(res, 200, { suggestion: applied, applied: true, provenanceRecorded: Boolean(provenance) });
      return true;
    }

    return false;
  };
}

function publicReviewer(reviewer: { id: string; projectId: string; displayName: string; role: string; status: string; createdAt: string; revokedAt?: string }) {
  return { id: reviewer.id, projectId: reviewer.projectId, displayName: reviewer.displayName, role: reviewer.role, status: reviewer.status, createdAt: reviewer.createdAt, ...(reviewer.revokedAt ? { revokedAt: reviewer.revokedAt } : {}) };
}
function reviewToken(req: IncomingMessage): string | undefined { const value = req.headers["x-forge-review-token"]; return Array.isArray(value) ? value[0]?.trim() : value?.trim(); }
async function authenticateReviewer(req: IncomingMessage, reviews: FileHumanReviewStore, projectId: string) { const token = reviewToken(req); if (!token) throw new Error("A Forge review token is required."); return reviews.authenticate(projectId, token); }
async function requireProject(projects: Pick<FileProjectStore, "load">, projectId: string) { const project = await projects.load(projectId); if (!project) throw new Error(`Project "${projectId}" not found.`); return project; }
function workspaceOf(project: { studioWorkspace?: unknown }) { return project.studioWorkspace ? validateStudioWorkspace(project.studioWorkspace) : validateStudioWorkspace({ formatVersion: 1, activeBookId: null, books: [] }); }
function sceneFor(project: { studioWorkspace?: unknown }, target: HumanReviewTarget) { const workspace = workspaceOf(project); return getScene(getBook(workspace, target.bookId), target.chapterId, target.sceneId); }
function reviewTarget(value: unknown): HumanReviewTarget { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Review target is required."); const target = value as Record<string, unknown>; return { bookId: requiredText(target.bookId, "Review target book id", 256), chapterId: requiredText(target.chapterId, "Review target chapter id", 256), sceneId: requiredText(target.sceneId, "Review target scene id", 256) }; }
function requiredText(value: unknown, label: string, max: number): string { const text = String(value ?? "").trim(); if (!text) throw new Error(`${label} is required.`); if (text.length > max) throw new Error(`${label} exceeds ${max} characters.`); return text; }
function optionalText(value: unknown, max: number): string | undefined { if (value === undefined || value === null || value === "") return undefined; const text = String(value).trim(); if (!text) return undefined; if (text.length > max) throw new Error(`Optional review text exceeds ${max} characters.`); return text; }
function optionalTimestamp(value: unknown): string | undefined { if (value === undefined || value === null || value === "") return undefined; const result = String(value); if (Number.isNaN(Date.parse(result))) throw new Error("Human review timestamp is invalid."); return result; }
async function body(req: IncomingMessage): Promise<Record<string, unknown>> { let raw = ""; for await (const chunk of req) { raw += String(chunk); if (raw.length > 3 * 1024 * 1024) throw new Error("Human review request body exceeds 3 MiB."); } if (!raw.trim()) return {}; const parsed = JSON.parse(raw); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Human review request body must be a JSON object."); return parsed as Record<string, unknown>; }
function json(res: ServerResponse, status: number, value: unknown): void { res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" }); res.end(JSON.stringify(value)); }
function escapeRegex(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

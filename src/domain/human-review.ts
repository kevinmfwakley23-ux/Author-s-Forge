import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const HUMAN_REVIEW_FORMAT_VERSION = 1 as const;
export const HUMAN_REVIEW_ROLES = ["co-writer", "editor", "beta-reader"] as const;
export type HumanReviewRole = (typeof HUMAN_REVIEW_ROLES)[number];
export type HumanReviewerStatus = "active" | "revoked";
export type HumanReviewCommentStatus = "open" | "resolved";
export type HumanReviewSuggestionStatus = "pending" | "accepted" | "rejected" | "applied";

export interface HumanReviewTarget {
  readonly bookId: string;
  readonly chapterId: string;
  readonly sceneId: string;
}

export interface HumanReviewer {
  readonly id: string;
  readonly projectId: string;
  readonly displayName: string;
  readonly role: HumanReviewRole;
  readonly tokenHash: string;
  readonly status: HumanReviewerStatus;
  readonly createdAt: string;
  readonly revokedAt?: string;
}

export interface HumanReviewSelection {
  readonly start: number;
  readonly end: number;
  readonly quote: string;
  readonly baseContentSha256: string;
}

export interface HumanReviewComment {
  readonly id: string;
  readonly projectId: string;
  readonly reviewerId: string;
  readonly target: HumanReviewTarget;
  readonly body: string;
  readonly selection?: HumanReviewSelection;
  readonly status: HumanReviewCommentStatus;
  readonly createdAt: string;
  readonly resolvedAt?: string;
  readonly resolutionNote?: string;
}

export interface HumanReviewSuggestion {
  readonly id: string;
  readonly projectId: string;
  readonly reviewerId: string;
  readonly target: HumanReviewTarget;
  readonly baseContentSha256: string;
  readonly replacementContent: string;
  readonly rationale: string;
  readonly status: HumanReviewSuggestionStatus;
  readonly createdAt: string;
  readonly reviewedAt?: string;
  readonly reviewNote?: string;
  readonly appliedAt?: string;
}

export interface HumanReviewState {
  readonly formatVersion: typeof HUMAN_REVIEW_FORMAT_VERSION;
  readonly reviewers: readonly HumanReviewer[];
  readonly comments: readonly HumanReviewComment[];
  readonly suggestions: readonly HumanReviewSuggestion[];
}

export function emptyHumanReviewState(): HumanReviewState {
  return { formatVersion: HUMAN_REVIEW_FORMAT_VERSION, reviewers: [], comments: [], suggestions: [] };
}

export function humanReviewRole(value: unknown): HumanReviewRole {
  const role = String(value ?? "") as HumanReviewRole;
  if (!HUMAN_REVIEW_ROLES.includes(role)) throw new Error("Invalid human review role.");
  return role;
}

export function reviewerPermissions(role: HumanReviewRole) {
  return Object.freeze({
    comment: true,
    suggest: role === "co-writer" || role === "editor",
    directManuscriptMutation: false,
    description: role === "beta-reader"
      ? "Can read shared manuscript scenes and leave comments."
      : role === "editor"
        ? "Can comment and propose tracked manuscript replacements for author review."
        : "Can comment and propose manuscript replacements; direct mutation remains author-controlled by default.",
  });
}

export function createReviewer(input: { id: string; projectId: string; displayName: string; role: HumanReviewRole; now?: string }): { reviewer: HumanReviewer; token: string } {
  const now = timestamp(input.now);
  const id = required(input.id, "Reviewer id");
  const projectId = required(input.projectId, "Reviewer project id");
  const displayName = required(input.displayName, "Reviewer display name");
  const role = humanReviewRole(input.role);
  const token = randomBytes(32).toString("base64url");
  return {
    reviewer: { id, projectId, displayName, role, tokenHash: hashReviewToken(token), status: "active", createdAt: now },
    token,
  };
}

export function revokeReviewer(reviewer: HumanReviewer, now?: string): HumanReviewer {
  if (reviewer.status === "revoked") return { ...reviewer };
  return { ...reviewer, status: "revoked", revokedAt: timestamp(now) };
}

export function verifyReviewToken(reviewer: HumanReviewer, rawToken: string): boolean {
  if (reviewer.status !== "active") return false;
  const expected = Buffer.from(reviewer.tokenHash, "hex");
  const actual = Buffer.from(hashReviewToken(required(rawToken, "Review token")), "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function hashReviewToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sceneContentSha256(content: string): string {
  return createHash("sha256").update(String(content)).digest("hex");
}

export function createReviewComment(input: {
  id: string; projectId: string; reviewerId: string; target: HumanReviewTarget; body: string; selection?: HumanReviewSelection; now?: string;
}): HumanReviewComment {
  const comment: HumanReviewComment = {
    id: required(input.id, "Review comment id"),
    projectId: required(input.projectId, "Review comment project id"),
    reviewerId: required(input.reviewerId, "Review comment reviewer id"),
    target: validateReviewTarget(input.target),
    body: boundedText(input.body, "Review comment", 8_000),
    ...(input.selection ? { selection: validateSelection(input.selection) } : {}),
    status: "open",
    createdAt: timestamp(input.now),
  };
  return comment;
}

export function resolveReviewComment(comment: HumanReviewComment, note?: string, now?: string): HumanReviewComment {
  if (comment.status === "resolved") return { ...comment };
  return {
    ...comment,
    status: "resolved",
    resolvedAt: timestamp(now),
    ...(note?.trim() ? { resolutionNote: boundedText(note, "Resolution note", 4_000) } : {}),
  };
}

export function createReviewSuggestion(input: {
  id: string; projectId: string; reviewerId: string; target: HumanReviewTarget; baseContentSha256: string; replacementContent: string; rationale: string; now?: string;
}): HumanReviewSuggestion {
  const hash = String(input.baseContentSha256 ?? "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error("Review suggestion base content hash is invalid.");
  const replacementContent = String(input.replacementContent ?? "");
  if (!replacementContent.trim()) throw new Error("Review suggestion replacement content is required.");
  if (replacementContent.length > 2_000_000) throw new Error("Review suggestion replacement content exceeds 2,000,000 characters.");
  return {
    id: required(input.id, "Review suggestion id"),
    projectId: required(input.projectId, "Review suggestion project id"),
    reviewerId: required(input.reviewerId, "Review suggestion reviewer id"),
    target: validateReviewTarget(input.target),
    baseContentSha256: hash,
    replacementContent,
    rationale: boundedText(input.rationale, "Review suggestion rationale", 8_000),
    status: "pending",
    createdAt: timestamp(input.now),
  };
}

export function reviewSuggestion(suggestion: HumanReviewSuggestion, decision: "accepted" | "rejected", note?: string, now?: string): HumanReviewSuggestion {
  if (suggestion.status !== "pending") throw new Error(`Review suggestion "${suggestion.id}" has already been reviewed.`);
  return {
    ...suggestion,
    status: decision,
    reviewedAt: timestamp(now),
    ...(note?.trim() ? { reviewNote: boundedText(note, "Review note", 4_000) } : {}),
  };
}

export function markSuggestionApplied(suggestion: HumanReviewSuggestion, now?: string): HumanReviewSuggestion {
  if (suggestion.status !== "accepted") throw new Error(`Review suggestion "${suggestion.id}" must be accepted before it can be applied.`);
  return { ...suggestion, status: "applied", appliedAt: timestamp(now) };
}

export function validateHumanReviewState(value: unknown): HumanReviewState {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid human review state.");
  const state = value as HumanReviewState;
  if (state.formatVersion !== HUMAN_REVIEW_FORMAT_VERSION) throw new Error("Unsupported human review state format.");
  if (!Array.isArray(state.reviewers) || !Array.isArray(state.comments) || !Array.isArray(state.suggestions)) throw new Error("Invalid human review collections.");
  const reviewerIds = new Set<string>();
  const reviewers = state.reviewers.map((reviewer) => {
    required(reviewer.id, "Reviewer id"); required(reviewer.projectId, "Reviewer project id"); required(reviewer.displayName, "Reviewer display name"); humanReviewRole(reviewer.role);
    if (!/^[a-f0-9]{64}$/.test(reviewer.tokenHash)) throw new Error(`Reviewer "${reviewer.id}" token hash is invalid.`);
    if (reviewer.status !== "active" && reviewer.status !== "revoked") throw new Error(`Reviewer "${reviewer.id}" status is invalid.`);
    timestamp(reviewer.createdAt); if (reviewer.revokedAt) timestamp(reviewer.revokedAt);
    if (reviewerIds.has(reviewer.id)) throw new Error(`Duplicate reviewer id "${reviewer.id}".`); reviewerIds.add(reviewer.id);
    return { ...reviewer };
  });
  const itemIds = new Set<string>();
  const comments = state.comments.map((comment) => {
    required(comment.id, "Review comment id"); required(comment.projectId, "Review comment project id"); required(comment.reviewerId, "Review comment reviewer id"); validateReviewTarget(comment.target); boundedText(comment.body, "Review comment", 8_000); if (comment.selection) validateSelection(comment.selection); timestamp(comment.createdAt); if (comment.resolvedAt) timestamp(comment.resolvedAt);
    if (!reviewerIds.has(comment.reviewerId)) throw new Error(`Review comment "${comment.id}" references a missing reviewer.`);
    if (comment.status !== "open" && comment.status !== "resolved") throw new Error(`Review comment "${comment.id}" status is invalid.`);
    if (itemIds.has(comment.id)) throw new Error(`Duplicate human review item id "${comment.id}".`); itemIds.add(comment.id); return clone(comment);
  });
  const suggestions = state.suggestions.map((suggestion) => {
    required(suggestion.id, "Review suggestion id"); required(suggestion.projectId, "Review suggestion project id"); required(suggestion.reviewerId, "Review suggestion reviewer id"); validateReviewTarget(suggestion.target); if (!/^[a-f0-9]{64}$/.test(suggestion.baseContentSha256)) throw new Error(`Review suggestion "${suggestion.id}" hash is invalid.`); if (!String(suggestion.replacementContent ?? "").trim()) throw new Error(`Review suggestion "${suggestion.id}" content is required.`); boundedText(suggestion.rationale, "Review suggestion rationale", 8_000); timestamp(suggestion.createdAt); if (suggestion.reviewedAt) timestamp(suggestion.reviewedAt); if (suggestion.appliedAt) timestamp(suggestion.appliedAt);
    if (!reviewerIds.has(suggestion.reviewerId)) throw new Error(`Review suggestion "${suggestion.id}" references a missing reviewer.`);
    if (!["pending", "accepted", "rejected", "applied"].includes(suggestion.status)) throw new Error(`Review suggestion "${suggestion.id}" status is invalid.`);
    if (itemIds.has(suggestion.id)) throw new Error(`Duplicate human review item id "${suggestion.id}".`); itemIds.add(suggestion.id); return clone(suggestion);
  });
  return { formatVersion: HUMAN_REVIEW_FORMAT_VERSION, reviewers, comments, suggestions };
}

export function validateReviewTarget(target: HumanReviewTarget): HumanReviewTarget {
  if (!target || typeof target !== "object") throw new Error("Human review target is required.");
  return { bookId: required(target.bookId, "Review target book id"), chapterId: required(target.chapterId, "Review target chapter id"), sceneId: required(target.sceneId, "Review target scene id") };
}

function validateSelection(selection: HumanReviewSelection): HumanReviewSelection {
  if (!Number.isInteger(selection.start) || !Number.isInteger(selection.end) || selection.start < 0 || selection.end <= selection.start) throw new Error("Review selection offsets are invalid.");
  const quote = boundedText(selection.quote, "Review selection quote", 20_000);
  const hash = String(selection.baseContentSha256 ?? "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error("Review selection base content hash is invalid.");
  return { start: selection.start, end: selection.end, quote, baseContentSha256: hash };
}
function required(value: unknown, label: string): string { const text = String(value ?? "").trim(); if (!text) throw new Error(`${label} is required.`); if (text.length > 256) throw new Error(`${label} exceeds 256 characters.`); return text; }
function boundedText(value: unknown, label: string, max: number): string { const text = String(value ?? "").trim(); if (!text) throw new Error(`${label} is required.`); if (text.length > max) throw new Error(`${label} exceeds ${max} characters.`); return text; }
function timestamp(value?: string): string { const result = value ?? new Date().toISOString(); if (Number.isNaN(Date.parse(result))) throw new Error("Human review timestamp is invalid."); return result; }
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

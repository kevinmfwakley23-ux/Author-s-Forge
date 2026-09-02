import { createHash } from "node:crypto";
import { validateStoryMapChapterCard, type StoryMapChapterCard } from "./story-map-planning";

export const CHAPTER_CARD_WORKFLOW_FORMAT_VERSION = 1 as const;
export const CHAPTER_CARD_CANDIDATE_STATUSES = ["pending", "approved", "rejected"] as const;
export type ChapterCardCandidateStatus = typeof CHAPTER_CARD_CANDIDATE_STATUSES[number];

export interface ChapterCardCandidateChapter {
  readonly number: number;
  readonly title: string;
  readonly card: StoryMapChapterCard;
}

export interface ChapterCardCandidateSet {
  readonly id: string;
  readonly projectId: string;
  readonly bookId: string;
  readonly description: string;
  readonly events: readonly string[];
  readonly timelineDetails: readonly string[];
  readonly targetChapters: number;
  readonly chapters: readonly ChapterCardCandidateChapter[];
  readonly status: ChapterCardCandidateStatus;
  readonly provider: string;
  readonly model: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly reviewedAt?: string;
}

export interface ChapterCardApproval {
  readonly chapterId: string;
  readonly cardSha256: string;
  readonly approvedAt: string;
  readonly approvedBy: "author";
  readonly sourceCandidateId?: string;
}

export interface ChapterCardWorkflowState {
  readonly formatVersion: typeof CHAPTER_CARD_WORKFLOW_FORMAT_VERSION;
  readonly candidates: readonly ChapterCardCandidateSet[];
  readonly approvals: readonly ChapterCardApproval[];
}

export function createChapterCardWorkflowState(): ChapterCardWorkflowState {
  return { formatVersion: CHAPTER_CARD_WORKFLOW_FORMAT_VERSION, candidates: [], approvals: [] };
}

export function validateChapterCardWorkflowState(value: unknown): ChapterCardWorkflowState {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Chapter Card workflow state.");
  const input = value as Record<string, unknown>;
  if (input.formatVersion !== CHAPTER_CARD_WORKFLOW_FORMAT_VERSION) throw new Error("Unsupported Chapter Card workflow format.");
  if (!Array.isArray(input.candidates)) throw new Error("Invalid Chapter Card candidate collection.");
  if (!Array.isArray(input.approvals)) throw new Error("Invalid Chapter Card approval collection.");

  const candidateIds = new Set<string>();
  const candidates = input.candidates.map((item) => {
    const candidate = validateChapterCardCandidateSet(item);
    if (candidateIds.has(candidate.id)) throw new Error(`Duplicate Chapter Card candidate id "${candidate.id}".`);
    candidateIds.add(candidate.id);
    return candidate;
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));

  const approvalIds = new Set<string>();
  const approvals = input.approvals.map((item) => {
    const approval = validateChapterCardApproval(item);
    if (approvalIds.has(approval.chapterId)) throw new Error(`Duplicate Chapter Card approval for chapter "${approval.chapterId}".`);
    approvalIds.add(approval.chapterId);
    return approval;
  }).sort((a, b) => a.chapterId.localeCompare(b.chapterId));

  return { formatVersion: CHAPTER_CARD_WORKFLOW_FORMAT_VERSION, candidates, approvals };
}

export function createChapterCardCandidateSet(input: {
  id: string;
  projectId: string;
  bookId: string;
  description: string;
  events?: readonly string[];
  timelineDetails?: readonly string[];
  targetChapters: number;
  chapters: readonly ChapterCardCandidateChapter[];
  provider: string;
  model: string;
  now?: string;
}): ChapterCardCandidateSet {
  const now = timestamp(input.now ?? new Date().toISOString(), "Chapter Card candidate timestamp");
  return validateChapterCardCandidateSet({
    id: input.id,
    projectId: input.projectId,
    bookId: input.bookId,
    description: input.description,
    events: input.events ?? [],
    timelineDetails: input.timelineDetails ?? [],
    targetChapters: input.targetChapters,
    chapters: input.chapters,
    status: "pending",
    provider: input.provider,
    model: input.model,
    createdAt: now,
    updatedAt: now,
  });
}

export function upsertChapterCardCandidate(state: ChapterCardWorkflowState, candidate: ChapterCardCandidateSet): ChapterCardWorkflowState {
  const current = validateChapterCardWorkflowState(state);
  const value = validateChapterCardCandidateSet(candidate);
  const candidates = current.candidates.some((item) => item.id === value.id)
    ? current.candidates.map((item) => item.id === value.id ? value : item)
    : [value, ...current.candidates];
  return validateChapterCardWorkflowState({ ...current, candidates });
}

export function reviewChapterCardCandidate(
  state: ChapterCardWorkflowState,
  candidateId: string,
  decision: Exclude<ChapterCardCandidateStatus, "pending">,
  now = new Date().toISOString(),
): ChapterCardWorkflowState {
  const current = validateChapterCardWorkflowState(state);
  const id = identifier(candidateId, "Chapter Card candidate id");
  const reviewedAt = timestamp(now, "Chapter Card candidate review timestamp");
  const candidate = current.candidates.find((item) => item.id === id);
  if (!candidate) throw new Error(`Chapter Card candidate "${id}" not found.`);
  if (candidate.status !== "pending") throw new Error(`Chapter Card candidate "${id}" has already been ${candidate.status}.`);
  const updated: ChapterCardCandidateSet = { ...candidate, status: decision, updatedAt: reviewedAt, reviewedAt };
  return upsertChapterCardCandidate(current, updated);
}

export function approveChapterCard(
  state: ChapterCardWorkflowState,
  chapterId: string,
  card: StoryMapChapterCard,
  input: { now?: string; sourceCandidateId?: string } = {},
): ChapterCardWorkflowState {
  const current = validateChapterCardWorkflowState(state);
  const id = identifier(chapterId, "Chapter Card approval chapter id");
  const approvedAt = timestamp(input.now ?? new Date().toISOString(), "Chapter Card approval timestamp");
  const sourceCandidateId = input.sourceCandidateId === undefined ? undefined : identifier(input.sourceCandidateId, "Chapter Card source candidate id");
  if (sourceCandidateId && !current.candidates.some((item) => item.id === sourceCandidateId)) throw new Error(`Chapter Card source candidate "${sourceCandidateId}" not found.`);
  const approval: ChapterCardApproval = {
    chapterId: id,
    cardSha256: chapterCardSha256(card),
    approvedAt,
    approvedBy: "author",
    ...(sourceCandidateId ? { sourceCandidateId } : {}),
  };
  const approvals = current.approvals.some((item) => item.chapterId === id)
    ? current.approvals.map((item) => item.chapterId === id ? approval : item)
    : [...current.approvals, approval];
  return validateChapterCardWorkflowState({ ...current, approvals });
}

export function revokeChapterCardApproval(state: ChapterCardWorkflowState, chapterId: string): ChapterCardWorkflowState {
  const current = validateChapterCardWorkflowState(state);
  const id = identifier(chapterId, "Chapter Card approval chapter id");
  return validateChapterCardWorkflowState({ ...current, approvals: current.approvals.filter((item) => item.chapterId !== id) });
}

export function chapterCardApprovalFor(
  state: ChapterCardWorkflowState | undefined,
  chapterId: string,
  card: StoryMapChapterCard,
): ChapterCardApproval | undefined {
  if (!state) return undefined;
  const current = validateChapterCardWorkflowState(state);
  const id = identifier(chapterId, "Chapter Card approval chapter id");
  const approval = current.approvals.find((item) => item.chapterId === id);
  return approval && approval.cardSha256 === chapterCardSha256(card) ? approval : undefined;
}

export function chapterCardSha256(card: StoryMapChapterCard): string {
  const normalized = validateStoryMapChapterCard(card);
  return createHash("sha256").update(JSON.stringify(normalized), "utf8").digest("hex");
}

export function validateChapterCardCandidateSet(value: unknown): ChapterCardCandidateSet {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Chapter Card candidate set.");
  const input = value as Record<string, unknown>;
  const id = identifier(input.id, "Chapter Card candidate id");
  const projectId = identifier(input.projectId, "Chapter Card candidate project id");
  const bookId = identifier(input.bookId, "Chapter Card candidate book id");
  const description = requiredText(input.description, "Chapter Card candidate description", 32_000);
  const events = stringList(input.events, "Chapter Card candidate event", 100, 2_000);
  const timelineDetails = stringList(input.timelineDetails, "Chapter Card candidate timeline detail", 100, 2_000);
  const targetChapters = positiveInteger(input.targetChapters, "Chapter Card target chapters", 500);
  if (!Array.isArray(input.chapters) || input.chapters.length === 0) throw new Error("Chapter Card candidate requires at least one chapter.");
  if (input.chapters.length > 500) throw new Error("Chapter Card candidate exceeds 500 chapters.");
  const chapterNumbers = new Set<number>();
  const chapters = input.chapters.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Invalid Chapter Card candidate chapter.");
    const chapter = item as Record<string, unknown>;
    const number = positiveInteger(chapter.number, "Chapter Card candidate chapter number", 500);
    if (chapterNumbers.has(number)) throw new Error(`Duplicate Chapter Card candidate chapter number ${number}.`);
    chapterNumbers.add(number);
    return {
      number,
      title: requiredText(chapter.title, "Chapter Card candidate chapter title", 500),
      card: validateStoryMapChapterCard(chapter.card),
    };
  }).sort((a, b) => a.number - b.number);
  if (chapters.length !== targetChapters) throw new Error(`Chapter Card candidate expected ${targetChapters} chapters but contains ${chapters.length}.`);
  const status = candidateStatus(input.status);
  const provider = requiredText(input.provider, "Chapter Card candidate provider", 200);
  const model = requiredText(input.model, "Chapter Card candidate model", 300);
  const createdAt = timestamp(input.createdAt, "Chapter Card candidate created timestamp");
  const updatedAt = timestamp(input.updatedAt, "Chapter Card candidate updated timestamp");
  if (Date.parse(updatedAt) < Date.parse(createdAt)) throw new Error("Chapter Card candidate updatedAt cannot precede createdAt.");
  const reviewedAt = input.reviewedAt === undefined ? undefined : timestamp(input.reviewedAt, "Chapter Card candidate reviewed timestamp");
  if (status === "pending" && reviewedAt !== undefined) throw new Error("Pending Chapter Card candidate cannot have a reviewed timestamp.");
  if (status !== "pending" && reviewedAt === undefined) throw new Error(`Chapter Card candidate status "${status}" requires a reviewed timestamp.`);
  return { id, projectId, bookId, description, events, timelineDetails, targetChapters, chapters, status, provider, model, createdAt, updatedAt, ...(reviewedAt ? { reviewedAt } : {}) };
}

export function validateChapterCardApproval(value: unknown): ChapterCardApproval {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Chapter Card approval.");
  const input = value as Record<string, unknown>;
  const chapterId = identifier(input.chapterId, "Chapter Card approval chapter id");
  if (typeof input.cardSha256 !== "string" || !/^[a-f0-9]{64}$/.test(input.cardSha256)) throw new Error("Invalid Chapter Card approval hash.");
  const approvedAt = timestamp(input.approvedAt, "Chapter Card approval timestamp");
  if (input.approvedBy !== "author") throw new Error("Chapter Card approval must be attributable to the author.");
  const sourceCandidateId = input.sourceCandidateId === undefined ? undefined : identifier(input.sourceCandidateId, "Chapter Card source candidate id");
  return { chapterId, cardSha256: input.cardSha256, approvedAt, approvedBy: "author", ...(sourceCandidateId ? { sourceCandidateId } : {}) };
}

function candidateStatus(value: unknown): ChapterCardCandidateStatus {
  if (typeof value !== "string" || !CHAPTER_CARD_CANDIDATE_STATUSES.includes(value as ChapterCardCandidateStatus)) throw new Error("Invalid Chapter Card candidate status.");
  return value as ChapterCardCandidateStatus;
}
function identifier(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim() || value !== value.trim() || value.length > 300 || /[\r\n]/u.test(value)) throw new Error(`${label} is invalid.`);
  return value;
}
function requiredText(value: unknown, label: string, max: number): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  const result = value.trim();
  if (result.length > max) throw new Error(`${label} exceeds ${max} characters.`);
  return result;
}
function stringList(value: unknown, label: string, maxItems: number, maxLength: number): readonly string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${label} collection is invalid.`);
  if (value.length > maxItems) throw new Error(`${label} collection exceeds ${maxItems} items.`);
  const result = value.map((item) => requiredText(item, label, maxLength));
  if (new Set(result).size !== result.length) throw new Error(`${label} collection contains duplicates.`);
  return result;
}
function positiveInteger(value: unknown, label: string, max: number): number {
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > max) throw new Error(`${label} must be an integer from 1 through ${max}.`);
  return Number(value);
}
function timestamp(value: unknown, label: string): string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new Error(`${label} is invalid.`);
  return new Date(value).toISOString();
}

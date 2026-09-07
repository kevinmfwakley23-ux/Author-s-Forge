import type { JournalPrompt } from "./guided-journal";
import {
  promptPackFingerprint,
  resolvePromptPackOrder,
  validateGuidedJournalPromptPack,
  type GuidedJournalPromptPack,
} from "./guided-journal-packs";

export const GUIDED_JOURNAL_JOURNEY_FORMAT_VERSION = 1 as const;

export interface GuidedJournalJourneyProgress {
  readonly formatVersion: typeof GUIDED_JOURNAL_JOURNEY_FORMAT_VERSION;
  readonly id: string;
  readonly projectId: string;
  readonly journalId?: string;
  readonly packId: string;
  readonly packVersion: number;
  readonly packFingerprint: string;
  readonly seed: string;
  readonly promptOrder: readonly string[];
  readonly completedPromptIds: readonly string[];
  readonly hiddenPromptIds: readonly string[];
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly completedAt?: string;
}

export interface StartGuidedJournalJourneyRequest {
  readonly id: string;
  readonly projectId: string;
  readonly journalId?: string;
  readonly pack: GuidedJournalPromptPack;
  readonly seed?: string;
  readonly now?: string;
}

export interface GuidedJournalJourneyStatus {
  readonly totalPrompts: number;
  readonly visiblePrompts: number;
  readonly completedPrompts: number;
  readonly hiddenPrompts: number;
  readonly remainingPrompts: number;
  readonly progressPercent: number;
  readonly complete: boolean;
}

export function startGuidedJournalJourney(request: StartGuidedJournalJourneyRequest): GuidedJournalJourneyProgress {
  validateGuidedJournalPromptPack(request.pack);
  const now = timestamp(request.now);
  const seed = request.seed?.trim() || `${request.pack.id}:v${request.pack.version}`;
  const order = resolvePromptPackOrder(request.pack, seed);
  if (new Set(order).size !== order.length) throw new Error("Guided journey prompt order contains duplicate prompt ids.");

  return Object.freeze({
    formatVersion: GUIDED_JOURNAL_JOURNEY_FORMAT_VERSION,
    id: required(request.id, "Journey id"),
    projectId: required(request.projectId, "Project id"),
    ...(request.journalId?.trim() ? { journalId: request.journalId.trim() } : {}),
    packId: request.pack.id,
    packVersion: request.pack.version,
    packFingerprint: request.pack.sourceLibraryFingerprint,
    seed,
    promptOrder: Object.freeze([...order]),
    completedPromptIds: Object.freeze([]),
    hiddenPromptIds: Object.freeze([]),
    startedAt: now,
    updatedAt: now,
  });
}

export function completeGuidedJournalJourneyPrompt(
  progress: GuidedJournalJourneyProgress,
  pack: GuidedJournalPromptPack,
  promptId: string,
  now?: string,
): GuidedJournalJourneyProgress {
  validateProgressAgainstPack(progress, pack);
  const id = required(promptId, "Prompt id");
  requireInOrder(progress, id);
  if (progress.hiddenPromptIds.includes(id)) throw new Error(`Cannot complete hidden journey prompt "${id}".`);
  if (progress.completedPromptIds.includes(id)) return progress;

  const completed = [...progress.completedPromptIds, id];
  return finalize({ ...progress, completedPromptIds: completed }, now);
}

export function reopenGuidedJournalJourneyPrompt(
  progress: GuidedJournalJourneyProgress,
  pack: GuidedJournalPromptPack,
  promptId: string,
  now?: string,
): GuidedJournalJourneyProgress {
  validateProgressAgainstPack(progress, pack);
  const id = required(promptId, "Prompt id");
  requireInOrder(progress, id);
  if (!progress.completedPromptIds.includes(id)) return progress;
  return finalize({ ...progress, completedPromptIds: progress.completedPromptIds.filter((candidate) => candidate !== id), completedAt: undefined }, now);
}

export function hideGuidedJournalJourneyPrompt(
  progress: GuidedJournalJourneyProgress,
  pack: GuidedJournalPromptPack,
  promptId: string,
  now?: string,
): GuidedJournalJourneyProgress {
  validateProgressAgainstPack(progress, pack);
  const id = required(promptId, "Prompt id");
  requireInOrder(progress, id);
  if (progress.completedPromptIds.includes(id)) throw new Error(`Cannot hide completed journey prompt "${id}". Reopen it first.`);
  if (progress.hiddenPromptIds.includes(id)) return progress;
  return finalize({ ...progress, hiddenPromptIds: [...progress.hiddenPromptIds, id] }, now);
}

export function unhideGuidedJournalJourneyPrompt(
  progress: GuidedJournalJourneyProgress,
  pack: GuidedJournalPromptPack,
  promptId: string,
  now?: string,
): GuidedJournalJourneyProgress {
  validateProgressAgainstPack(progress, pack);
  const id = required(promptId, "Prompt id");
  requireInOrder(progress, id);
  if (!progress.hiddenPromptIds.includes(id)) return progress;
  return finalize({ ...progress, hiddenPromptIds: progress.hiddenPromptIds.filter((candidate) => candidate !== id), completedAt: undefined }, now);
}

export function nextGuidedJournalJourneyPrompt(
  progress: GuidedJournalJourneyProgress,
  pack: GuidedJournalPromptPack,
): JournalPrompt | undefined {
  validateProgressAgainstPack(progress, pack);
  const completed = new Set(progress.completedPromptIds);
  const hidden = new Set(progress.hiddenPromptIds);
  const nextId = progress.promptOrder.find((id) => !completed.has(id) && !hidden.has(id));
  if (!nextId) return undefined;
  const prompt = pack.prompts.find((candidate) => candidate.id === nextId);
  if (!prompt) throw new Error(`Pinned prompt pack is missing journey prompt "${nextId}".`);
  return Object.freeze({ ...prompt, tags: Object.freeze([...prompt.tags]) });
}

export function guidedJournalJourneyStatus(progress: GuidedJournalJourneyProgress): GuidedJournalJourneyStatus {
  validateGuidedJournalJourneyProgress(progress);
  const totalPrompts = progress.promptOrder.length;
  const hiddenPrompts = progress.hiddenPromptIds.length;
  const visiblePrompts = Math.max(0, totalPrompts - hiddenPrompts);
  const completedPrompts = progress.completedPromptIds.filter((id) => !progress.hiddenPromptIds.includes(id)).length;
  const remainingPrompts = Math.max(0, visiblePrompts - completedPrompts);
  const complete = remainingPrompts === 0;
  const progressPercent = visiblePrompts === 0 ? 100 : Number(((completedPrompts / visiblePrompts) * 100).toFixed(2));
  return Object.freeze({ totalPrompts, visiblePrompts, completedPrompts, hiddenPrompts, remainingPrompts, progressPercent, complete });
}

export function validateProgressAgainstPack(progress: GuidedJournalJourneyProgress, pack: GuidedJournalPromptPack): void {
  validateGuidedJournalJourneyProgress(progress);
  validateGuidedJournalPromptPack(pack);
  if (progress.packId !== pack.id || progress.packVersion !== pack.version) throw new Error("Journey is pinned to a different prompt pack version.");
  if (progress.packFingerprint !== pack.sourceLibraryFingerprint) throw new Error("Journey prompt pack fingerprint mismatch.");
  if (promptPackFingerprint(pack.prompts) !== progress.packFingerprint) throw new Error("Pinned journey pack snapshot is corrupt.");
  const ids = new Set(pack.prompts.map((prompt) => prompt.id));
  for (const id of progress.promptOrder) if (!ids.has(id)) throw new Error(`Journey order references missing prompt "${id}".`);
}

export function validateGuidedJournalJourneyProgress(progress: GuidedJournalJourneyProgress): void {
  if (progress.formatVersion !== GUIDED_JOURNAL_JOURNEY_FORMAT_VERSION) throw new Error("Unsupported Guided Journal journey progress version.");
  required(progress.id, "Journey id");
  required(progress.projectId, "Project id");
  required(progress.packId, "Prompt pack id");
  positiveInteger(progress.packVersion, "Prompt pack version");
  required(progress.packFingerprint, "Prompt pack fingerprint");
  required(progress.seed, "Journey seed");
  timestamp(progress.startedAt);
  timestamp(progress.updatedAt);
  if (progress.completedAt) timestamp(progress.completedAt);
  if (!Array.isArray(progress.promptOrder) || !progress.promptOrder.length) throw new Error("Journey prompt order cannot be empty.");
  if (new Set(progress.promptOrder).size !== progress.promptOrder.length) throw new Error("Journey prompt order cannot contain duplicates.");
  validateSubset(progress.promptOrder, progress.completedPromptIds, "completed prompt ids");
  validateSubset(progress.promptOrder, progress.hiddenPromptIds, "hidden prompt ids");
  const overlap = progress.completedPromptIds.filter((id) => progress.hiddenPromptIds.includes(id));
  if (overlap.length) throw new Error(`Journey prompt cannot be both completed and hidden: ${overlap[0]}.`);
}

function finalize(input: GuidedJournalJourneyProgress, now?: string): GuidedJournalJourneyProgress {
  const updatedAt = timestamp(now);
  const provisional: GuidedJournalJourneyProgress = {
    ...input,
    updatedAt,
    promptOrder: Object.freeze([...input.promptOrder]),
    completedPromptIds: Object.freeze([...input.completedPromptIds]),
    hiddenPromptIds: Object.freeze([...input.hiddenPromptIds]),
  };
  const status = guidedJournalJourneyStatus(provisional);
  const result: GuidedJournalJourneyProgress = Object.freeze({
    ...provisional,
    ...(status.complete ? { completedAt: provisional.completedAt ?? updatedAt } : {}),
    ...(!status.complete && provisional.completedAt ? { completedAt: undefined } : {}),
  });
  validateGuidedJournalJourneyProgress(result);
  return result;
}

function requireInOrder(progress: GuidedJournalJourneyProgress, id: string): void {
  if (!progress.promptOrder.includes(id)) throw new Error(`Journey does not contain prompt "${id}".`);
}

function validateSubset(order: readonly string[], values: readonly string[], label: string): void {
  if (!Array.isArray(values)) throw new Error(`Journey ${label} must be an array.`);
  if (new Set(values).size !== values.length) throw new Error(`Journey ${label} cannot contain duplicates.`);
  const allowed = new Set(order);
  for (const id of values) if (!allowed.has(id)) throw new Error(`Journey ${label} references missing prompt "${id}".`);
}

function required(value: string, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function positiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${label} must be a positive integer.`);
}

function timestamp(value = new Date().toISOString()): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Timestamp must be valid ISO date/time.");
  return date.toISOString();
}

import { createHash } from "node:crypto";
import { validateStoryMapSceneAttributes, type StoryMapSceneAttributes } from "./story-map-planning";

export const SCENE_CARD_WORKFLOW_FORMAT_VERSION = 1 as const;

export interface SceneCardDetails {
  readonly purpose: string;
  readonly openingSituation: string;
  readonly closingSituation: string;
  readonly characterIds: readonly string[];
  readonly requiredEvents: readonly string[];
  readonly clues: readonly string[];
  readonly reveals: readonly string[];
  readonly continuityDependencies: readonly string[];
  readonly atmosphere: string;
  readonly approximateWordCount: number;
  readonly forbiddenDeviations: readonly string[];
  readonly notes: string;
}

export interface SceneCardSnapshot {
  readonly bookId: string;
  readonly chapterId: string;
  readonly sceneId: string;
  readonly sceneNumber: number;
  readonly sceneTitle: string;
  readonly sceneSynopsis: string;
  readonly attributes: StoryMapSceneAttributes;
  readonly plotlineIds: readonly string[];
  readonly details: SceneCardDetails;
}

export interface SceneCardApproval {
  readonly sceneId: string;
  readonly cardSha256: string;
  readonly approvedAt: string;
  readonly approvedBy: "author";
}

export interface SceneCardWorkflowState {
  readonly formatVersion: typeof SCENE_CARD_WORKFLOW_FORMAT_VERSION;
  readonly cards: Readonly<Record<string, SceneCardDetails>>;
  readonly approvals: readonly SceneCardApproval[];
}

export function createSceneCardWorkflowState(): SceneCardWorkflowState {
  return { formatVersion: SCENE_CARD_WORKFLOW_FORMAT_VERSION, cards: {}, approvals: [] };
}

export function createSceneCardDetails(input: Partial<SceneCardDetails> = {}): SceneCardDetails {
  return validateSceneCardDetails({
    purpose: input.purpose ?? "",
    openingSituation: input.openingSituation ?? "",
    closingSituation: input.closingSituation ?? "",
    characterIds: input.characterIds ?? [],
    requiredEvents: input.requiredEvents ?? [],
    clues: input.clues ?? [],
    reveals: input.reveals ?? [],
    continuityDependencies: input.continuityDependencies ?? [],
    atmosphere: input.atmosphere ?? "",
    approximateWordCount: input.approximateWordCount ?? 0,
    forbiddenDeviations: input.forbiddenDeviations ?? [],
    notes: input.notes ?? "",
  });
}

export function validateSceneCardWorkflowState(value: unknown): SceneCardWorkflowState {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Scene Card workflow state.");
  const input = value as Record<string, unknown>;
  if (input.formatVersion !== SCENE_CARD_WORKFLOW_FORMAT_VERSION) throw new Error("Unsupported Scene Card workflow format.");
  if (!input.cards || typeof input.cards !== "object" || Array.isArray(input.cards)) throw new Error("Invalid Scene Card collection.");
  if (!Array.isArray(input.approvals)) throw new Error("Invalid Scene Card approval collection.");

  const cards: Record<string, SceneCardDetails> = {};
  for (const [sceneId, details] of Object.entries(input.cards as Record<string, unknown>)) {
    cards[identifier(sceneId, "Scene Card scene id")] = validateSceneCardDetails(details);
  }

  const ids = new Set<string>();
  const approvals = input.approvals.map((item) => {
    const approval = validateSceneCardApproval(item);
    if (ids.has(approval.sceneId)) throw new Error(`Duplicate Scene Card approval for scene "${approval.sceneId}".`);
    ids.add(approval.sceneId);
    return approval;
  }).sort((a, b) => a.sceneId.localeCompare(b.sceneId));

  return { formatVersion: SCENE_CARD_WORKFLOW_FORMAT_VERSION, cards, approvals };
}

export function setSceneCardDetails(state: SceneCardWorkflowState, sceneId: string, details: SceneCardDetails): SceneCardWorkflowState {
  const current = validateSceneCardWorkflowState(state);
  const id = identifier(sceneId, "Scene Card scene id");
  const value = validateSceneCardDetails(details);
  return validateSceneCardWorkflowState({ ...current, cards: { ...current.cards, [id]: value } });
}

export function removeSceneCardDetails(state: SceneCardWorkflowState, sceneId: string): SceneCardWorkflowState {
  const current = validateSceneCardWorkflowState(state);
  const id = identifier(sceneId, "Scene Card scene id");
  const cards = { ...current.cards };
  delete cards[id];
  return validateSceneCardWorkflowState({
    ...current,
    cards,
    approvals: current.approvals.filter((item) => item.sceneId !== id),
  });
}

export function approveSceneCard(
  state: SceneCardWorkflowState,
  snapshot: SceneCardSnapshot,
  now = new Date().toISOString(),
): SceneCardWorkflowState {
  const current = validateSceneCardWorkflowState(state);
  const card = validateSceneCardSnapshot(snapshot);
  const approval: SceneCardApproval = {
    sceneId: card.sceneId,
    cardSha256: sceneCardSha256(card),
    approvedAt: timestamp(now, "Scene Card approval timestamp"),
    approvedBy: "author",
  };
  const approvals = current.approvals.some((item) => item.sceneId === card.sceneId)
    ? current.approvals.map((item) => item.sceneId === card.sceneId ? approval : item)
    : [...current.approvals, approval];
  return validateSceneCardWorkflowState({ ...current, approvals });
}

export function revokeSceneCardApproval(state: SceneCardWorkflowState, sceneId: string): SceneCardWorkflowState {
  const current = validateSceneCardWorkflowState(state);
  const id = identifier(sceneId, "Scene Card scene id");
  return validateSceneCardWorkflowState({ ...current, approvals: current.approvals.filter((item) => item.sceneId !== id) });
}

export function sceneCardApprovalFor(
  state: SceneCardWorkflowState | undefined,
  snapshot: SceneCardSnapshot,
): SceneCardApproval | undefined {
  if (!state) return undefined;
  const current = validateSceneCardWorkflowState(state);
  const card = validateSceneCardSnapshot(snapshot);
  const approval = current.approvals.find((item) => item.sceneId === card.sceneId);
  return approval && approval.cardSha256 === sceneCardSha256(card) ? approval : undefined;
}

export function sceneCardSha256(snapshot: SceneCardSnapshot): string {
  return createHash("sha256").update(JSON.stringify(validateSceneCardSnapshot(snapshot)), "utf8").digest("hex");
}

export function validateSceneCardDetails(value: unknown): SceneCardDetails {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Scene Card details.");
  const input = value as Partial<SceneCardDetails>;
  return {
    purpose: optionalText(input.purpose, "Scene Card purpose", 4000),
    openingSituation: optionalText(input.openingSituation, "Scene Card opening situation", 4000),
    closingSituation: optionalText(input.closingSituation, "Scene Card closing situation", 4000),
    characterIds: uniqueIds(input.characterIds ?? [], "Scene Card character id", 100),
    requiredEvents: uniqueText(input.requiredEvents ?? [], "Scene Card required event", 1000, 60),
    clues: uniqueText(input.clues ?? [], "Scene Card clue", 1000, 60),
    reveals: uniqueText(input.reveals ?? [], "Scene Card reveal", 1000, 60),
    continuityDependencies: uniqueText(input.continuityDependencies ?? [], "Scene Card continuity dependency", 1000, 60),
    atmosphere: optionalText(input.atmosphere, "Scene Card atmosphere", 3000),
    approximateWordCount: nonNegativeInteger(input.approximateWordCount ?? 0, "Scene Card approximate word count", 100_000),
    forbiddenDeviations: uniqueText(input.forbiddenDeviations ?? [], "Scene Card forbidden deviation", 1000, 60),
    notes: optionalText(input.notes, "Scene Card notes", 8000),
  };
}

export function validateSceneCardSnapshot(value: unknown): SceneCardSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Scene Card snapshot.");
  const input = value as SceneCardSnapshot;
  return {
    bookId: identifier(input.bookId, "Scene Card book id"),
    chapterId: identifier(input.chapterId, "Scene Card chapter id"),
    sceneId: identifier(input.sceneId, "Scene Card scene id"),
    sceneNumber: positiveInteger(input.sceneNumber, "Scene Card scene number", 100_000),
    sceneTitle: requiredText(input.sceneTitle, "Scene Card scene title", 500),
    sceneSynopsis: optionalText(input.sceneSynopsis, "Scene Card scene synopsis", 10_000),
    attributes: validateStoryMapSceneAttributes(input.attributes),
    plotlineIds: uniqueIds(input.plotlineIds, "Scene Card plotline id", 200),
    details: validateSceneCardDetails(input.details),
  };
}

export function validateSceneCardApproval(value: unknown): SceneCardApproval {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Scene Card approval.");
  const input = value as Record<string, unknown>;
  const sceneId = identifier(input.sceneId, "Scene Card approval scene id");
  if (typeof input.cardSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(input.cardSha256)) throw new Error("Invalid Scene Card approval hash.");
  const approvedAt = timestamp(input.approvedAt, "Scene Card approval timestamp");
  if (input.approvedBy !== "author") throw new Error("Scene Card approval must be attributable to the author.");
  return { sceneId, cardSha256: input.cardSha256, approvedAt, approvedBy: "author" };
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
function optionalText(value: unknown, label: string, max: number): string {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") throw new Error(`${label} must be text.`);
  const result = value.trim();
  if (result.length > max) throw new Error(`${label} exceeds ${max} characters.`);
  return result;
}
function uniqueIds(value: unknown, label: string, maxItems: number): readonly string[] {
  if (!Array.isArray(value)) throw new Error(`${label} collection is invalid.`);
  if (value.length > maxItems) throw new Error(`${label} collection exceeds ${maxItems} items.`);
  return [...new Set(value.map((item) => identifier(item, label)))];
}
function uniqueText(value: unknown, label: string, maxLength: number, maxItems: number): readonly string[] {
  if (!Array.isArray(value)) throw new Error(`${label} collection is invalid.`);
  if (value.length > maxItems) throw new Error(`${label} collection exceeds ${maxItems} items.`);
  const result = value.map((item) => requiredText(item, label, maxLength));
  return [...new Set(result)];
}
function nonNegativeInteger(value: unknown, label: string, max: number): number {
  if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > max) throw new Error(`${label} must be an integer from 0 through ${max}.`);
  return Number(value);
}
function positiveInteger(value: unknown, label: string, max: number): number {
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > max) throw new Error(`${label} must be an integer from 1 through ${max}.`);
  return Number(value);
}
function timestamp(value: unknown, label: string): string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new Error(`${label} is invalid.`);
  return new Date(value).toISOString();
}

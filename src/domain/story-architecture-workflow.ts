import { createHash } from "node:crypto";

export const STORY_ARCHITECTURE_WORKFLOW_FORMAT_VERSION = 1 as const;

export interface StoryArchitectureChapterBeat {
  readonly number: number;
  readonly title: string;
  readonly summary: string;
  readonly requiredEvents: readonly string[];
  readonly continuityDependencies: readonly string[];
}

export interface StoryArchitectureSceneBeat {
  readonly chapterNumber: number;
  readonly title: string;
  readonly summary: string;
  readonly goal: string;
  readonly conflict: string;
  readonly outcome: string;
}

export interface StoryArchitecturePlan {
  readonly premise: string;
  readonly themes: readonly string[];
  readonly audience: string;
  readonly genreExpectations: readonly string[];
  readonly canonCandidates: readonly string[];
  readonly characterCandidates: readonly string[];
  readonly locations: readonly string[];
  readonly timelineConsiderations: readonly string[];
  readonly assumptions: readonly string[];
  readonly chapterPlan: readonly StoryArchitectureChapterBeat[];
  readonly scenePlan: readonly StoryArchitectureSceneBeat[];
  readonly unresolvedQuestions: readonly string[];
  readonly productionRisks: readonly string[];
}

export interface StoryArchitectureCandidate {
  readonly id: string;
  readonly projectId: string;
  readonly idea: string;
  readonly kind: string;
  readonly targetChapters?: number;
  readonly plan: StoryArchitecturePlan;
  readonly provider: string;
  readonly model: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface StoryArchitectureApproval {
  readonly candidateId: string;
  readonly planSha256: string;
  readonly approvedAt: string;
  readonly approvedBy: "author";
}

export interface StoryArchitectureWorkflowState {
  readonly formatVersion: typeof STORY_ARCHITECTURE_WORKFLOW_FORMAT_VERSION;
  readonly candidates: readonly StoryArchitectureCandidate[];
  readonly approvals: readonly StoryArchitectureApproval[];
}

export function createStoryArchitectureWorkflowState(): StoryArchitectureWorkflowState {
  return { formatVersion: STORY_ARCHITECTURE_WORKFLOW_FORMAT_VERSION, candidates: [], approvals: [] };
}

export function validateStoryArchitectureWorkflowState(value: unknown): StoryArchitectureWorkflowState {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Story Architecture workflow state.");
  const input = value as Record<string, unknown>;
  if (input.formatVersion !== STORY_ARCHITECTURE_WORKFLOW_FORMAT_VERSION) throw new Error("Unsupported Story Architecture workflow format.");
  if (!Array.isArray(input.candidates) || !Array.isArray(input.approvals)) throw new Error("Invalid Story Architecture workflow collections.");
  const candidateIds = new Set<string>();
  const candidates = input.candidates.map((raw) => {
    const candidate = validateStoryArchitectureCandidate(raw);
    if (candidateIds.has(candidate.id)) throw new Error(`Duplicate Story Architecture candidate id "${candidate.id}".`);
    candidateIds.add(candidate.id);
    return candidate;
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  const approvalIds = new Set<string>();
  const approvals = input.approvals.map((raw) => {
    const approval = validateStoryArchitectureApproval(raw);
    if (!candidateIds.has(approval.candidateId)) throw new Error(`Story Architecture approval references missing candidate "${approval.candidateId}".`);
    if (approvalIds.has(approval.candidateId)) throw new Error(`Duplicate Story Architecture approval for candidate "${approval.candidateId}".`);
    approvalIds.add(approval.candidateId);
    return approval;
  }).sort((a, b) => b.approvedAt.localeCompare(a.approvedAt));
  return { formatVersion: STORY_ARCHITECTURE_WORKFLOW_FORMAT_VERSION, candidates, approvals };
}

export function createStoryArchitectureCandidate(input: Omit<StoryArchitectureCandidate, "createdAt" | "updatedAt"> & { now?: string }): StoryArchitectureCandidate {
  const now = timestamp(input.now ?? new Date().toISOString(), "Story Architecture candidate timestamp");
  return validateStoryArchitectureCandidate({ ...input, createdAt: now, updatedAt: now });
}

export function upsertStoryArchitectureCandidate(state: StoryArchitectureWorkflowState, candidate: StoryArchitectureCandidate): StoryArchitectureWorkflowState {
  const current = validateStoryArchitectureWorkflowState(state);
  const value = validateStoryArchitectureCandidate(candidate);
  const candidates = current.candidates.some((item) => item.id === value.id)
    ? current.candidates.map((item) => item.id === value.id ? value : item)
    : [value, ...current.candidates];
  return validateStoryArchitectureWorkflowState({ ...current, candidates });
}

export function updateStoryArchitectureCandidatePlan(state: StoryArchitectureWorkflowState, candidateId: string, plan: StoryArchitecturePlan, now = new Date().toISOString()): StoryArchitectureWorkflowState {
  const current = validateStoryArchitectureWorkflowState(state);
  const id = identifier(candidateId, "Story Architecture candidate id");
  const candidate = current.candidates.find((item) => item.id === id);
  if (!candidate) throw new Error(`Story Architecture candidate "${id}" not found.`);
  const updated: StoryArchitectureCandidate = { ...candidate, plan: validateStoryArchitecturePlan(plan), updatedAt: timestamp(now, "Story Architecture updated timestamp") };
  return upsertStoryArchitectureCandidate(current, updated);
}

export function approveStoryArchitectureCandidate(state: StoryArchitectureWorkflowState, candidateId: string, now = new Date().toISOString()): StoryArchitectureWorkflowState {
  const current = validateStoryArchitectureWorkflowState(state);
  const id = identifier(candidateId, "Story Architecture candidate id");
  const candidate = current.candidates.find((item) => item.id === id);
  if (!candidate) throw new Error(`Story Architecture candidate "${id}" not found.`);
  const approval: StoryArchitectureApproval = {
    candidateId: id,
    planSha256: storyArchitecturePlanSha256(candidate.plan),
    approvedAt: timestamp(now, "Story Architecture approval timestamp"),
    approvedBy: "author",
  };
  const approvals = current.approvals.some((item) => item.candidateId === id)
    ? current.approvals.map((item) => item.candidateId === id ? approval : item)
    : [approval, ...current.approvals];
  return validateStoryArchitectureWorkflowState({ ...current, approvals });
}

export function revokeStoryArchitectureApproval(state: StoryArchitectureWorkflowState, candidateId: string): StoryArchitectureWorkflowState {
  const current = validateStoryArchitectureWorkflowState(state);
  const id = identifier(candidateId, "Story Architecture candidate id");
  if (!current.candidates.some((item) => item.id === id)) throw new Error(`Story Architecture candidate "${id}" not found.`);
  if (!current.approvals.some((item) => item.candidateId === id)) throw new Error(`Story Architecture candidate "${id}" has no approval to revoke.`);
  return validateStoryArchitectureWorkflowState({ ...current, approvals: current.approvals.filter((item) => item.candidateId !== id) });
}

export function storyArchitectureApprovalFor(state: StoryArchitectureWorkflowState | undefined, candidate: StoryArchitectureCandidate): StoryArchitectureApproval | undefined {
  if (!state) return undefined;
  const current = validateStoryArchitectureWorkflowState(state);
  const value = validateStoryArchitectureCandidate(candidate);
  const approval = current.approvals.find((item) => item.candidateId === value.id);
  return approval && approval.planSha256 === storyArchitecturePlanSha256(value.plan) ? approval : undefined;
}

export function storyArchitecturePlanSha256(plan: StoryArchitecturePlan): string {
  return createHash("sha256").update(JSON.stringify(validateStoryArchitecturePlan(plan)), "utf8").digest("hex");
}

export function validateStoryArchitectureCandidate(value: unknown): StoryArchitectureCandidate {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Story Architecture candidate.");
  const input = value as Record<string, unknown>;
  const createdAt = timestamp(input.createdAt, "Story Architecture created timestamp");
  const updatedAt = timestamp(input.updatedAt, "Story Architecture updated timestamp");
  if (Date.parse(updatedAt) < Date.parse(createdAt)) throw new Error("Story Architecture updatedAt cannot precede createdAt.");
  const targetChapters = input.targetChapters === undefined ? undefined : positiveInteger(input.targetChapters, "Story Architecture target chapters", 100);
  return {
    id: identifier(input.id, "Story Architecture candidate id"),
    projectId: identifier(input.projectId, "Story Architecture project id"),
    idea: requiredText(input.idea, "Story Architecture idea", 32_000),
    kind: requiredText(input.kind, "Story Architecture book kind", 120),
    ...(targetChapters === undefined ? {} : { targetChapters }),
    plan: validateStoryArchitecturePlan(input.plan),
    provider: requiredText(input.provider, "Story Architecture provider", 200),
    model: requiredText(input.model, "Story Architecture model", 300),
    createdAt,
    updatedAt,
  };
}

export function validateStoryArchitecturePlan(value: unknown): StoryArchitecturePlan {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Story Architecture plan.");
  const input = value as Record<string, unknown>;
  const chapterPlan = objectList(input.chapterPlan, "Story Architecture chapter plan", 100, (raw) => {
    const item = raw as Record<string, unknown>;
    return {
      number: positiveInteger(item.number, "Story Architecture chapter number", 100),
      title: requiredText(item.title, "Story Architecture chapter title", 500),
      summary: requiredText(item.summary, "Story Architecture chapter summary", 5000),
      requiredEvents: textList(item.requiredEvents, "Story Architecture required event", 60, 1000),
      continuityDependencies: textList(item.continuityDependencies, "Story Architecture continuity dependency", 60, 1000),
    };
  }).sort((a, b) => a.number - b.number);
  const numbers = new Set<number>();
  for (const chapter of chapterPlan) {
    if (numbers.has(chapter.number)) throw new Error(`Duplicate Story Architecture chapter number ${chapter.number}.`);
    numbers.add(chapter.number);
  }
  const scenePlan = objectList(input.scenePlan, "Story Architecture scene plan", 500, (raw) => {
    const item = raw as Record<string, unknown>;
    const chapterNumber = positiveInteger(item.chapterNumber, "Story Architecture scene chapter number", 100);
    if (chapterPlan.length && !numbers.has(chapterNumber)) throw new Error(`Story Architecture scene references missing chapter ${chapterNumber}.`);
    return {
      chapterNumber,
      title: requiredText(item.title, "Story Architecture scene title", 500),
      summary: requiredText(item.summary, "Story Architecture scene summary", 5000),
      goal: optionalText(item.goal, "Story Architecture scene goal", 3000),
      conflict: optionalText(item.conflict, "Story Architecture scene conflict", 3000),
      outcome: optionalText(item.outcome, "Story Architecture scene outcome", 3000),
    };
  });
  return {
    premise: requiredText(input.premise, "Story Architecture premise", 8000),
    themes: textList(input.themes, "Story Architecture theme", 30, 1000, 1),
    audience: requiredText(input.audience, "Story Architecture audience", 4000),
    genreExpectations: textList(input.genreExpectations, "Story Architecture genre expectation", 40, 1000),
    canonCandidates: textList(input.canonCandidates, "Story Architecture canon candidate", 100, 2000),
    characterCandidates: textList(input.characterCandidates, "Story Architecture character candidate", 100, 2000),
    locations: textList(input.locations, "Story Architecture location", 100, 1000),
    timelineConsiderations: textList(input.timelineConsiderations, "Story Architecture timeline consideration", 100, 2000),
    assumptions: textList(input.assumptions, "Story Architecture assumption", 100, 2000),
    chapterPlan,
    scenePlan,
    unresolvedQuestions: textList(input.unresolvedQuestions, "Story Architecture unresolved question", 100, 2000),
    productionRisks: textList(input.productionRisks, "Story Architecture production risk", 100, 2000),
  };
}

export function validateStoryArchitectureApproval(value: unknown): StoryArchitectureApproval {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Story Architecture approval.");
  const input = value as Record<string, unknown>;
  if (typeof input.planSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(input.planSha256)) throw new Error("Invalid Story Architecture approval hash.");
  if (input.approvedBy !== "author") throw new Error("Story Architecture approval must be attributable to the author.");
  return {
    candidateId: identifier(input.candidateId, "Story Architecture approval candidate id"),
    planSha256: input.planSha256,
    approvedAt: timestamp(input.approvedAt, "Story Architecture approval timestamp"),
    approvedBy: "author",
  };
}

function objectList<T>(value: unknown, label: string, maxItems: number, mapper: (value: unknown) => T): T[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  if (value.length > maxItems) throw new Error(`${label} exceeds ${maxItems} items.`);
  return value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`${label} contains an invalid item.`);
    return mapper(item);
  });
}
function textList(value: unknown, label: string, maxItems: number, maxLength: number, minItems = 0): string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  if (value.length < minItems) throw new Error(`${label} requires at least ${minItems} item${minItems === 1 ? "" : "s"}.`);
  if (value.length > maxItems) throw new Error(`${label} exceeds ${maxItems} items.`);
  return [...new Set(value.map((item) => requiredText(item, label, maxLength)))];
}
function identifier(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim() || value !== value.trim() || value.length > 300 || /[\r\n]/u.test(value)) throw new Error(`${label} is invalid.`);
  return value;
}
function requiredText(value: unknown, label: string, max: number): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  const text = value.trim();
  if (text.length > max) throw new Error(`${label} exceeds ${max} characters.`);
  return text;
}
function optionalText(value: unknown, label: string, max: number): string {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") throw new Error(`${label} must be text.`);
  const text = value.trim();
  if (text.length > max) throw new Error(`${label} exceeds ${max} characters.`);
  return text;
}
function positiveInteger(value: unknown, label: string, max: number): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) throw new Error(`${label} must be an integer from 1 through ${max}.`);
  return number;
}
function timestamp(value: unknown, label: string): string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new Error(`${label} is invalid.`);
  return new Date(value).toISOString();
}

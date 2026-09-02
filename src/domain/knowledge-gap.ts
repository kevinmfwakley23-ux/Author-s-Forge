import { RESEARCH_DOMAINS, type ResearchDomain } from "./research";

export const KNOWLEDGE_GAP_FORMAT_VERSION = 1 as const;
export const KNOWLEDGE_GAP_STATUSES = ["open", "dismissed", "researched"] as const;
export const KNOWLEDGE_GAP_PRIORITIES = ["low", "medium", "high"] as const;
export type KnowledgeGapStatus = typeof KNOWLEDGE_GAP_STATUSES[number];
export type KnowledgeGapPriority = typeof KNOWLEDGE_GAP_PRIORITIES[number];

export interface KnowledgeGapHypothesis {
  readonly formatVersion: typeof KNOWLEDGE_GAP_FORMAT_VERSION;
  readonly id: string;
  readonly projectId: string;
  readonly domain: ResearchDomain;
  readonly question: string;
  readonly researchedBecause: string;
  readonly basis: string;
  readonly priority: KnowledgeGapPriority;
  readonly status: KnowledgeGapStatus;
  readonly source: "ai" | "author";
  readonly bookId?: string;
  readonly chapterId?: string;
  readonly sceneId?: string;
  readonly provider?: string;
  readonly model?: string;
  readonly requestId?: string;
  readonly researchMemoryIds: readonly string[];
  readonly dismissedReason?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function createKnowledgeGapHypothesis(input: {
  id: string;
  projectId: string;
  domain: ResearchDomain;
  question: string;
  researchedBecause: string;
  basis: string;
  priority: KnowledgeGapPriority;
  source?: "ai" | "author";
  bookId?: string;
  chapterId?: string;
  sceneId?: string;
  provider?: string;
  model?: string;
  requestId?: string;
  now?: string;
}): KnowledgeGapHypothesis {
  const now = timestamp(input.now ?? new Date().toISOString(), "Knowledge gap timestamp");
  return validateKnowledgeGapHypothesis({
    formatVersion: KNOWLEDGE_GAP_FORMAT_VERSION,
    id: identifier(input.id, "Knowledge gap id"),
    projectId: identifier(input.projectId, "Knowledge gap project id"),
    domain: researchDomain(input.domain),
    question: boundedText(input.question, "Knowledge gap question", 3000),
    researchedBecause: boundedText(input.researchedBecause, "Knowledge gap rationale", 3000),
    basis: boundedText(input.basis, "Knowledge gap basis", 5000),
    priority: priority(input.priority),
    status: "open",
    source: input.source ?? "ai",
    ...(optionalIdentifier(input.bookId, "Knowledge gap book id") ? { bookId: optionalIdentifier(input.bookId, "Knowledge gap book id") } : {}),
    ...(optionalIdentifier(input.chapterId, "Knowledge gap chapter id") ? { chapterId: optionalIdentifier(input.chapterId, "Knowledge gap chapter id") } : {}),
    ...(optionalIdentifier(input.sceneId, "Knowledge gap scene id") ? { sceneId: optionalIdentifier(input.sceneId, "Knowledge gap scene id") } : {}),
    ...(optionalText(input.provider, 200) ? { provider: optionalText(input.provider, 200) } : {}),
    ...(optionalText(input.model, 300) ? { model: optionalText(input.model, 300) } : {}),
    ...(optionalText(input.requestId, 300) ? { requestId: optionalText(input.requestId, 300) } : {}),
    researchMemoryIds: [],
    createdAt: now,
    updatedAt: now,
  });
}

export function dismissKnowledgeGap(gap: KnowledgeGapHypothesis, reason: string, now = new Date().toISOString()): KnowledgeGapHypothesis {
  const validated = validateKnowledgeGapHypothesis(gap);
  if (validated.status === "researched") throw new Error(`Knowledge gap "${validated.id}" is already researched.`);
  return validateKnowledgeGapHypothesis({
    ...validated,
    status: "dismissed",
    dismissedReason: boundedText(reason, "Knowledge gap dismissal reason", 2000),
    updatedAt: timestamp(now, "Knowledge gap updated timestamp"),
  });
}

export function markKnowledgeGapResearched(gap: KnowledgeGapHypothesis, researchMemoryIds: readonly string[], now = new Date().toISOString()): KnowledgeGapHypothesis {
  const validated = validateKnowledgeGapHypothesis(gap);
  if (!Array.isArray(researchMemoryIds) || !researchMemoryIds.length) throw new Error("Researched knowledge gap requires at least one research memory id.");
  const ids = [...new Set(researchMemoryIds.map((id) => identifier(id, "Research memory id")))];
  return validateKnowledgeGapHypothesis({
    ...validated,
    status: "researched",
    researchMemoryIds: ids,
    dismissedReason: undefined,
    updatedAt: timestamp(now, "Knowledge gap updated timestamp"),
  });
}

export function validateKnowledgeGapHypothesis(value: unknown): KnowledgeGapHypothesis {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid knowledge gap hypothesis.");
  const gap = value as KnowledgeGapHypothesis;
  if (gap.formatVersion !== KNOWLEDGE_GAP_FORMAT_VERSION) throw new Error("Unsupported knowledge gap hypothesis format.");
  const id = identifier(gap.id, "Knowledge gap id");
  const projectId = identifier(gap.projectId, "Knowledge gap project id");
  const domain = researchDomain(gap.domain);
  const question = boundedText(gap.question, "Knowledge gap question", 3000);
  const researchedBecause = boundedText(gap.researchedBecause, "Knowledge gap rationale", 3000);
  const basis = boundedText(gap.basis, "Knowledge gap basis", 5000);
  const validatedPriority = priority(gap.priority);
  if (!KNOWLEDGE_GAP_STATUSES.includes(gap.status)) throw new Error(`Knowledge gap "${id}" has invalid status.`);
  if (gap.source !== "ai" && gap.source !== "author") throw new Error(`Knowledge gap "${id}" has invalid source.`);
  const createdAt = timestamp(gap.createdAt, "Knowledge gap created timestamp");
  const updatedAt = timestamp(gap.updatedAt, "Knowledge gap updated timestamp");
  if (Date.parse(updatedAt) < Date.parse(createdAt)) throw new Error(`Knowledge gap "${id}" updatedAt cannot precede createdAt.`);
  const researchMemoryIds = Array.isArray(gap.researchMemoryIds)
    ? [...new Set(gap.researchMemoryIds.map((memoryId) => identifier(memoryId, "Research memory id")))]
    : (() => { throw new Error(`Knowledge gap "${id}" has invalid research memory ids.`); })();
  if (gap.status === "researched" && !researchMemoryIds.length) throw new Error(`Knowledge gap "${id}" is researched without evidence memory ids.`);
  if (gap.status !== "researched" && researchMemoryIds.length) throw new Error(`Knowledge gap "${id}" cannot link research memory before research succeeds.`);
  const dismissedReason = gap.status === "dismissed" ? boundedText(gap.dismissedReason ?? "", "Knowledge gap dismissal reason", 2000) : undefined;
  return {
    formatVersion: KNOWLEDGE_GAP_FORMAT_VERSION,
    id,
    projectId,
    domain,
    question,
    researchedBecause,
    basis,
    priority: validatedPriority,
    status: gap.status,
    source: gap.source,
    ...(optionalIdentifier(gap.bookId, "Knowledge gap book id") ? { bookId: optionalIdentifier(gap.bookId, "Knowledge gap book id") } : {}),
    ...(optionalIdentifier(gap.chapterId, "Knowledge gap chapter id") ? { chapterId: optionalIdentifier(gap.chapterId, "Knowledge gap chapter id") } : {}),
    ...(optionalIdentifier(gap.sceneId, "Knowledge gap scene id") ? { sceneId: optionalIdentifier(gap.sceneId, "Knowledge gap scene id") } : {}),
    ...(optionalText(gap.provider, 200) ? { provider: optionalText(gap.provider, 200) } : {}),
    ...(optionalText(gap.model, 300) ? { model: optionalText(gap.model, 300) } : {}),
    ...(optionalText(gap.requestId, 300) ? { requestId: optionalText(gap.requestId, 300) } : {}),
    researchMemoryIds,
    ...(dismissedReason ? { dismissedReason } : {}),
    createdAt,
    updatedAt,
  };
}

function researchDomain(value: unknown): ResearchDomain {
  if (typeof value !== "string" || !RESEARCH_DOMAINS.includes(value as ResearchDomain)) throw new Error("Invalid knowledge gap research domain.");
  return value as ResearchDomain;
}
function priority(value: unknown): KnowledgeGapPriority {
  if (typeof value !== "string" || !KNOWLEDGE_GAP_PRIORITIES.includes(value as KnowledgeGapPriority)) throw new Error("Invalid knowledge gap priority.");
  return value as KnowledgeGapPriority;
}
function identifier(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim() || value !== value.trim() || value.length > 300 || /[\r\n]/.test(value)) throw new Error(`${label} is invalid.`);
  return value;
}
function optionalIdentifier(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return identifier(value, label);
}
function boundedText(value: unknown, label: string, max: number): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  const text = value.trim();
  if (text.length > max) throw new Error(`${label} exceeds ${max} characters.`);
  return text;
}
function optionalText(value: unknown, max: number): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error("Invalid optional knowledge gap text.");
  const text = value.trim();
  if (!text || text.length > max || /[\r\n]/.test(text)) throw new Error("Invalid optional knowledge gap text.");
  return text;
}
function timestamp(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim() || Number.isNaN(Date.parse(value))) throw new Error(`${label} is invalid.`);
  return new Date(value).toISOString();
}

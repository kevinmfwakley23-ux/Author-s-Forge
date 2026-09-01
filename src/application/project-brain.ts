import { isMemoryClass, type MemoryClass, type MemoryRecord } from "../domain/memory";
import type { ProjectMemoryStore } from "./project-memory-store";

const MAX_QUERY_VALUES = 64;
const MAX_QUERY_VALUE_LENGTH = 512;
const WORD_SEGMENTER = new Intl.Segmenter("und", { granularity: "word" });

export interface ProjectBrainQuery {
  readonly projectId: string;
  readonly taskMemoryClasses?: readonly MemoryClass[];
  readonly relevanceTags?: readonly string[];
  readonly queryTerms?: readonly string[];
  readonly relatedMemoryIds?: readonly string[];
  readonly includeWorkingState?: boolean;
  readonly changedSince?: string;
  readonly limit?: number;
}

export interface ProjectBrainSelectionEvidence {
  readonly memoryId: string;
  readonly score: number;
  readonly reasons: readonly string[];
}

export interface ProjectBrainContext {
  readonly projectId: string;
  readonly authoritative: readonly MemoryRecord[];
  readonly working: readonly MemoryRecord[];
  readonly changed: readonly MemoryRecord[];
  readonly evidence: readonly ProjectBrainSelectionEvidence[];
}

export function assembleProjectBrainContext(store: ProjectMemoryStore, query: ProjectBrainQuery): ProjectBrainContext {
  const normalizedQuery = normalizeQuery(query);

  const classFilter = normalizedQuery.taskMemoryClasses;
  const filterClasses = (memory: MemoryRecord): boolean => classFilter === undefined || classFilter.includes(memory.class);
  const candidates = store.query({ projectId: normalizedQuery.projectId, changedSince: normalizedQuery.changedSince })
    .filter(filterClasses)
    .filter(isContextEligible);
  const ranked = rankMemories(candidates, normalizedQuery);
  const limited = ranked.slice(0, normalizedQuery.limit ?? Number.MAX_SAFE_INTEGER);
  const selected = limited.map(({ memory }) => memory);

  const authoritative = selected.filter((memory) => memory.authority === "authoritative");
  const working = normalizedQuery.includeWorkingState
    ? selected.filter((memory) => memory.authority === "proposed" || memory.authority === "working" || memory.authority === "verified")
    : [];
  const changed = normalizedQuery.changedSince
    ? [...authoritative, ...working].sort((a, b) => compareRanked(a, b, normalizedQuery))
    : [];

  return {
    projectId: normalizedQuery.projectId,
    authoritative,
    working,
    changed,
    evidence: limited.map(({ memory, score, reasons }) => ({ memoryId: memory.id, score, reasons })),
  };
}

function rankMemories(memories: readonly MemoryRecord[], query: ProjectBrainQuery): readonly RankedMemory[] {
  return memories
    .map((memory) => scoreMemory(memory, query))
    .filter(({ saliencyMatches }) => hasExplicitSaliency(query) ? saliencyMatches > 0 : true)
    .sort((a, b) => b.score - a.score || authorityWeight(b.memory.authority) - authorityWeight(a.memory.authority) || b.memory.updatedAt.localeCompare(a.memory.updatedAt) || a.memory.id.localeCompare(b.memory.id));
}

interface RankedMemory {
  readonly memory: MemoryRecord;
  readonly score: number;
  readonly reasons: readonly string[];
  readonly saliencyMatches: number;
}

function scoreMemory(memory: MemoryRecord, query: ProjectBrainQuery): RankedMemory {
  let score = authorityWeight(memory.authority);
  let saliencyMatches = 0;
  const reasons: string[] = [`authority:${memory.authority}`];

  if (query.taskMemoryClasses?.includes(memory.class)) {
    score += 12;
    reasons.push(`class:${memory.class}`);
  }

  const requestedTags = normalizeTerms(query.relevanceTags ?? []);
  const memoryTags = new Set(normalizeTerms(memory.relevanceTags));
  const matchedTags = requestedTags.filter((tag) => memoryTags.has(tag));
  if (matchedTags.length > 0) {
    saliencyMatches += matchedTags.length;
    score += matchedTags.length * 10;
    reasons.push(`tags:${matchedTags.join(",")}`);
  }

  const requestedRelations = new Set(query.relatedMemoryIds ?? []);
  const matchedRelations = memory.relatedMemoryIds.filter((id) => requestedRelations.has(id));
  if (matchedRelations.length > 0) {
    saliencyMatches += matchedRelations.length;
    score += matchedRelations.length * 14;
    reasons.push(`related:${matchedRelations.join(",")}`);
  }

  const queryTerms = normalizeTerms(query.queryTerms ?? []);
  if (queryTerms.length > 0) {
    const searchable = `${memory.summary} ${memory.content} ${memory.relevanceTags.join(" ")}`;
    const searchableWords = segmentWords(searchable);
    const matchedTerms = queryTerms.filter((term) => containsWordSequence(searchableWords, segmentWords(term)));
    if (matchedTerms.length > 0) {
      saliencyMatches += matchedTerms.length;
      score += matchedTerms.length * 8;
      reasons.push(`terms:${matchedTerms.join(",")}`);
    }
  }

  if (query.changedSince) {
    score += 4;
    reasons.push("changed-since");
  }

  return { memory, score, reasons, saliencyMatches };
}

function compareRanked(a: MemoryRecord, b: MemoryRecord, query: ProjectBrainQuery): number {
  const left = scoreMemory(a, query);
  const right = scoreMemory(b, query);
  return right.score - left.score || authorityWeight(b.authority) - authorityWeight(a.authority) || b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);
}

function isContextEligible(memory: MemoryRecord): boolean {
  return memory.authority !== "archived" && memory.authority !== "superseded";
}

function authorityWeight(authority: MemoryRecord["authority"]): number {
  switch (authority) {
    case "authoritative": return 40;
    case "verified": return 24;
    case "working": return 14;
    case "proposed": return 8;
    case "archived": return 2;
    case "superseded": return 0;
  }
}

function hasExplicitSaliency(query: ProjectBrainQuery): boolean {
  return Boolean(query.relevanceTags?.length || query.queryTerms?.length || query.relatedMemoryIds?.length);
}

function normalizeTerms(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => normalizeText(value)).filter(Boolean))];
}

function normalizeText(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("und").replace(/\s+/g, " ");
}

function containsWordSequence(valueWords: readonly string[], termWords: readonly string[]): boolean {
  if (termWords.length === 0 || termWords.length > valueWords.length) return false;
  for (let start = 0; start <= valueWords.length - termWords.length; start += 1) {
    if (termWords.every((word, offset) => valueWords[start + offset] === word)) return true;
  }
  return false;
}

function segmentWords(value: string): string[] {
  return [...WORD_SEGMENTER.segment(normalizeText(value))]
    .filter((segment) => segment.isWordLike)
    .map((segment) => segment.segment);
}

function normalizeQuery(query: ProjectBrainQuery): ProjectBrainQuery {
  if (!query || typeof query !== "object") throw new Error("Project Brain query is required.");
  if (typeof query.projectId !== "string" || !query.projectId.trim()) throw new Error("Project Brain project id is required.");
  if (query.projectId.trim().length > MAX_QUERY_VALUE_LENGTH) throw new Error("Project Brain project id is too long.");
  if (query.limit !== undefined && (!Number.isInteger(query.limit) || query.limit < 0)) throw new Error("Project Brain limit must be a non-negative integer.");
  if (query.includeWorkingState !== undefined && typeof query.includeWorkingState !== "boolean") throw new Error("Project Brain includeWorkingState must be a boolean.");
  if (query.changedSince !== undefined && (typeof query.changedSince !== "string" || !query.changedSince.trim() || Number.isNaN(Date.parse(query.changedSince)))) {
    throw new Error("Project Brain changedSince must be a valid timestamp.");
  }

  const taskMemoryClasses = normalizeMemoryClasses(query.taskMemoryClasses);
  const relevanceTags = normalizeStringArray(query.relevanceTags, "relevance tags");
  const queryTerms = normalizeStringArray(query.queryTerms, "query terms");
  const relatedMemoryIds = normalizeStringArray(query.relatedMemoryIds, "related memory ids");
  return {
    ...query,
    projectId: query.projectId.trim(),
    ...(taskMemoryClasses === undefined ? {} : { taskMemoryClasses }),
    ...(relevanceTags === undefined ? {} : { relevanceTags }),
    ...(queryTerms === undefined ? {} : { queryTerms }),
    ...(relatedMemoryIds === undefined ? {} : { relatedMemoryIds }),
    ...(query.changedSince === undefined ? {} : { changedSince: query.changedSince.trim() }),
  };
}

function normalizeMemoryClasses(value: readonly MemoryClass[] | undefined): readonly MemoryClass[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error("Project Brain task memory classes must be an array.");
  if (value.length > MAX_QUERY_VALUES) throw new Error(`Project Brain task memory classes cannot exceed ${MAX_QUERY_VALUES} values.`);
  for (const item of value) if (!isMemoryClass(item)) throw new Error(`Project Brain task memory class \"${String(item)}\" is invalid.`);
  return [...new Set(value)];
}

function normalizeStringArray(value: readonly string[] | undefined, label: string): readonly string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error(`Project Brain ${label} must be an array.`);
  if (value.length > MAX_QUERY_VALUES) throw new Error(`Project Brain ${label} cannot exceed ${MAX_QUERY_VALUES} values.`);
  const normalized = value.map((item) => {
    if (typeof item !== "string" || !item.trim()) throw new Error(`Project Brain ${label} must contain non-empty strings.`);
    const trimmed = item.trim();
    if (trimmed.length > MAX_QUERY_VALUE_LENGTH) throw new Error(`Project Brain ${label} values cannot exceed ${MAX_QUERY_VALUE_LENGTH} characters.`);
    return trimmed;
  });
  return [...new Set(normalized)];
}

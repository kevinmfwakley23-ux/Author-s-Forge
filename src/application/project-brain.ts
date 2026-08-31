import type { MemoryClass, MemoryRecord } from "../domain/memory";
import type { ProjectMemoryStore } from "./project-memory-store";

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
  if (!query.projectId.trim()) throw new Error("Project Brain project id is required.");
  if (query.limit !== undefined && (!Number.isInteger(query.limit) || query.limit < 0)) throw new Error("Project Brain limit must be a non-negative integer.");
  if (query.changedSince !== undefined && Number.isNaN(Date.parse(query.changedSince))) throw new Error("Project Brain changedSince must be a valid timestamp.");

  const classFilter = query.taskMemoryClasses;
  const filterClasses = (memory: MemoryRecord): boolean => classFilter === undefined || classFilter.includes(memory.class);
  const candidates = store.query({ projectId: query.projectId, changedSince: query.changedSince }).filter(filterClasses);
  const ranked = rankMemories(candidates, query);
  const limited = ranked.slice(0, query.limit ?? Number.MAX_SAFE_INTEGER);
  const selectedIds = new Set(limited.map(({ memory }) => memory.id));
  const selected = limited.map(({ memory }) => memory);

  const authoritative = selected.filter((memory) => memory.authority === "authoritative");
  const working = query.includeWorkingState
    ? selected.filter((memory) => memory.authority === "proposed" || memory.authority === "working" || memory.authority === "verified")
    : [];
  const changed = candidates
    .filter((memory) => selectedIds.has(memory.id))
    .sort((a, b) => compareRanked(a, b, query));

  return {
    projectId: query.projectId,
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
    const searchable = normalizeText(`${memory.summary} ${memory.content} ${memory.relevanceTags.join(" ")}`);
    const matchedTerms = queryTerms.filter((term) => searchable.includes(term));
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
  return value.trim().toLocaleLowerCase();
}

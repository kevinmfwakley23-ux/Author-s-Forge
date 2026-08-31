import type { MemoryAuthority, MemoryClass, MemoryRecord } from "./memory";

export interface MemorySaliencyRequest {
  readonly projectId: string;
  readonly class: MemoryClass;
  readonly queryTerms?: readonly string[];
  readonly limit?: number;
}

export interface MemorySaliencyHit {
  readonly memory: MemoryRecord;
  readonly score: number;
  readonly matchedTerms: readonly string[];
  readonly matchedTags: readonly string[];
  readonly reasons: readonly string[];
}

const DEFAULT_LIMIT = 8;

export function selectSalientMemories(memories: readonly MemoryRecord[], request: MemorySaliencyRequest): MemorySaliencyHit[] {
  if (!request.projectId.trim()) throw new Error("Memory saliency project id is required.");
  const limit = request.limit ?? DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1) throw new Error("Memory saliency limit must be a positive integer.");
  const queryTerms = normalizeTerms(request.queryTerms ?? []);
  const candidates = memories
    .filter((memory) => memory.projectId === request.projectId)
    .filter((memory) => memory.class === request.class)
    .filter((memory) => memory.authority !== "archived" && memory.authority !== "superseded")
    .map((memory) => scoreMemory(memory, queryTerms));

  const hasQueryMatches = queryTerms.length > 0 && candidates.some((candidate) => candidate.matchedTerms.length > 0 || candidate.matchedTags.length > 0);
  return candidates
    .filter((candidate) => !hasQueryMatches || candidate.matchedTerms.length > 0 || candidate.matchedTags.length > 0)
    .sort((a, b) => b.score - a.score || b.memory.updatedAt.localeCompare(a.memory.updatedAt) || a.memory.id.localeCompare(b.memory.id))
    .slice(0, limit)
    .map((candidate) => ({ ...candidate, reasons: evidenceReasons(candidate, hasQueryMatches, queryTerms.length > 0) }));
}

function scoreMemory(memory: MemoryRecord, queryTerms: readonly string[]): Omit<MemorySaliencyHit, "reasons"> {
  const textTerms = new Set(tokenize(`${memory.summary} ${memory.content}`));
  const tagTerms = new Set(memory.relevanceTags.flatMap(tokenize));
  const matchedTerms = queryTerms.filter((term) => textTerms.has(term));
  const matchedTags = queryTerms.filter((term) => tagTerms.has(term));
  const authority = authorityWeight(memory.authority);
  const provenance = provenanceWeight(memory);
  const score = matchedTerms.length * 100 + matchedTags.length * 130 + authority + provenance;
  return { memory, score, matchedTerms, matchedTags };
}

function evidenceReasons(hit: Omit<MemorySaliencyHit, "reasons">, hasQueryMatches: boolean, hadQuery: boolean): string[] {
  const reasons = [hit.memory.authority === "authoritative" ? "authoritative" : `authority:${hit.memory.authority}`, `saliency-score:${hit.score}`];
  if (hit.matchedTerms.length) reasons.push(`terms:${hit.matchedTerms.join(",")}`);
  if (hit.matchedTags.length) reasons.push(`tags:${hit.matchedTags.join(",")}`);
  if (hadQuery && !hasQueryMatches) reasons.push("fallback:authority");
  if (!hadQuery) reasons.push("section-default");
  if (hit.memory.provenance.some((item) => item.kind === "author")) reasons.push("author-provenance");
  return reasons;
}

function authorityWeight(authority: MemoryAuthority): number {
  switch (authority) {
    case "authoritative": return 40;
    case "verified": return 24;
    case "working": return 14;
    case "proposed": return 8;
    case "archived": return 2;
    case "superseded": return 0;
  }
}

function provenanceWeight(memory: MemoryRecord): number {
  if (memory.provenance.some((item) => item.kind === "author")) return 6;
  if (memory.provenance.some((item) => item.kind === "source")) return 3;
  return 0;
}

function normalizeTerms(values: readonly string[]): string[] {
  return [...new Set(values.flatMap(tokenize))].slice(0, 16);
}

function tokenize(value: string): string[] {
  return value.toLowerCase().split(/[^\p{L}\p{N}]+/u).map((term) => term.trim()).filter((term) => term.length >= 3);
}

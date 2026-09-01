import { isMemoryClass, type MemoryClass, type MemoryRecord } from "../domain/memory";
import type { ProjectMemoryStore } from "./project-memory-store";

const MAX_QUERY_VALUES = 64;
const MAX_QUERY_VALUE_LENGTH = 512;
export const PROJECT_BRAIN_MAX_RESULTS = 256;
const WORD_SEGMENTER = new Intl.Segmenter("und", { granularity: "word" });

export interface ProjectBrainEntityMatchRule {
  readonly entityId: string;
  readonly aliases: readonly string[];
  readonly caseSensitive?: boolean;
  readonly excludedPhrases?: readonly string[];
}

export interface ProjectBrainQuery {
  readonly projectId: string;
  readonly taskMemoryClasses?: readonly MemoryClass[];
  readonly relevanceTags?: readonly string[];
  readonly queryTerms?: readonly string[];
  readonly relatedMemoryIds?: readonly string[];
  readonly entityMatchRules?: readonly ProjectBrainEntityMatchRule[];
  readonly includeWorkingState?: boolean;
  readonly changedSince?: string;
  readonly asOf?: string;
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
  readonly asOf?: string;
}

export function assembleProjectBrainContext(store: ProjectMemoryStore, query: ProjectBrainQuery): ProjectBrainContext {
  const normalizedQuery = normalizeQuery(query);

  const classFilter = normalizedQuery.taskMemoryClasses;
  const filterClasses = (memory: MemoryRecord): boolean => classFilter === undefined || classFilter.includes(memory.class);
  const sourceMemories = normalizedQuery.asOf
    ? store.queryAt({ projectId: normalizedQuery.projectId }, normalizedQuery.asOf)
    : store.query({ projectId: normalizedQuery.projectId, changedSince: normalizedQuery.changedSince });
  const liveMemories = sourceMemories.filter(isContextEligible);
  assertNoAuthoritativeStateConflicts(liveMemories);
  const candidates = liveMemories.filter(filterClasses);
  const ranked = rankMemories(candidates, normalizedQuery);
  const limited = ranked.slice(0, normalizedQuery.limit ?? PROJECT_BRAIN_MAX_RESULTS);
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
    ...(normalizedQuery.asOf === undefined ? {} : { asOf: normalizedQuery.asOf }),
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

interface WordToken {
  readonly raw: string;
  readonly folded: string;
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

  const searchable = `${memory.summary} ${memory.content} ${memory.relevanceTags.join(" ")}`;
  const queryTerms = normalizeTerms(query.queryTerms ?? []);
  if (queryTerms.length > 0) {
    const searchableWords = segmentWords(searchable);
    const matchedTerms = queryTerms.filter((term) => containsWordSequence(searchableWords, segmentWords(term)));
    if (matchedTerms.length > 0) {
      saliencyMatches += matchedTerms.length;
      score += matchedTerms.length * 8;
      reasons.push(`terms:${matchedTerms.join(",")}`);
    }
  }

  for (const rule of query.entityMatchRules ?? []) {
    const matchedAlias = findEntityAliasMatch(searchable, rule);
    if (matchedAlias !== undefined) {
      saliencyMatches += 1;
      score += 12;
      reasons.push(`entity:${rule.entityId}:${matchedAlias}`);
    }
  }

  if (query.changedSince) {
    score += 4;
    reasons.push("changed-since");
  }
  if (query.asOf) reasons.push(`as-of:${query.asOf}`);

  return { memory, score, reasons, saliencyMatches };
}

function compareRanked(a: MemoryRecord, b: MemoryRecord, query: ProjectBrainQuery): number {
  const left = scoreMemory(a, query);
  const right = scoreMemory(b, query);
  return right.score - left.score || authorityWeight(b.authority) - authorityWeight(a.authority) || b.memory.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);
}

function isContextEligible(memory: MemoryRecord): boolean {
  return memory.authority !== "archived" && memory.authority !== "superseded";
}

function assertNoAuthoritativeStateConflicts(memories: readonly MemoryRecord[]): void {
  const byKey = new Map<string, Map<string, string[]>>();
  for (const memory of memories) {
    if (memory.authority !== "authoritative" || memory.stateKey === undefined || memory.stateValue === undefined) continue;
    const normalizedValue = normalizeText(memory.stateValue);
    const values = byKey.get(memory.stateKey) ?? new Map<string, string[]>();
    const ids = values.get(normalizedValue) ?? [];
    ids.push(memory.id);
    values.set(normalizedValue, ids);
    byKey.set(memory.stateKey, values);
  }
  for (const [stateKey, values] of byKey) {
    if (values.size <= 1) continue;
    const memoryIds = [...values.values()].flat().sort();
    throw new Error(`Project Brain authoritative state conflict for "${stateKey}" across memories ${memoryIds.join(", ")}. Resolve the conflict through author supersession before retrieval.`);
  }
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
  return Boolean(query.relevanceTags?.length || query.queryTerms?.length || query.relatedMemoryIds?.length || query.entityMatchRules?.length);
}

function normalizeTerms(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => normalizeText(value)).filter(Boolean))];
}

function normalizeText(value: string): string {
  return normalizeTextPreservingCase(value).toLocaleLowerCase("und");
}

function normalizeTextPreservingCase(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ");
}

function containsWordSequence(valueWords: readonly string[], termWords: readonly string[]): boolean {
  if (termWords.length === 0 || termWords.length > valueWords.length) return false;
  for (let start = 0; start <= valueWords.length - termWords.length; start += 1) {
    if (termWords.every((word, offset) => valueWords[start + offset] === word)) return true;
  }
  return false;
}

function segmentWords(value: string): string[] {
  return segmentWordTokens(value).map((token) => token.folded);
}

function segmentWordTokens(value: string): WordToken[] {
  const normalized = value.normalize("NFKC");
  return [...WORD_SEGMENTER.segment(normalized)]
    .filter((segment) => segment.isWordLike)
    .map((segment) => ({ raw: segment.segment, folded: segment.segment.toLocaleLowerCase("und") }));
}

function findEntityAliasMatch(searchable: string, rule: ProjectBrainEntityMatchRule): string | undefined {
  const searchableWords = segmentWordTokens(searchable);
  const exclusions = (rule.excludedPhrases ?? []).map((phrase) => segmentWordTokens(phrase)).filter((tokens) => tokens.length > 0);

  for (const alias of rule.aliases) {
    const aliasWords = segmentWordTokens(alias);
    if (aliasWords.length === 0 || aliasWords.length > searchableWords.length) continue;
    for (let start = 0; start <= searchableWords.length - aliasWords.length; start += 1) {
      if (!wordSequenceMatches(searchableWords, aliasWords, start, rule.caseSensitive ?? false)) continue;
      if (isEntityOccurrenceExcluded(searchableWords, start, aliasWords.length, exclusions, rule.caseSensitive ?? false)) continue;
      return alias;
    }
  }
  return undefined;
}

function wordSequenceMatches(valueWords: readonly WordToken[], termWords: readonly WordToken[], start: number, caseSensitive: boolean): boolean {
  return termWords.every((word, offset) => {
    const candidate = valueWords[start + offset];
    return caseSensitive ? candidate.raw === word.raw : candidate.folded === word.folded;
  });
}

function isEntityOccurrenceExcluded(
  valueWords: readonly WordToken[],
  aliasStart: number,
  aliasLength: number,
  exclusions: readonly (readonly WordToken[])[],
  caseSensitive: boolean,
): boolean {
  const aliasEnd = aliasStart + aliasLength - 1;
  for (const exclusion of exclusions) {
    if (exclusion.length === 0 || exclusion.length > valueWords.length) continue;
    for (let start = 0; start <= valueWords.length - exclusion.length; start += 1) {
      if (!wordSequenceMatches(valueWords, exclusion, start, caseSensitive)) continue;
      const exclusionEnd = start + exclusion.length - 1;
      if (start <= aliasStart && exclusionEnd >= aliasEnd) return true;
    }
  }
  return false;
}

function normalizeQuery(query: ProjectBrainQuery): ProjectBrainQuery {
  if (!query || typeof query !== "object") throw new Error("Project Brain query is required.");
  if (typeof query.projectId !== "string" || !query.projectId.trim()) throw new Error("Project Brain project id is required.");
  if (query.projectId.trim().length > MAX_QUERY_VALUE_LENGTH) throw new Error("Project Brain project id is too long.");
  if (query.limit !== undefined && (!Number.isInteger(query.limit) || query.limit < 0 || query.limit > PROJECT_BRAIN_MAX_RESULTS)) throw new Error(`Project Brain limit must be an integer from 0 to ${PROJECT_BRAIN_MAX_RESULTS}.`);
  if (query.includeWorkingState !== undefined && typeof query.includeWorkingState !== "boolean") throw new Error("Project Brain includeWorkingState must be a boolean.");
  if (query.changedSince !== undefined && (typeof query.changedSince !== "string" || !query.changedSince.trim() || Number.isNaN(Date.parse(query.changedSince)))) {
    throw new Error("Project Brain changedSince must be a valid timestamp.");
  }
  if (query.asOf !== undefined && (typeof query.asOf !== "string" || !query.asOf.trim() || Number.isNaN(Date.parse(query.asOf)))) {
    throw new Error("Project Brain asOf must be a valid timestamp.");
  }
  if (query.changedSince !== undefined && query.asOf !== undefined) throw new Error("Project Brain changedSince and asOf cannot be combined.");

  const taskMemoryClasses = normalizeMemoryClasses(query.taskMemoryClasses);
  const relevanceTags = normalizeStringArray(query.relevanceTags, "relevance tags");
  const queryTerms = normalizeStringArray(query.queryTerms, "query terms");
  const relatedMemoryIds = normalizeStringArray(query.relatedMemoryIds, "related memory ids");
  const entityMatchRules = normalizeEntityMatchRules(query.entityMatchRules);
  return {
    ...query,
    projectId: query.projectId.trim(),
    ...(taskMemoryClasses === undefined ? {} : { taskMemoryClasses }),
    ...(relevanceTags === undefined ? {} : { relevanceTags }),
    ...(queryTerms === undefined ? {} : { queryTerms }),
    ...(relatedMemoryIds === undefined ? {} : { relatedMemoryIds }),
    ...(entityMatchRules === undefined ? {} : { entityMatchRules }),
    ...(query.changedSince === undefined ? {} : { changedSince: query.changedSince.trim() }),
    ...(query.asOf === undefined ? {} : { asOf: query.asOf.trim() }),
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
  const normalized = value.map((item) => normalizeQueryString(item, label));
  return [...new Set(normalized)];
}

function normalizeEntityMatchRules(value: readonly ProjectBrainEntityMatchRule[] | undefined): readonly ProjectBrainEntityMatchRule[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error("Project Brain entity match rules must be an array.");
  if (value.length > MAX_QUERY_VALUES) throw new Error(`Project Brain entity match rules cannot exceed ${MAX_QUERY_VALUES} values.`);

  const seenIds = new Set<string>();
  return value.map((rawRule) => {
    if (!rawRule || typeof rawRule !== "object" || Array.isArray(rawRule)) throw new Error("Project Brain entity match rule must be an object.");
    const rule = rawRule as ProjectBrainEntityMatchRule;
    const entityId = normalizeQueryString(rule.entityId, "entity match rule ids");
    if (seenIds.has(entityId)) throw new Error(`Project Brain entity match rule id \"${entityId}\" is duplicated.`);
    seenIds.add(entityId);

    if (!Array.isArray(rule.aliases) || rule.aliases.length === 0) throw new Error("Project Brain entity match rule aliases must be a non-empty array.");
    if (rule.aliases.length > MAX_QUERY_VALUES) throw new Error(`Project Brain entity match rule aliases cannot exceed ${MAX_QUERY_VALUES} values.`);
    if (rule.caseSensitive !== undefined && typeof rule.caseSensitive !== "boolean") throw new Error("Project Brain entity match rule caseSensitive must be a boolean.");

    const caseSensitive = rule.caseSensitive ?? false;
    const aliases = dedupeMatchStrings(rule.aliases.map((alias) => normalizeQueryString(alias, "entity match rule aliases")), caseSensitive);
    const excludedPhrasesRaw = rule.excludedPhrases === undefined
      ? undefined
      : normalizeStringArray(rule.excludedPhrases, "entity match rule excluded phrases");
    const excludedPhrases = excludedPhrasesRaw === undefined ? undefined : dedupeMatchStrings(excludedPhrasesRaw, caseSensitive);

    return {
      entityId,
      aliases,
      ...(rule.caseSensitive === undefined ? {} : { caseSensitive }),
      ...(excludedPhrases === undefined ? {} : { excludedPhrases }),
    };
  });
}

function normalizeQueryString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Project Brain ${label} must contain non-empty strings.`);
  const trimmed = normalizeTextPreservingCase(value);
  if (trimmed.length > MAX_QUERY_VALUE_LENGTH) throw new Error(`Project Brain ${label} values cannot exceed ${MAX_QUERY_VALUE_LENGTH} characters.`);
  return trimmed;
}

function dedupeMatchStrings(values: readonly string[], caseSensitive: boolean): readonly string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = caseSensitive ? normalizeTextPreservingCase(value) : normalizeText(value);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

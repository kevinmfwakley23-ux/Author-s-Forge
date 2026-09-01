import type { ProjectMemoryStore } from "./project-memory-store";
import { assembleProjectBrainContext, type ProjectBrainQuery } from "./project-brain";

const MAX_EVALUATION_CASES = 256;
const MAX_EVALUATION_IDS = 256;
const MAX_EVALUATION_ID_LENGTH = 512;

export interface ProjectBrainEvaluationCase {
  readonly id: string;
  readonly query: ProjectBrainQuery;
  readonly expectedMemoryIds: readonly string[];
  readonly forbiddenMemoryIds?: readonly string[];
}

export interface ProjectBrainEvaluationCaseResult {
  readonly id: string;
  readonly selectedMemoryIds: readonly string[];
  readonly expectedMemoryIds: readonly string[];
  readonly forbiddenMemoryIds: readonly string[];
  readonly retrievedExpectedIds: readonly string[];
  readonly missingExpectedIds: readonly string[];
  readonly retrievedForbiddenIds: readonly string[];
  readonly recall: number;
  readonly forbiddenLeakRate: number;
  readonly passed: boolean;
}

export interface ProjectBrainEvaluationReport {
  readonly caseCount: number;
  readonly passedCount: number;
  readonly failedCount: number;
  readonly expectedMemoryCount: number;
  readonly retrievedExpectedMemoryCount: number;
  readonly forbiddenMemoryCount: number;
  readonly retrievedForbiddenMemoryCount: number;
  readonly expectedRecall: number;
  readonly forbiddenLeakRate: number;
  readonly cases: readonly ProjectBrainEvaluationCaseResult[];
}

export function evaluateProjectBrainRetrieval(
  store: ProjectMemoryStore,
  cases: readonly ProjectBrainEvaluationCase[],
): ProjectBrainEvaluationReport {
  const normalizedCases = normalizeEvaluationCases(cases);
  const results = normalizedCases.map((evaluationCase) => evaluateCase(store, evaluationCase));
  const expectedMemoryCount = results.reduce((sum, result) => sum + result.expectedMemoryIds.length, 0);
  const retrievedExpectedMemoryCount = results.reduce((sum, result) => sum + result.retrievedExpectedIds.length, 0);
  const forbiddenMemoryCount = results.reduce((sum, result) => sum + result.forbiddenMemoryIds.length, 0);
  const retrievedForbiddenMemoryCount = results.reduce((sum, result) => sum + result.retrievedForbiddenIds.length, 0);
  const passedCount = results.filter((result) => result.passed).length;

  return Object.freeze({
    caseCount: results.length,
    passedCount,
    failedCount: results.length - passedCount,
    expectedMemoryCount,
    retrievedExpectedMemoryCount,
    forbiddenMemoryCount,
    retrievedForbiddenMemoryCount,
    expectedRecall: ratio(retrievedExpectedMemoryCount, expectedMemoryCount, 1),
    forbiddenLeakRate: ratio(retrievedForbiddenMemoryCount, forbiddenMemoryCount, 0),
    cases: Object.freeze(results),
  });
}

function evaluateCase(store: ProjectMemoryStore, evaluationCase: ProjectBrainEvaluationCase): ProjectBrainEvaluationCaseResult {
  const context = assembleProjectBrainContext(store, evaluationCase.query);
  const selectedMemoryIds = context.evidence.map((evidence) => evidence.memoryId);
  const selected = new Set(selectedMemoryIds);
  const retrievedExpectedIds = evaluationCase.expectedMemoryIds.filter((memoryId) => selected.has(memoryId));
  const missingExpectedIds = evaluationCase.expectedMemoryIds.filter((memoryId) => !selected.has(memoryId));
  const forbiddenMemoryIds = evaluationCase.forbiddenMemoryIds ?? [];
  const retrievedForbiddenIds = forbiddenMemoryIds.filter((memoryId) => selected.has(memoryId));

  return Object.freeze({
    id: evaluationCase.id,
    selectedMemoryIds: Object.freeze([...selectedMemoryIds]),
    expectedMemoryIds: Object.freeze([...evaluationCase.expectedMemoryIds]),
    forbiddenMemoryIds: Object.freeze([...forbiddenMemoryIds]),
    retrievedExpectedIds: Object.freeze(retrievedExpectedIds),
    missingExpectedIds: Object.freeze(missingExpectedIds),
    retrievedForbiddenIds: Object.freeze(retrievedForbiddenIds),
    recall: ratio(retrievedExpectedIds.length, evaluationCase.expectedMemoryIds.length, 1),
    forbiddenLeakRate: ratio(retrievedForbiddenIds.length, forbiddenMemoryIds.length, 0),
    passed: missingExpectedIds.length === 0 && retrievedForbiddenIds.length === 0,
  });
}

function normalizeEvaluationCases(value: readonly ProjectBrainEvaluationCase[]): readonly ProjectBrainEvaluationCase[] {
  if (!Array.isArray(value)) throw new Error("Project Brain evaluation cases must be an array.");
  if (value.length === 0) throw new Error("Project Brain evaluation requires at least one case.");
  if (value.length > MAX_EVALUATION_CASES) throw new Error(`Project Brain evaluation cannot exceed ${MAX_EVALUATION_CASES} cases.`);

  const seenCaseIds = new Set<string>();
  return value.map((rawCase) => {
    if (!rawCase || typeof rawCase !== "object" || Array.isArray(rawCase)) throw new Error("Project Brain evaluation case must be an object.");
    const evaluationCase = rawCase as ProjectBrainEvaluationCase;
    const id = normalizeId(evaluationCase.id, "case id");
    if (seenCaseIds.has(id)) throw new Error(`Project Brain evaluation case id "${id}" is duplicated.`);
    seenCaseIds.add(id);
    if (!evaluationCase.query || typeof evaluationCase.query !== "object" || Array.isArray(evaluationCase.query)) throw new Error(`Project Brain evaluation case "${id}" requires a query object.`);
    const expectedMemoryIds = normalizeIdArray(evaluationCase.expectedMemoryIds, "expected memory ids", true);
    const forbiddenMemoryIds = evaluationCase.forbiddenMemoryIds === undefined
      ? []
      : normalizeIdArray(evaluationCase.forbiddenMemoryIds, "forbidden memory ids", false);
    const forbidden = new Set(forbiddenMemoryIds);
    const overlap = expectedMemoryIds.find((memoryId) => forbidden.has(memoryId));
    if (overlap) throw new Error(`Project Brain evaluation case "${id}" cannot expect and forbid memory "${overlap}" at the same time.`);

    return Object.freeze({
      id,
      query: { ...evaluationCase.query },
      expectedMemoryIds: Object.freeze(expectedMemoryIds),
      ...(forbiddenMemoryIds.length === 0 ? {} : { forbiddenMemoryIds: Object.freeze(forbiddenMemoryIds) }),
    });
  });
}

function normalizeIdArray(value: unknown, label: string, requireOne: boolean): string[] {
  if (!Array.isArray(value)) throw new Error(`Project Brain evaluation ${label} must be an array.`);
  if (requireOne && value.length === 0) throw new Error(`Project Brain evaluation ${label} must contain at least one memory id.`);
  if (value.length > MAX_EVALUATION_IDS) throw new Error(`Project Brain evaluation ${label} cannot exceed ${MAX_EVALUATION_IDS} values.`);
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const normalized = normalizeId(item, label);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  if (requireOne && result.length === 0) throw new Error(`Project Brain evaluation ${label} must contain at least one memory id.`);
  return result;
}

function normalizeId(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Project Brain evaluation ${label} must be a non-empty string.`);
  const normalized = value.normalize("NFKC").trim();
  if (normalized.length > MAX_EVALUATION_ID_LENGTH) throw new Error(`Project Brain evaluation ${label} cannot exceed ${MAX_EVALUATION_ID_LENGTH} characters.`);
  return normalized;
}

function ratio(numerator: number, denominator: number, emptyValue: number): number {
  return denominator === 0 ? emptyValue : numerator / denominator;
}

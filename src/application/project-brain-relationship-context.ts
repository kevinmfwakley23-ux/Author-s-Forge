import type { MemoryRecord } from "../domain/memory";
import { validateMemoryRelationshipSet, type MemoryRelationship } from "../domain/relationship-memory";
import { assembleProjectBrainContext, PROJECT_BRAIN_MAX_RESULTS, type ProjectBrainContext, type ProjectBrainQuery, type ProjectBrainSelectionEvidence } from "./project-brain";
import type { ProjectMemoryStore } from "./project-memory-store";

export const PROJECT_BRAIN_MAX_RELATIONSHIP_RESULTS = 64;
export const PROJECT_BRAIN_DEFAULT_RELATIONSHIP_RESULTS = 16;
const PROJECT_BRAIN_MAX_RELATIONSHIP_EDGES = 4096;

export type ProjectBrainRelationshipDirection = "outgoing" | "incoming" | "both";
export interface ProjectBrainRelationshipOptions {
  readonly maxRelatedMemories?: number;
  readonly direction?: ProjectBrainRelationshipDirection;
  readonly includeCrossClass?: boolean;
}
export interface ProjectBrainRelationshipEvidence {
  readonly relationshipId: string;
  readonly memoryId: string;
  readonly seedMemoryId: string;
  readonly relation: string;
  readonly direction: "outgoing" | "incoming";
  readonly context: string;
  readonly significance?: string;
}
export interface RelationshipAwareProjectBrainContext extends ProjectBrainContext {
  readonly relationshipEvidence: readonly ProjectBrainRelationshipEvidence[];
}

interface RelatedCandidate {
  readonly memory: MemoryRecord;
  score: number;
  readonly reasons: string[];
  readonly relationships: ProjectBrainRelationshipEvidence[];
}

export function assembleRelationshipAwareProjectBrainContext(
  store: ProjectMemoryStore,
  relationships: readonly MemoryRelationship[],
  query: ProjectBrainQuery,
  options: ProjectBrainRelationshipOptions = {},
): RelationshipAwareProjectBrainContext {
  const base = assembleProjectBrainContext(store, query);
  const normalized = normalizeOptions(options);
  if (!Array.isArray(relationships)) throw new Error("Project Brain relationships must be an array.");
  if (relationships.length > PROJECT_BRAIN_MAX_RELATIONSHIP_EDGES) throw new Error(`Project Brain relationships cannot exceed ${PROJECT_BRAIN_MAX_RELATIONSHIP_EDGES} edges per request.`);
  const validatedRelationships = validateMemoryRelationshipSet(relationships, store.list(), query.projectId);

  const seeds = [...base.authoritative, ...base.working];
  if (seeds.length === 0 || validatedRelationships.length === 0 || normalized.maxRelatedMemories === 0) return { ...base, relationshipEvidence: [] };
  const seedIds = new Set(seeds.map((memory) => memory.id));
  const seedScores = new Map(base.evidence.map((item) => [item.memoryId, item.score]));
  const candidates = new Map<string, RelatedCandidate>();

  for (const relationship of validatedRelationships) {
    if ((normalized.direction === "outgoing" || normalized.direction === "both") && seedIds.has(relationship.sourceMemoryId)) {
      collectCandidate(store, query, normalized, relationship, relationship.sourceMemoryId, relationship.targetMemoryId, "outgoing", seedIds, seedScores, candidates);
    }
    if ((normalized.direction === "incoming" || normalized.direction === "both") && seedIds.has(relationship.targetMemoryId)) {
      collectCandidate(store, query, normalized, relationship, relationship.targetMemoryId, relationship.sourceMemoryId, "incoming", seedIds, seedScores, candidates);
    }
  }

  const directCount = new Set([...base.authoritative, ...base.working].map((memory) => memory.id)).size;
  const available = Math.max(0, PROJECT_BRAIN_MAX_RESULTS - directCount);
  const selected = [...candidates.values()]
    .sort((a, b) => b.score - a.score || authorityWeight(b.memory.authority) - authorityWeight(a.memory.authority) || b.memory.updatedAt.localeCompare(a.memory.updatedAt) || a.memory.id.localeCompare(b.memory.id))
    .slice(0, Math.min(normalized.maxRelatedMemories, available));

  const relatedAuthoritative = selected.filter((item) => item.memory.authority === "authoritative").map((item) => item.memory);
  const relatedWorking = selected.filter((item) => item.memory.authority === "verified" || item.memory.authority === "working" || item.memory.authority === "proposed").map((item) => item.memory);
  const relationshipEvidence = selected.flatMap((item) => item.relationships);
  const relatedEvidence: ProjectBrainSelectionEvidence[] = selected.map((item) => ({ memoryId: item.memory.id, score: item.score, reasons: item.reasons }));

  return {
    ...base,
    authoritative: [...base.authoritative, ...relatedAuthoritative],
    working: [...base.working, ...relatedWorking],
    evidence: [...base.evidence, ...relatedEvidence],
    relationshipEvidence,
  };
}

function collectCandidate(
  store: ProjectMemoryStore,
  query: ProjectBrainQuery,
  options: Required<ProjectBrainRelationshipOptions>,
  relationship: MemoryRelationship,
  seedMemoryId: string,
  relatedMemoryId: string,
  direction: "outgoing" | "incoming",
  seedIds: ReadonlySet<string>,
  seedScores: ReadonlyMap<string, number>,
  candidates: Map<string, RelatedCandidate>,
): void {
  if (seedIds.has(relatedMemoryId)) return;
  const memory = store.get(relatedMemoryId);
  if (!memory) throw new Error(`Project Brain relationship "${relationship.id}" references missing memory "${relatedMemoryId}".`);
  if (memory.projectId !== query.projectId) throw new Error(`Project Brain relationship "${relationship.id}" crosses project boundaries.`);
  if (!isContextEligible(memory)) return;
  if (memory.authority !== "authoritative" && !query.includeWorkingState) return;
  if (!options.includeCrossClass && query.taskMemoryClasses?.length && !query.taskMemoryClasses.includes(memory.class)) return;

  const evidence: ProjectBrainRelationshipEvidence = {
    relationshipId: relationship.id,
    memoryId: memory.id,
    seedMemoryId,
    relation: relationship.relation,
    direction,
    context: relationship.context,
    ...(relationship.significance ? { significance: relationship.significance } : {}),
  };
  const relationScore = 18 + (relationship.significance ? 4 : 0);
  const score = (seedScores.get(seedMemoryId) ?? authorityWeight(store.get(seedMemoryId)?.authority ?? "working")) + relationScore + Math.floor(authorityWeight(memory.authority) / 4);
  const reason = `relationship:${relationship.id}:${direction}:${relationship.relation}:${seedMemoryId}`;
  const existing = candidates.get(memory.id);
  if (!existing) {
    candidates.set(memory.id, { memory, score, reasons: [`authority:${memory.authority}`, reason], relationships: [evidence] });
    return;
  }
  if (!existing.reasons.includes(reason)) existing.reasons.push(reason);
  existing.relationships.push(evidence);
  existing.score = Math.max(existing.score, score) + 2;
}

function normalizeOptions(options: ProjectBrainRelationshipOptions): Required<ProjectBrainRelationshipOptions> {
  const maxRelatedMemories = options.maxRelatedMemories ?? PROJECT_BRAIN_DEFAULT_RELATIONSHIP_RESULTS;
  if (!Number.isInteger(maxRelatedMemories) || maxRelatedMemories < 0 || maxRelatedMemories > PROJECT_BRAIN_MAX_RELATIONSHIP_RESULTS) throw new Error(`Project Brain maxRelatedMemories must be an integer from 0 to ${PROJECT_BRAIN_MAX_RELATIONSHIP_RESULTS}.`);
  const direction = options.direction ?? "both";
  if (direction !== "outgoing" && direction !== "incoming" && direction !== "both") throw new Error("Project Brain relationship direction is invalid.");
  if (options.includeCrossClass !== undefined && typeof options.includeCrossClass !== "boolean") throw new Error("Project Brain includeCrossClass must be a boolean.");
  return { maxRelatedMemories, direction, includeCrossClass: options.includeCrossClass ?? false };
}
function isContextEligible(memory: MemoryRecord): boolean { return memory.authority !== "archived" && memory.authority !== "superseded"; }
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

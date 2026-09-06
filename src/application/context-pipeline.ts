import { selectContextBudget, type ContextPriority, type ContextSection } from "./context-budget-manager";
import { optimizeContext, estimateTokens } from "./context-optimizer";
import { assembleProjectBrainContext, type ProjectBrainQuery } from "./project-brain";
import { assembleRelationshipAwareProjectBrainContext, type ProjectBrainRelationshipEvidence, type ProjectBrainRelationshipOptions } from "./project-brain-relationship-context";
import type { ProjectMemoryStore } from "./project-memory-store";
import type { MemoryRelationship } from "../domain/relationship-memory";
import type { MemoryRecord } from "../domain/memory";

export interface ProjectContextPipelineOptions {
  readonly budget?: number;
  readonly query: ProjectBrainQuery;
  readonly includeWorkingState?: boolean;
  readonly relationships?: readonly MemoryRelationship[];
  readonly relationshipOptions?: ProjectBrainRelationshipOptions;
}

export interface ProjectContextPipelineResult {
  readonly system: string;
  readonly user: string;
  readonly selectedMemoryIds: readonly string[];
  readonly omittedMemoryIds: readonly string[];
  readonly originalEstimatedTokens: number;
  readonly optimizedEstimatedTokens: number;
  readonly tokensSaved: number;
  readonly compressionRatio: number;
  readonly strategies: readonly string[];
}

function memoryPriority(authority: string): ContextPriority {
  if (authority === "authoritative") return "critical";
  if (authority === "verified") return "high";
  if (authority === "working" || authority === "proposed") return "normal";
  return "optional";
}

export function buildProjectContext(
  store: ProjectMemoryStore,
  options: ProjectContextPipelineOptions,
): ProjectContextPipelineResult {
  const query = {
    ...options.query,
    includeWorkingState: options.includeWorkingState ?? options.query.includeWorkingState,
  };
  const brain = options.relationships === undefined
    ? { ...assembleProjectBrainContext(store, query), relationshipEvidence: [] as readonly ProjectBrainRelationshipEvidence[] }
    : assembleRelationshipAwareProjectBrainContext(store, options.relationships, query, options.relationshipOptions);

  const all = [...brain.authoritative, ...brain.working, ...brain.changed];
  const uniqueById = new Map(all.map((memory) => [memory.id, memory]));
  const deduplicated = deduplicateMemories([...uniqueById.values()], brain.relationshipEvidence);
  const sections: ContextSection[] = deduplicated.memories.map((memory, index) => ({
    id: memory.id,
    priority: memoryPriority(memory.authority),
    order: index,
    content: [
      `[${memory.class} | ${memory.authority}] ${memory.summary}`,
      memory.content,
      `Provenance: ${formatProvenance(memory)}`,
      formatRelationshipEvidence(memory.id, brain.relationshipEvidence),
    ].filter(Boolean).join("\n"),
  }));

  const budgeted = selectContextBudget(sections, options.budget);
  const context = budgeted.sections.map((section) => section.content).join("\n\n");
  const originalSystem = "Project context:\n" + context;
  const originalUser = "Use the supplied project context faithfully.";
  const optimized = optimizeContext({ system: originalSystem, user: originalUser });
  const originalEstimatedTokens = budgeted.originalEstimatedTokens + estimateTokens(originalUser);
  const optimizedEstimatedTokens = optimized.optimizedEstimatedTokens;
  const tokensSaved = Math.max(0, originalEstimatedTokens - optimizedEstimatedTokens);
  const omittedMemoryIds = [...budgeted.omittedIds, ...deduplicated.duplicateMemoryIds]
    .filter((id, index, ids) => ids.indexOf(id) === index);

  return {
    system: optimized.system,
    user: optimized.user,
    selectedMemoryIds: budgeted.includedIds,
    omittedMemoryIds,
    originalEstimatedTokens,
    optimizedEstimatedTokens,
    tokensSaved,
    compressionRatio: originalEstimatedTokens === 0 ? 1 : optimizedEstimatedTokens / originalEstimatedTokens,
    strategies: [
      "project-brain-retrieval",
      "session-context-deduplication",
      ...(options.relationships === undefined ? [] : ["bounded-relationship-expansion"]),
      "priority-context-budget",
      "provenance-attached",
      ...optimized.strategy,
    ],
  };
}

function deduplicateMemories(
  memories: readonly MemoryRecord[],
  relationshipEvidence: readonly ProjectBrainRelationshipEvidence[],
): { readonly memories: MemoryRecord[]; readonly duplicateMemoryIds: string[] } {
  const seen = new Set<string>();
  const kept: MemoryRecord[] = [];
  const duplicateMemoryIds: string[] = [];
  for (const memory of memories) {
    const key = normalizeForDedup([
      memory.class,
      memory.authority,
      memory.content,
      formatRelationshipEvidence(memory.id, relationshipEvidence),
    ].filter(Boolean).join("\n"));
    if (seen.has(key)) {
      duplicateMemoryIds.push(memory.id);
      continue;
    }
    seen.add(key);
    kept.push(memory);
  }
  return { memories: kept, duplicateMemoryIds };
}

function normalizeForDedup(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function formatProvenance(memory: { readonly provenance: readonly { readonly kind: string; readonly reference: string }[] }): string {
  if (!memory.provenance.length) return "none recorded";
  return memory.provenance.map((item) => `${item.kind}:${item.reference}`).join(", ");
}
function formatRelationshipEvidence(memoryId: string, evidence: readonly ProjectBrainRelationshipEvidence[]): string {
  const related = evidence.filter((item) => item.memoryId === memoryId);
  if (!related.length) return "";
  return "Relationship context: " + related.map((item) => {
    const direction = item.direction === "outgoing" ? `${item.seedMemoryId} -> ${memoryId}` : `${memoryId} -> ${item.seedMemoryId}`;
    return `[${item.relationshipId}] ${direction} (${item.relation}): ${item.context}${item.significance ? `; significance: ${item.significance}` : ""}`;
  }).join(" | ");
}

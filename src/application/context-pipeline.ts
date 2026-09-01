import { selectContextBudget, type ContextPriority, type ContextSection } from "./context-budget-manager";
import { optimizeContext, estimateTokens } from "./context-optimizer";
import { assembleProjectBrainContext, type ProjectBrainQuery } from "./project-brain";
import type { ProjectMemoryStore } from "./project-memory-store";
import type { MemoryRecord } from "../domain/memory";

export interface ProjectContextPipelineOptions {
  readonly budget?: number;
  readonly query: ProjectBrainQuery;
  readonly includeWorkingState?: boolean;
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
  const brain = assembleProjectBrainContext(store, {
    ...options.query,
    includeWorkingState: options.includeWorkingState ?? options.query.includeWorkingState,
  });

  const all = [...brain.authoritative, ...brain.working, ...brain.changed];
  const uniqueById = new Map(all.map((memory) => [memory.id, memory]));
  const deduplicated = deduplicateMemoryPayloads([...uniqueById.values()]);
  const sections: ContextSection[] = deduplicated.memories.map((memory, index) => ({
    id: memory.id,
    priority: memoryPriority(memory.authority),
    order: index,
    content: `[${memory.class} | ${memory.authority}] ${memory.summary}\n${memory.content}`,
  }));

  const budgeted = selectContextBudget(sections, options.budget);
  const context = budgeted.sections.map((section) => section.content).join("\n\n");
  const originalSystem = "Project context:\n" + context;
  const originalUser = "Use the supplied project context faithfully.";
  const optimized = optimizeContext({ system: originalSystem, user: originalUser });
  const originalEstimatedTokens = estimateTokens(originalSystem) + estimateTokens(originalUser);
  const omittedMemoryIds = [...budgeted.omittedIds, ...deduplicated.duplicateMemoryIds]
    .filter((id, index, ids) => ids.indexOf(id) === index);

  return {
    system: optimized.system,
    user: optimized.user,
    selectedMemoryIds: budgeted.includedIds,
    omittedMemoryIds,
    originalEstimatedTokens,
    optimizedEstimatedTokens: optimized.optimizedEstimatedTokens,
    tokensSaved: optimized.tokensSaved + budgeted.tokensSaved,
    compressionRatio: optimized.compressionRatio,
    strategies: ["project-brain-retrieval", ...(deduplicated.duplicateMemoryIds.length ? ["normalized-memory-deduplication"] : []), "priority-context-budget", ...optimized.strategy],
  };
}

interface DeduplicatedMemoryPayloads {
  readonly memories: readonly MemoryRecord[];
  readonly duplicateMemoryIds: readonly string[];
}

/**
 * Removes repeated memory payloads before token budgeting. Project Brain supplies
 * authoritative records before working/changed records, so the first copy keeps
 * the strongest authority while lower-authority duplicate payloads are omitted.
 * Class remains part of the fingerprint because the same text can carry different
 * semantic meaning in distinct memory domains.
 */
function deduplicateMemoryPayloads(memories: readonly MemoryRecord[]): DeduplicatedMemoryPayloads {
  const fingerprints = new Set<string>();
  const selected: MemoryRecord[] = [];
  const duplicateMemoryIds: string[] = [];
  for (const memory of memories) {
    const normalizedContent = memory.content.trim().replace(/\s+/g, " ").toLocaleLowerCase();
    const fingerprint = `${memory.class}\u0000${normalizedContent}`;
    if (fingerprints.has(fingerprint)) {
      duplicateMemoryIds.push(memory.id);
      continue;
    }
    fingerprints.add(fingerprint);
    selected.push(memory);
  }
  return { memories: selected, duplicateMemoryIds };
}

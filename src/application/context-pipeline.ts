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
  const sourceMemories = [...uniqueById.values()];
  const rawSystem = createProjectContextSystem(sourceMemories.map(renderMemoryContext));
  const user = "Use the supplied project context faithfully.";
  const deduplicated = deduplicateMemoryPayloads(sourceMemories);
  const sections: ContextSection[] = deduplicated.memories.map((memory, index) => ({
    id: memory.id,
    priority: memoryPriority(memory.authority),
    order: index,
    content: renderMemoryContext(memory),
  }));

  const budgeted = selectContextBudget(sections, options.budget);
  const selectedSystem = createProjectContextSystem(budgeted.sections.map((section) => section.content));
  const optimized = optimizeContext({ system: selectedSystem, user });
  const originalEstimatedTokens = estimateTokens(rawSystem) + estimateTokens(user);
  const optimizedEstimatedTokens = optimized.optimizedEstimatedTokens;
  const tokensSaved = Math.max(0, originalEstimatedTokens - optimizedEstimatedTokens);
  const compressionRatio = originalEstimatedTokens > 0 ? optimizedEstimatedTokens / originalEstimatedTokens : 1;
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
    compressionRatio,
    strategies: ["project-brain-retrieval", ...(deduplicated.duplicateMemoryIds.length ? ["normalized-memory-deduplication"] : []), "priority-context-budget", ...(budgeted.constrained ? ["context-budget-constrained"] : []), ...optimized.strategy],
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

function renderMemoryContext(memory: MemoryRecord): string {
  return `[${memory.class} | ${memory.authority}] ${memory.summary}\n${memory.content}`;
}

function createProjectContextSystem(sections: readonly string[]): string {
  return `Project context:\n${sections.join("\n\n")}`;
}

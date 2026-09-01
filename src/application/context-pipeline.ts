import { selectContextBudget, type ContextPriority, type ContextSection } from "./context-budget-manager";
import { optimizeContext, estimateTokens } from "./context-optimizer";
import { assembleProjectBrainContext, type ProjectBrainQuery } from "./project-brain";
import type { ProjectMemoryStore } from "./project-memory-store";

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
  const unique = new Map(all.map((memory) => [memory.id, memory]));
  const sections: ContextSection[] = [...unique.values()].map((memory, index) => ({
    id: memory.id,
    priority: memoryPriority(memory.authority),
    order: index,
    content: `[${memory.class} | ${memory.authority}] ${memory.summary}\n${memory.content}\nProvenance: ${formatProvenance(memory)}`,
  }));

  const budgeted = selectContextBudget(sections, options.budget);
  const context = budgeted.sections.map((section) => section.content).join("\n\n");
  const originalSystem = "Project context:\n" + context;
  const originalUser = "Use the supplied project context faithfully.";
  const optimized = optimizeContext({ system: originalSystem, user: originalUser });
  // Report savings against the complete pre-budget context, not only the
  // already-trimmed payload sent to the optimizer.
  const originalEstimatedTokens = budgeted.originalEstimatedTokens + estimateTokens(originalUser);
  const optimizedEstimatedTokens = optimized.optimizedEstimatedTokens;
  const tokensSaved = Math.max(0, originalEstimatedTokens - optimizedEstimatedTokens);

  return {
    system: optimized.system,
    user: optimized.user,
    selectedMemoryIds: budgeted.includedIds,
    omittedMemoryIds: budgeted.omittedIds,
    originalEstimatedTokens,
    optimizedEstimatedTokens,
    tokensSaved,
    compressionRatio: originalEstimatedTokens === 0 ? 1 : optimizedEstimatedTokens / originalEstimatedTokens,
    strategies: ["project-brain-retrieval", "priority-context-budget", "provenance-attached", ...optimized.strategy],
  };
}


function formatProvenance(memory: { readonly provenance: readonly { readonly kind: string; readonly reference: string }[] }): string {
  if (!memory.provenance.length) return "none recorded";
  return memory.provenance.map((item) => `${item.kind}:${item.reference}`).join(", ");
}

import { deduplicateContextFragments } from "./context-governance";
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
  const fragments = [...unique.values()].map((memory) => ({
    id: memory.id,
    text: `[${memory.class} | ${memory.authority}] ${memory.summary}\n${memory.content}`,
    tier: memory.authority === "authoritative" ? "essential" : memory.authority === "verified" ? "project" : memory.authority === "working" || memory.authority === "proposed" ? "active" : "historical",
    priority: memory.authority === "authoritative" ? 100 : memory.authority === "verified" ? 80 : 50,
    canonical: memory.authority === "authoritative",
  })) as Array<{ id: string; text: string; tier: "essential" | "project" | "active" | "supporting" | "historical"; priority: number; canonical?: boolean }>;

  const deduplicated = deduplicateContextFragments(fragments);
  const sections: ContextSection[] = deduplicated.fragments.map((fragment, index) => ({
    id: fragment.id,
    priority: memoryPriority(unique.get(fragment.id)?.authority ?? "archived"),
    order: index,
    content: fragment.text,
  }));

  const budgeted = selectContextBudget(sections, options.budget);
  const context = budgeted.sections.map((section) => section.content).join("\n\n");
  const originalSystem = "Project context:\n" + context;
  const originalUser = "Use the supplied project context faithfully.";
  const optimized = optimizeContext({ system: originalSystem, user: originalUser });
  const originalEstimatedTokens = estimateTokens(originalSystem) + estimateTokens(originalUser);

  const omittedMemoryIds = [...budgeted.omittedIds, ...deduplicated.duplicateFragmentIds]
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
    strategies: ["project-brain-retrieval", "session-context-deduplication", "priority-context-budget", ...optimized.strategy],
  };
}

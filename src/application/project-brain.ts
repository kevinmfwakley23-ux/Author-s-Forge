import type { MemoryClass, MemoryRecord } from "../domain/memory";
import type { ProjectMemoryStore } from "./project-memory-store";

export interface ProjectBrainQuery {
  readonly projectId: string;
  readonly taskMemoryClasses?: readonly MemoryClass[];
  readonly relevanceTags?: readonly string[];
  readonly includeWorkingState?: boolean;
  readonly changedSince?: string;
  readonly limit?: number;
}

export interface ProjectBrainContext {
  readonly projectId: string;
  readonly authoritative: readonly MemoryRecord[];
  readonly working: readonly MemoryRecord[];
  readonly changed: readonly MemoryRecord[];
}

export function assembleProjectBrainContext(store: ProjectMemoryStore, query: ProjectBrainQuery): ProjectBrainContext {
  const base = {
    projectId: query.projectId,
    relevanceTags: query.relevanceTags,
    changedSince: query.changedSince
  };

  const classFilter = query.taskMemoryClasses;
  const filterClasses = (memory: MemoryRecord): boolean => classFilter === undefined || classFilter.includes(memory.class);

  const authoritative = store.query({
    ...base,
    authoritativeOnly: true,
    limit: query.limit
  }).filter(filterClasses);

  const working = query.includeWorkingState
    ? store.query({ ...base, limit: query.limit }).filter((memory) => {
        if (!filterClasses(memory)) return false;
        return memory.authority === "proposed" || memory.authority === "working" || memory.authority === "verified";
      })
    : [];

  const changed = store.query({
    projectId: query.projectId,
    relevanceTags: query.relevanceTags,
    changedSince: query.changedSince,
    limit: query.limit
  }).filter(filterClasses);

  return { projectId: query.projectId, authoritative, working, changed };
}

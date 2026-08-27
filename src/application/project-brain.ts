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
  if (!query.projectId.trim()) throw new Error("Project Brain project id is required.");
  if (query.limit !== undefined && (!Number.isInteger(query.limit) || query.limit < 0)) throw new Error("Project Brain limit must be a non-negative integer.");

  const classFilter = query.taskMemoryClasses;
  const filterClasses = (memory: MemoryRecord): boolean => classFilter === undefined || classFilter.includes(memory.class);
  const take = <T>(items: T[]): T[] => items.slice(0, query.limit ?? Number.MAX_SAFE_INTEGER);
  const base = { projectId: query.projectId, relevanceTags: query.relevanceTags, changedSince: query.changedSince };

  const authoritative = take(store.query({ ...base, authoritativeOnly: true }).filter(filterClasses));
  const working = query.includeWorkingState
    ? take(store.query(base).filter((memory) => filterClasses(memory) && (memory.authority === "proposed" || memory.authority === "working" || memory.authority === "verified")))
    : [];
  const changed = take(store.query(base).filter(filterClasses));

  return { projectId: query.projectId, authoritative, working, changed };
}

import type { MemoryClass, MemoryRecord } from "../domain/memory";
import type { ProjectMemoryStore } from "../application/project-memory-store";

export interface ProjectBrainQuery {
  readonly projectId: string;
  readonly taskMemoryClasses?: readonly MemoryClass[];
  readonly includeWorkingState?: boolean;
  readonly limit?: number;
}

export interface ProjectBrainContext {
  readonly projectId: string;
  readonly authoritative: readonly MemoryRecord[];
  readonly working: readonly MemoryRecord[];
}

export function assembleProjectBrainContext(
  store: ProjectMemoryStore,
  query: ProjectBrainQuery
): ProjectBrainContext {
  const authoritative = store.query({
    projectId: query.projectId,
    authoritativeOnly: true,
    limit: query.limit
  });

  const working = query.includeWorkingState
    ? store
        .query({ projectId: query.projectId, limit: query.limit })
        .filter((memory) => {
          if (memory.authority === "authoritative") return false;
          return query.taskMemoryClasses === undefined || query.taskMemoryClasses.includes(memory.class);
        })
    : [];

  return {
    projectId: query.projectId,
    authoritative,
    working
  };
}

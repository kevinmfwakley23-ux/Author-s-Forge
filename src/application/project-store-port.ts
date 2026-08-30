import type { ProjectState } from "../domain/project";

/**
 * Shared durable-project boundary owned by Forge Core.
 * Infrastructure adapters (filesystem, cloud, future providers) implement this contract.
 */
export interface ProjectStorePort {
  create(project: ProjectState): Promise<void>;
  load(projectId: string): Promise<ProjectState | null>;
  save(project: ProjectState): Promise<void>;
  exists(projectId: string): Promise<boolean>;
}

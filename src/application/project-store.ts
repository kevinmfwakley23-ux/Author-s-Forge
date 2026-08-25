import type { ProjectState } from "../domain/project";

export interface ProjectStore {
  create(project: ProjectState): Promise<void>;
  load(projectId: string): Promise<ProjectState | null>;
  save(project: ProjectState): Promise<void>;
  exists(projectId: string): Promise<boolean>;
}

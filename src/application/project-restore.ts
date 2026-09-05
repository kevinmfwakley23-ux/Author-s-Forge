import type { ProjectState } from "../domain/project";
import { validateStudioWorkspace, type StudioWorkspaceState } from "../domain/studio-workspace";
import type { ForgeProjectPackage } from "../domain/project-package";
import { ProjectPackageService } from "./project-package";
import { FileProjectStore } from "../infrastructure/file-project-store";

type PortableProjectState = {
  project: ProjectState;
  studioWorkspace?: StudioWorkspaceState;
};

export interface ProjectRestoreResult {
  projectId: string;
  restored: true;
  hadWorkspace: boolean;
}

/**
 * Restores a validated Forge project package into durable local project storage.
 * The package id must match the requested target id; no cross-project restore is permitted.
 */
export class ProjectRestoreService {
  public constructor(
    private readonly packages = new ProjectPackageService(),
  ) {}

  public async restoreSnapshot(input: {
    targetProjectId: string;
    pkg: ForgeProjectPackage;
    store: FileProjectStore;
  }): Promise<ProjectRestoreResult> {
    const targetProjectId = input.targetProjectId.trim();
    if (!targetProjectId) throw new Error("Restore target project id is required.");

    const restored = this.packages.restoreSnapshot(input.pkg, targetProjectId);
    if (!restored || typeof restored !== "object" || Array.isArray(restored)) {
      throw new Error("Forge project snapshot has an invalid root shape.");
    }

    const state = restored as Record<string, unknown>;
    const projectValue = state.project;
    if (!projectValue || typeof projectValue !== "object" || Array.isArray(projectValue)) {
      throw new Error("Forge project snapshot does not contain a project state.");
    }

    const project = projectValue as ProjectState;
    if (project.metadata?.id !== targetProjectId) {
      throw new Error("Forge project snapshot metadata id does not match the restore target.");
    }
    if (!Array.isArray(project.memories)) {
      throw new Error("Forge project snapshot contains invalid memory state.");
    }

    const workspaceValue = state.studioWorkspace;
    const workspace = workspaceValue === undefined
      ? undefined
      : validateStudioWorkspace(workspaceValue);

    if (workspace) {
      for (const book of workspace.books) {
        for (const chapter of book.chapters) {
          for (const scene of chapter.scenes) {
            if (!Number.isInteger(scene.number) || scene.number < 1) {
              throw new Error("Forge project snapshot contains an invalid scene number.");
            }
          }
        }
      }
    }

    await input.store.save({
      ...project,
      studioWorkspace: workspace,
    } as ProjectState);

    const persisted = await input.store.load(targetProjectId);
    if (!persisted || persisted.metadata.id !== targetProjectId) {
      throw new Error("Forge project restore could not be verified after persistence.");
    }

    return {
      projectId: targetProjectId,
      restored: true,
      hadWorkspace: workspace !== undefined,
    };
  }
}

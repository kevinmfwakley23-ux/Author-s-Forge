import type { ProjectState } from "../domain/project";
import { createStudioWorkspace, validateStudioWorkspace } from "../domain/studio-workspace";
import type { ForgeProjectPackage } from "../domain/project-package";
import { FileProjectStore } from "../infrastructure/file-project-store";
import { ProjectPackageService } from "./project-package";

export interface StudioProjectRecoveryResult {
  readonly projectId: string;
  readonly restored: ProjectState;
  readonly rollbackPackage: ForgeProjectPackage;
}

export class StudioProjectRecoveryService {
  public constructor(
    private readonly store: FileProjectStore,
    private readonly packages = new ProjectPackageService(),
  ) {}

  public async restoreExisting(
    projectId: string,
    pkg: ForgeProjectPackage,
    rollbackExportedAt = new Date().toISOString(),
  ): Promise<StudioProjectRecoveryResult> {
    if (typeof projectId !== "string" || !projectId.trim()) throw new Error("Project id is required for recovery.");
    const existing = await this.store.load(projectId);
    if (!existing) throw new Error(`Project "${projectId}" does not exist and cannot be restored in place.`);

    const restored = this.packages.restoreStudioSnapshot(pkg, projectId);
    const existingWorkspace = existing.studioWorkspace
      ? validateStudioWorkspace(existing.studioWorkspace)
      : createStudioWorkspace();
    const rollbackPackage = this.packages.exportStudioSnapshot({
      projectId,
      project: existing,
      studioWorkspace: existingWorkspace,
      exportedAt: rollbackExportedAt,
    });

    await this.store.save(restored);
    const persisted = await this.store.load(projectId);
    if (!persisted) throw new Error(`Project "${projectId}" disappeared after recovery save.`);

    return {
      projectId,
      restored: persisted,
      rollbackPackage,
    };
  }
}

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ForgeProjectPackage } from "../domain/project-package";
import { ProjectPackageService } from "./project-package";
import { ProjectRestoreService, type ProjectRestoreResult } from "./project-restore";
import { FileProjectStore } from "../infrastructure/file-project-store";

type PersistedProject = Awaited<ReturnType<FileProjectStore["load"]>> & {
  studioWorkspace?: unknown;
};

export interface RecoveryPlan {
  targetProjectId: string;
  packageProjectId: string;
  targetExists: boolean;
  requiresOverwriteApproval: boolean;
}

export interface RecoveryResult extends ProjectRestoreResult {
  overwritten: boolean;
  backupPath?: string;
}

/**
 * Author-controlled recovery coordinator. Planning is side-effect free; restore
 * requires explicit overwrite approval when a target already exists and creates
 * a durable serialized backup before replacing it.
 */
export class ProjectRecoveryService {
  public constructor(
    private readonly packages = new ProjectPackageService(),
    private readonly restore = new ProjectRestoreService(packages),
  ) {}

  public async plan(input: {
    targetProjectId: string;
    pkg: ForgeProjectPackage;
    store: FileProjectStore;
  }): Promise<RecoveryPlan> {
    const targetProjectId = input.targetProjectId.trim();
    if (!targetProjectId) throw new Error("Recovery target project id is required.");
    const validated = this.packages.validate(input.pkg);
    if (validated.manifest.projectId !== targetProjectId) {
      throw new Error("Project package id does not match the recovery target.");
    }
    return {
      targetProjectId,
      packageProjectId: validated.manifest.projectId,
      targetExists: await input.store.exists(targetProjectId),
      requiresOverwriteApproval: await input.store.exists(targetProjectId),
    };
  }

  public async restore(input: {
    targetProjectId: string;
    pkg: ForgeProjectPackage;
    store: FileProjectStore;
    backupDirectory: string;
    allowOverwrite?: boolean;
  }): Promise<RecoveryResult> {
    const plan = await this.plan(input);
    if (plan.targetExists && input.allowOverwrite !== true) {
      throw new Error("Recovery target already exists. Explicit overwrite approval is required.");
    }

    let backupPath: string | undefined;
    if (plan.targetExists) {
      const current = await input.store.load(plan.targetProjectId) as PersistedProject | null;
      if (!current) throw new Error("Recovery target disappeared before backup preparation.");
      const backup = this.packages.exportSnapshot({
        projectId: plan.targetProjectId,
        projectState: {
          project: current,
          ...(current.studioWorkspace === undefined ? {} : { studioWorkspace: current.studioWorkspace }),
        },
      });
      const safeDirectory = input.backupDirectory.trim();
      if (!safeDirectory) throw new Error("Recovery backup directory is required for overwrite restores.");
      await mkdir(safeDirectory, { recursive: true });
      backupPath = join(safeDirectory, `${plan.targetProjectId}-${backup.manifest.exportedAt.replace(/[:.]/g, "-")}.forge-project.json`);
      await writeFile(backupPath, this.packages.serialize(backup), "utf8");
    }

    const restored = await this.restore.restoreSnapshot(input);
    return {
      ...restored,
      overwritten: plan.targetExists,
      ...(backupPath === undefined ? {} : { backupPath }),
    };
  }
}

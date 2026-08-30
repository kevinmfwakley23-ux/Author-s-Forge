import type { ForgeProjectPackage } from "../domain/project-package";
import { ProjectPackageService } from "./project-package";
import { ProjectRestoreService, type ProjectRestoreResult } from "./project-restore";
import { FileProjectStore } from "../infrastructure/file-project-store";
import { FileProjectRecoveryBackupStore } from "../infrastructure/file-project-recovery-backup-store";

export interface ProjectRestorePlan {
  targetProjectId: string;
  targetExists: boolean;
  requiresOverwriteApproval: boolean;
  backupRequired: boolean;
}

export interface SafeProjectRestoreResult extends ProjectRestoreResult {
  overwritten: boolean;
  backupId?: string;
}

/**
 * Recovery guardrail: inspect first, require explicit approval for mutation of
 * an existing project, and create a durable backup immediately before replace.
 */
export class ProjectRestoreSafetyService {
  public constructor(
    private readonly restore = new ProjectRestoreService(),
    private readonly packages = new ProjectPackageService(),
  ) {}

  public async plan(input: { targetProjectId: string; store: FileProjectStore }): Promise<ProjectRestorePlan> {
    const targetProjectId = input.targetProjectId.trim();
    if (!targetProjectId) throw new Error("Restore target project id is required.");
    const targetExists = await input.store.exists(targetProjectId);
    return {
      targetProjectId,
      targetExists,
      requiresOverwriteApproval: targetExists,
      backupRequired: targetExists,
    };
  }

  public async restore(input: {
    targetProjectId: string;
    pkg: ForgeProjectPackage;
    store: FileProjectStore;
    backupStore: FileProjectRecoveryBackupStore;
    approveOverwrite?: boolean;
  }): Promise<SafeProjectRestoreResult> {
    const plan = await this.plan(input);
    if (plan.targetExists && input.approveOverwrite !== true) {
      throw new Error("Restore target already exists; explicit overwrite approval is required.");
    }

    let backupId: string | undefined;
    if (plan.targetExists) {
      const existing = await input.store.load(plan.targetProjectId);
      if (!existing) throw new Error("Restore target disappeared before backup could be created.");
      backupId = `recovery-${plan.targetProjectId}-${Date.now()}`;
      await input.backupStore.save(existing, backupId);
    }

    const result = await this.restore.restoreSnapshot({
      targetProjectId: plan.targetProjectId,
      pkg: this.packages.validate(input.pkg),
      store: input.store,
    });

    return { ...result, overwritten: plan.targetExists, ...(backupId ? { backupId } : {}) };
  }
}

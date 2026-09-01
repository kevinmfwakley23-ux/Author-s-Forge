import { createProjectStorageBinding, validateForgeProjectId } from "../domain/external-storage";
import { FileProjectStore } from "../infrastructure/file-project-store";
import { LocalFileStorageProvider } from "../infrastructure/local-storage-provider";
import { ExternalStorageService } from "./external-storage";
import { ProjectPackageService } from "./project-package";
import { ProjectPackageBackupService } from "./project-package-backup";
import { StudioProjectRecoveryService, type StudioProjectRecoveryResult } from "./studio-project-recovery";

export class StudioProjectBackupVault {
  private readonly backups: ProjectPackageBackupService;
  private readonly recovery: StudioProjectRecoveryService;

  public constructor(
    store: FileProjectStore,
    rootDirectory: string,
    packages = new ProjectPackageService(),
  ) {
    if (typeof rootDirectory !== "string" || !rootDirectory.trim()) throw new Error("Studio backup vault directory is required.");
    const storage = new ExternalStorageService(new LocalFileStorageProvider(rootDirectory));
    this.backups = new ProjectPackageBackupService(store, storage, packages);
    this.recovery = new StudioProjectRecoveryService(store, packages);
  }

  public async create(projectId: string, input: unknown = {}) {
    const id = validateForgeProjectId(projectId);
    const request = objectInput(input, "Project backup request");
    const exportedAt = optionalTimestamp(request.exportedAt, "Project backup exportedAt");
    const backupId = optionalText(request.backupId, "Project backup id");
    return this.backups.backupExisting(id, this.binding(id), exportedAt, backupId);
  }

  public async list(projectId: string) {
    const id = validateForgeProjectId(projectId);
    return this.backups.listBackups(id, this.binding(id));
  }

  public async preview(projectId: string, input: unknown) {
    const id = validateForgeProjectId(projectId);
    const request = objectInput(input, "Project backup preview request");
    return this.backups.previewBackup(id, this.binding(id), requiredText(request.key, "Project backup key"));
  }

  public async restore(projectId: string, input: unknown): Promise<StudioProjectRecoveryResult> {
    const id = validateForgeProjectId(projectId);
    const request = objectInput(input, "Project backup restore request");
    if (request.authorApproved !== true) throw new Error("Explicit author approval is required before restoring a project backup.");
    const key = requiredText(request.key, "Project backup key");
    const rollbackExportedAt = optionalTimestamp(request.rollbackExportedAt, "Recovery rollbackExportedAt");
    const preview = await this.backups.previewBackup(id, this.binding(id), key);
    return this.recovery.restoreExisting(id, preview.package, rollbackExportedAt);
  }

  public async delete(projectId: string, input: unknown): Promise<{ readonly projectId: string; readonly key: string; readonly deleted: true }> {
    const id = validateForgeProjectId(projectId);
    const request = objectInput(input, "Project backup delete request");
    if (request.authorApproved !== true) throw new Error("Explicit author approval is required before deleting a project backup.");
    const key = requiredText(request.key, "Project backup key");
    const preview = await this.backups.previewBackup(id, this.binding(id), key);
    await this.backups.deleteBackup(id, this.binding(id), preview.key);
    return { projectId: id, key: preview.key, deleted: true };
  }

  private binding(projectId: string) {
    return createProjectStorageBinding({ projectId, providerId: "local" });
  }
}

function objectInput(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a JSON object.`);
  return value as Record<string, unknown>;
}

function requiredText(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function optionalText(value: unknown, label: string): string | undefined {
  return value === undefined ? undefined : requiredText(value, label);
}

function optionalTimestamp(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined;
  const text = requiredText(value, label);
  if (Number.isNaN(Date.parse(text))) throw new Error(`${label} must be a valid timestamp.`);
  return new Date(Date.parse(text)).toISOString();
}

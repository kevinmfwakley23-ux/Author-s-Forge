import { randomUUID } from "node:crypto";
import { createDownloadableProjectPackageFilename, normalizeStorageKey, validateForgeProjectId } from "../domain/external-storage";
import type { ProjectStorageBinding, StoredObject } from "../domain/external-storage";
import type { ProjectState } from "../domain/project";
import type { ForgeProjectPackage } from "../domain/project-package";
import { createStudioWorkspace, validateStudioWorkspace } from "../domain/studio-workspace";
import { FileProjectStore } from "../infrastructure/file-project-store";
import { ExternalStorageService } from "./external-storage";
import { ProjectPackageService } from "./project-package";

export interface ProjectPackageBackupEntry {
  readonly key: string;
  readonly size: number;
  readonly mediaType: string;
  readonly updatedAt: string;
  readonly etag?: string;
}

export interface ProjectPackageBackupResult {
  readonly projectId: string;
  readonly backupId: string;
  readonly key: string;
  readonly stored: ProjectPackageBackupEntry;
  readonly package: ForgeProjectPackage;
}

export interface ProjectPackageBackupPreview {
  readonly projectId: string;
  readonly key: string;
  readonly package: ForgeProjectPackage;
  readonly project: ProjectState;
}

export class ProjectPackageBackupService {
  public constructor(
    private readonly store: FileProjectStore,
    private readonly storage: ExternalStorageService,
    private readonly packages = new ProjectPackageService(),
  ) {}

  public async backupExisting(
    projectId: string,
    binding: ProjectStorageBinding,
    exportedAt = new Date().toISOString(),
    backupId = randomUUID(),
  ): Promise<ProjectPackageBackupResult> {
    const validatedProjectId = validateForgeProjectId(projectId);
    const validatedBinding = this.bindingForProject(validatedProjectId, binding);
    const normalizedBackupId = validateForgeProjectId(backupId, "Backup id");
    const timestamp = normalizedTimestamp(exportedAt, "Backup exportedAt");
    const project = await this.store.load(validatedProjectId);
    if (!project) throw new Error(`Project "${validatedProjectId}" does not exist and cannot be backed up.`);

    const studioWorkspace = project.studioWorkspace
      ? validateStudioWorkspace(project.studioWorkspace)
      : createStudioWorkspace();
    const pkg = this.packages.exportStudioSnapshot({
      projectId: validatedProjectId,
      project,
      studioWorkspace,
      exportedAt: timestamp,
    });
    const key = backupKey(validatedProjectId, timestamp, normalizedBackupId);
    const existing = await this.storage.list(validatedBinding, key);
    if (existing.length) throw new Error(`Forge project backup "${key}" already exists; backups are never overwritten.`);
    const serialized = this.packages.serialize(pkg);
    const stored = await this.storage.put(validatedBinding, key, new TextEncoder().encode(serialized), "application/json");

    return {
      projectId: validatedProjectId,
      backupId: normalizedBackupId,
      key,
      stored: relativeStoredObject(validatedBinding, stored),
      package: pkg,
    };
  }

  public async listBackups(projectId: string, binding: ProjectStorageBinding): Promise<readonly ProjectPackageBackupEntry[]> {
    const validatedProjectId = validateForgeProjectId(projectId);
    const validatedBinding = this.bindingForProject(validatedProjectId, binding);
    const objects = await this.storage.list(validatedBinding, "backups");
    return objects
      .map((item) => relativeStoredObject(validatedBinding, item))
      .filter((item) => isBackupObjectKey(item.key))
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt) || left.key.localeCompare(right.key));
  }

  public async previewBackup(projectId: string, binding: ProjectStorageBinding, key: string): Promise<ProjectPackageBackupPreview> {
    const validatedProjectId = validateForgeProjectId(projectId);
    const validatedBinding = this.bindingForProject(validatedProjectId, binding);
    const normalizedKey = backupObjectKey(key);
    const bytes = await this.storage.get(validatedBinding, normalizedKey);
    let serialized: string;
    try {
      serialized = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new Error("Stored Forge project backup is not valid UTF-8 text.");
    }
    const pkg = this.packages.import(serialized);
    const project = this.packages.restoreStudioSnapshot(pkg, validatedProjectId);
    return { projectId: validatedProjectId, key: normalizedKey, package: pkg, project };
  }

  public async deleteBackup(projectId: string, binding: ProjectStorageBinding, key: string): Promise<void> {
    const validatedProjectId = validateForgeProjectId(projectId);
    const validatedBinding = this.bindingForProject(validatedProjectId, binding);
    await this.storage.delete(validatedBinding, backupObjectKey(key));
  }

  private bindingForProject(projectId: string, binding: ProjectStorageBinding): ProjectStorageBinding {
    const validated = this.storage.bind(binding);
    if (validated.projectId !== projectId) throw new Error("Project storage binding does not match the requested project.");
    return validated;
  }
}

function backupKey(projectId: string, exportedAt: string, backupId: string): string {
  const compactTimestamp = exportedAt.replace(/[-:.]/g, "");
  return `backups/${compactTimestamp}-${backupId}-${createDownloadableProjectPackageFilename(projectId)}`;
}

function isBackupObjectKey(key: string): boolean {
  return key.startsWith("backups/") && key.endsWith(".forge-project.json");
}

function backupObjectKey(value: unknown): string {
  const key = normalizeStorageKey(value, "Project backup key");
  if (!isBackupObjectKey(key)) throw new Error("Project backup key must reference a Forge backup object under backups/.");
  return key;
}

function relativeStoredObject(binding: ProjectStorageBinding, stored: StoredObject): ProjectPackageBackupEntry {
  const prefix = `${binding.keyPrefix}/`;
  if (!stored.key.startsWith(prefix)) throw new Error("Stored backup metadata is outside the project storage namespace.");
  const key = normalizeStorageKey(stored.key.slice(prefix.length), "Stored backup key");
  return stored.etag === undefined
    ? { key, size: stored.size, mediaType: stored.mediaType, updatedAt: stored.updatedAt }
    : { key, size: stored.size, mediaType: stored.mediaType, updatedAt: stored.updatedAt, etag: stored.etag };
}

function normalizedTimestamp(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  const instant = Date.parse(value);
  if (Number.isNaN(instant)) throw new Error(`${label} must be a valid timestamp.`);
  return new Date(instant).toISOString();
}

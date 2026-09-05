import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ProjectState } from "../domain/project";

/** Durable, append-only backup storage for recovery operations. */
export class FileProjectRecoveryBackupStore {
  public constructor(private readonly rootDirectory: string) {}

  public async save(project: ProjectState, backupId: string): Promise<string> {
    if (!/^[a-zA-Z0-9_-]+$/.test(backupId)) {
      throw new Error("Recovery backup id contains unsupported path characters.");
    }
    const path = join(this.rootDirectory, "backups", `${backupId}.json`);
    await mkdir(join(this.rootDirectory, "backups"), { recursive: true });
    await writeFile(path, `${JSON.stringify(project, null, 2)}\n`, "utf8");
    return path;
  }

  public async load(backupId: string): Promise<ProjectState | null> {
    if (!/^[a-zA-Z0-9_-]+$/.test(backupId)) {
      throw new Error("Recovery backup id contains unsupported path characters.");
    }
    try {
      return JSON.parse(await readFile(join(this.rootDirectory, "backups", `${backupId}.json`), "utf8")) as ProjectState;
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT") return null;
      throw error;
    }
  }
}

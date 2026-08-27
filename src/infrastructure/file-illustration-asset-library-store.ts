import { mkdir, readFile, rename, writeFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { validateIllustrationAssetLibraryState, type IllustrationAssetLibraryState } from "../domain/illustration-asset-library";

export class FileIllustrationAssetLibraryStore {
  public constructor(private readonly rootDirectory: string) {}
  public async save(state: IllustrationAssetLibraryState): Promise<void> { const validated = validateIllustrationAssetLibraryState(state); const path = this.path(validated.projectId); await mkdir(dirname(path), { recursive: true }); const temporaryPath = `${path}.tmp`; await writeFile(temporaryPath, `${JSON.stringify(validated, null, 2)}\n`, "utf8"); await rename(temporaryPath, path); }
  public async load(projectId: string): Promise<IllustrationAssetLibraryState | null> { this.assertProjectId(projectId); try { const parsed: unknown = JSON.parse(await readFile(this.path(projectId), "utf8")); return validateIllustrationAssetLibraryState(parsed); } catch (error) { if (isMissingFile(error)) return null; throw error; } }
  public async exists(projectId: string): Promise<boolean> { this.assertProjectId(projectId); try { await access(this.path(projectId)); return true; } catch (error) { if (isMissingFile(error)) return false; throw error; } }
  private path(projectId: string): string { this.assertProjectId(projectId); return join(this.rootDirectory, "projects", projectId, "illustration-assets.json"); }
  private assertProjectId(projectId: string): void { if (!/^[a-zA-Z0-9_-]+$/.test(projectId)) throw new Error("Project id contains unsupported path characters."); }
}
function isMissingFile(error: unknown): boolean { return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT"; }

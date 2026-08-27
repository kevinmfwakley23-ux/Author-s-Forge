import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { VisualCharacterIdentity } from "../domain/character-visual-continuity";
import { validateVisualCharacterIdentity } from "../domain/character-visual-continuity";

export class FileVisualIdentityStore {
  public constructor(private readonly rootDirectory: string) {}

  public async save(projectId: string, identities: readonly VisualCharacterIdentity[]): Promise<void> {
    this.assertProjectId(projectId);
    const validated = this.validateCollection(projectId, identities);
    const path = this.identityPath(projectId);
    await mkdir(dirname(path), { recursive: true });
    const temporaryPath = `${path}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
    await rename(temporaryPath, path);
  }

  public async load(projectId: string): Promise<readonly VisualCharacterIdentity[]> {
    this.assertProjectId(projectId);
    try {
      const raw = await readFile(this.identityPath(projectId), "utf8");
      const parsed: unknown = JSON.parse(raw);
      return this.validateCollection(projectId, parsed);
    } catch (error) {
      if (isMissingFile(error)) return [];
      throw error;
    }
  }

  public async exists(projectId: string): Promise<boolean> {
    this.assertProjectId(projectId);
    try { await access(this.identityPath(projectId)); return true; } catch (error) { if (isMissingFile(error)) return false; throw error; }
  }

  private validateCollection(projectId: string, value: unknown): readonly VisualCharacterIdentity[] {
    if (!Array.isArray(value)) throw new Error("Visual identity package must contain an array.");
    const ids = new Set<string>(); const characters = new Set<string>();
    const identities = value.map((item) => validateVisualCharacterIdentity(item));
    for (const identity of identities) {
      if (identity.projectId !== projectId) throw new Error("Visual identity state contains an identity from another project.");
      if (ids.has(identity.id)) throw new Error(`Duplicate visual identity id "${identity.id}".`);
      if (characters.has(identity.characterId)) throw new Error(`Duplicate visual identity for character "${identity.characterId}".`);
      ids.add(identity.id); characters.add(identity.characterId);
    }
    return identities;
  }

  private identityPath(projectId: string): string { return join(this.rootDirectory, "projects", projectId, "visual-identities.json"); }
  private assertProjectId(projectId: string): void { if (!/^[a-zA-Z0-9_-]+$/.test(projectId)) throw new Error("Project id contains unsupported path characters."); }
}

function isMissingFile(error: unknown): boolean { return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT"; }

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { validateEducationalDifferentiationPack, type EducationalDifferentiationPack } from "../domain/educational-workbook-differentiation";

export const EDUCATIONAL_DIFFERENTIATION_STORE_FORMAT_VERSION = 1 as const;

interface PersistedState {
  readonly formatVersion: typeof EDUCATIONAL_DIFFERENTIATION_STORE_FORMAT_VERSION;
  readonly packs: readonly EducationalDifferentiationPack[];
}

export class FileEducationalWorkbookDifferentiationStore {
  private packs: EducationalDifferentiationPack[] = [];
  private loaded = false;

  constructor(private readonly filePath: string) {
    if (!filePath.trim()) throw new Error("Educational differentiation store path is required.");
  }

  async list(projectId: string): Promise<readonly EducationalDifferentiationPack[]> {
    await this.load();
    const project = required(projectId, "Project id");
    return this.packs.filter((pack) => pack.projectId === project).sort((a, b) => b.generatedAt.localeCompare(a.generatedAt) || b.id.localeCompare(a.id)).map(clone);
  }

  async get(projectId: string, packId: string): Promise<EducationalDifferentiationPack | undefined> {
    await this.load();
    const project = required(projectId, "Project id");
    const id = required(packId, "Differentiation pack id");
    const pack = this.packs.find((item) => item.projectId === project && item.id === id);
    return pack ? clone(pack) : undefined;
  }

  async save(pack: EducationalDifferentiationPack): Promise<EducationalDifferentiationPack> {
    await this.load();
    validateEducationalDifferentiationPack(pack);
    if (this.packs.some((item) => item.projectId === pack.projectId && item.id === pack.id)) throw new Error(`Duplicate Educational Workbook differentiation pack id "${pack.id}".`);
    this.packs.push(clone(pack));
    await this.persist();
    return clone(pack);
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as PersistedState;
      if (parsed.formatVersion !== EDUCATIONAL_DIFFERENTIATION_STORE_FORMAT_VERSION || !Array.isArray(parsed.packs)) throw new Error("Unsupported or corrupt Educational Workbook differentiation store.");
      const keys = new Set<string>();
      this.packs = parsed.packs.map((pack) => {
        validateEducationalDifferentiationPack(pack);
        const key = `${pack.projectId}\u0000${pack.id}`;
        if (keys.has(key)) throw new Error(`Duplicate differentiation pack id "${pack.id}" in store.`);
        keys.add(key);
        return clone(pack);
      });
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const state: PersistedState = { formatVersion: EDUCATIONAL_DIFFERENTIATION_STORE_FORMAT_VERSION, packs: this.packs.map(clone) };
    const temp = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temp, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    await rename(temp, this.filePath);
  }
}

function clone(pack: EducationalDifferentiationPack): EducationalDifferentiationPack {
  return JSON.parse(JSON.stringify(pack)) as EducationalDifferentiationPack;
}
function required(value: string, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}
function isMissing(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ENOENT");
}

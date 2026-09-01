import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { cloneSpecializedCreationOffice, validateSpecializedCreationOffice, type SpecializedCreationOfficeRecord } from "../domain/specialized-creation-office";

const STORE_FORMAT_VERSION = 1 as const;
interface PersistedState { readonly formatVersion: typeof STORE_FORMAT_VERSION; readonly records: readonly SpecializedCreationOfficeRecord[]; }

export class FileSpecializedCreationOfficeStore {
  private loaded = false;
  private records: SpecializedCreationOfficeRecord[] = [];
  public constructor(private readonly filePath: string) { if (!filePath.trim()) throw new Error("Specialized creation store path is required."); }

  async list(projectId: string): Promise<readonly SpecializedCreationOfficeRecord[]> {
    await this.load();
    const id = requiredId(projectId, "project id");
    return this.records.filter((record) => record.projectId === id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(cloneSpecializedCreationOffice);
  }

  async get(projectId: string, id: string): Promise<SpecializedCreationOfficeRecord | undefined> {
    await this.load();
    const project = requiredId(projectId, "project id");
    const recordId = requiredId(id, "specialized creation id");
    const record = this.records.find((item) => item.projectId === project && item.id === recordId);
    return record ? cloneSpecializedCreationOffice(record) : undefined;
  }

  async create(record: SpecializedCreationOfficeRecord): Promise<SpecializedCreationOfficeRecord> {
    await this.load();
    const validated = validateSpecializedCreationOffice(record);
    if (this.records.some((item) => item.id === validated.id)) throw new Error(`Duplicate specialized creation id "${validated.id}".`);
    this.records.push(validated);
    await this.save();
    return cloneSpecializedCreationOffice(validated);
  }

  async save(record: SpecializedCreationOfficeRecord): Promise<SpecializedCreationOfficeRecord> {
    await this.load();
    const validated = validateSpecializedCreationOffice(record);
    const index = this.records.findIndex((item) => item.projectId === validated.projectId && item.id === validated.id);
    if (index < 0) throw new Error(`Specialized creation "${validated.id}" does not exist.`);
    this.records[index] = validated;
    await this.saveState();
    return cloneSpecializedCreationOffice(validated);
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8")) as PersistedState;
      if (!parsed || parsed.formatVersion !== STORE_FORMAT_VERSION || !Array.isArray(parsed.records)) throw new Error("Unsupported or corrupt specialized creation store.");
      const ids = new Set<string>();
      this.records = parsed.records.map((record) => {
        const validated = validateSpecializedCreationOffice(record);
        if (ids.has(validated.id)) throw new Error(`Duplicate specialized creation id "${validated.id}".`);
        ids.add(validated.id);
        return validated;
      });
    } catch (error) {
      if (!isMissingFile(error)) throw error;
    }
    this.loaded = true;
  }

  private async save(): Promise<void> { await this.saveState(); }
  private async saveState(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    const state: PersistedState = { formatVersion: STORE_FORMAT_VERSION, records: this.records.map(cloneSpecializedCreationOffice) };
    await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    await rename(temporaryPath, this.filePath);
  }
}

function requiredId(value: string, label: string): string { const normalized = value.trim(); if (!normalized) throw new Error(`${label} is required.`); return normalized; }
function isMissingFile(error: unknown): boolean { return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ENOENT"); }

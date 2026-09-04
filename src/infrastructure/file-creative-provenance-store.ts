import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  FORGE_PROVENANCE_FORMAT_VERSION,
  createCreativeProvenanceRecord,
  validateCreativeProvenanceRecord,
  verifyCreativeProvenanceChain,
  type CreativeProvenanceEventInput,
  type CreativeProvenanceRecord,
} from "../domain/creative-provenance";

interface ProvenanceFile {
  readonly formatVersion: typeof FORGE_PROVENANCE_FORMAT_VERSION;
  readonly records: readonly CreativeProvenanceRecord[];
}

interface SharedBackend {
  loaded: boolean;
  records: CreativeProvenanceRecord[];
  operation: Promise<void>;
}

const backends = new Map<string, SharedBackend>();

export class FileCreativeProvenanceStore {
  private readonly path: string;
  private readonly backend: SharedBackend;

  constructor(path: string) {
    this.path = resolve(path);
    this.backend = backends.get(this.path) ?? { loaded: false, records: [], operation: Promise.resolve() };
    backends.set(this.path, this.backend);
  }

  async append(input: CreativeProvenanceEventInput): Promise<CreativeProvenanceRecord> {
    let created!: CreativeProvenanceRecord;
    await this.serial(async () => {
      await this.loadIfNeeded();
      if (this.backend.records.some((record) => record.projectId === input.projectId && record.id === input.id)) throw new Error(`Creative provenance record "${input.id}" already exists in project "${input.projectId}".`);
      const projectRecords = this.backend.records.filter((record) => record.projectId === input.projectId);
      const previous = projectRecords.at(-1)?.recordSha256 ?? null;
      created = createCreativeProvenanceRecord(input, previous);
      this.backend.records.push(created);
      await this.persist();
    });
    return clone(created);
  }

  async list(projectId: string): Promise<readonly CreativeProvenanceRecord[]> {
    await this.serial(() => this.loadIfNeeded());
    return this.backend.records.filter((record) => record.projectId === projectId).map(clone);
  }

  async verify(projectId: string) {
    return verifyCreativeProvenanceChain(await this.list(projectId));
  }

  async get(projectId: string, id: string): Promise<CreativeProvenanceRecord> {
    const records = await this.list(projectId);
    const record = records.find((item) => item.id === id);
    if (!record) throw new Error(`Creative provenance record "${id}" not found.`);
    return record;
  }

  private async serial<T>(work: () => Promise<T>): Promise<T> {
    const previous = this.backend.operation;
    let release!: () => void;
    this.backend.operation = new Promise<void>((resolvePromise) => { release = resolvePromise; });
    await previous;
    try { return await work(); }
    finally { release(); }
  }

  private async loadIfNeeded(): Promise<void> {
    if (this.backend.loaded) return;
    try {
      const raw = await readFile(this.path, "utf8");
      const parsed = JSON.parse(raw) as ProvenanceFile;
      if (parsed.formatVersion !== FORGE_PROVENANCE_FORMAT_VERSION || !Array.isArray(parsed.records)) throw new Error("Unsupported or corrupt creative provenance ledger.");
      const records = parsed.records.map(validateCreativeProvenanceRecord);
      const projectIds = [...new Set(records.map((record) => record.projectId))];
      for (const projectId of projectIds) {
        const verification = verifyCreativeProvenanceChain(records.filter((record) => record.projectId === projectId));
        if (!verification.valid) throw new Error(verification.error ?? `Creative provenance chain for project "${projectId}" is invalid.`);
      }
      this.backend.records = records;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      this.backend.records = [];
    }
    this.backend.loaded = true;
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const tmp = `${this.path}.${process.pid}.${Date.now()}.tmp`;
    const payload: ProvenanceFile = { formatVersion: FORGE_PROVENANCE_FORMAT_VERSION, records: this.backend.records };
    await writeFile(tmp, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    await rename(tmp, this.path);
  }
}

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

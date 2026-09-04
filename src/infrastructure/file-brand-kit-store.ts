import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { BRAND_KIT_FORMAT_VERSION, validateBrandKit, type BrandKit } from "../domain/brand-kit";

interface BrandKitFile {
  readonly formatVersion: typeof BRAND_KIT_FORMAT_VERSION;
  readonly kits: readonly BrandKit[];
}
interface SharedBackend {
  loaded: boolean;
  kits: BrandKit[];
  operation: Promise<void>;
}
const backends = new Map<string, SharedBackend>();

export class FileBrandKitStore {
  private readonly path: string;
  private readonly backend: SharedBackend;

  constructor(path: string) {
    this.path = resolve(path);
    this.backend = backends.get(this.path) ?? { loaded: false, kits: [], operation: Promise.resolve() };
    backends.set(this.path, this.backend);
  }

  async list(forgeProjectId: string): Promise<BrandKit[]> {
    await this.serial(() => this.loadIfNeeded());
    return this.backend.kits.filter((kit) => kit.forgeProjectId === forgeProjectId).map(clone).sort((a, b) => a.name.localeCompare(b.name));
  }

  async get(forgeProjectId: string, id: string): Promise<BrandKit | undefined> {
    await this.serial(() => this.loadIfNeeded());
    const kit = this.backend.kits.find((item) => item.forgeProjectId === forgeProjectId && item.id === id);
    return kit ? clone(kit) : undefined;
  }

  async create(kitInput: BrandKit): Promise<BrandKit> {
    const kit = validateBrandKit(kitInput);
    await this.serial(async () => {
      await this.loadIfNeeded();
      if (this.backend.kits.some((item) => item.id === kit.id)) throw new Error(`Brand Kit id "${kit.id}" already exists.`);
      this.backend.kits.push(clone(kit));
      await this.persist();
    });
    return clone(kit);
  }

  async save(kitInput: BrandKit): Promise<BrandKit> {
    const kit = validateBrandKit(kitInput);
    await this.serial(async () => {
      await this.loadIfNeeded();
      const index = this.backend.kits.findIndex((item) => item.forgeProjectId === kit.forgeProjectId && item.id === kit.id);
      if (index < 0) throw new Error(`Brand Kit "${kit.id}" not found.`);
      this.backend.kits[index] = clone(kit);
      await this.persist();
    });
    return clone(kit);
  }

  async delete(forgeProjectId: string, id: string): Promise<void> {
    await this.serial(async () => {
      await this.loadIfNeeded();
      const next = this.backend.kits.filter((item) => !(item.forgeProjectId === forgeProjectId && item.id === id));
      if (next.length === this.backend.kits.length) throw new Error(`Brand Kit "${id}" not found.`);
      this.backend.kits = next;
      await this.persist();
    });
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
      const parsed = JSON.parse(await readFile(this.path, "utf8")) as BrandKitFile;
      if (parsed.formatVersion !== BRAND_KIT_FORMAT_VERSION || !Array.isArray(parsed.kits)) throw new Error("Unsupported or corrupt Brand Kit store.");
      this.backend.kits = parsed.kits.map(validateBrandKit);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      this.backend.kits = [];
    }
    this.backend.loaded = true;
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const tmp = `${this.path}.${process.pid}.${Date.now()}.tmp`;
    const payload: BrandKitFile = { formatVersion: BRAND_KIT_FORMAT_VERSION, kits: this.backend.kits };
    await writeFile(tmp, `${JSON.stringify(payload, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await rename(tmp, this.path);
  }
}

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

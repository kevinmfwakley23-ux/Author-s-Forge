import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { NFT_CREATION_FORMAT_VERSION, validateNftCollection, type NftCollection } from "../domain/nft-creation";

export const NFT_CREATION_STORE_VERSION = 1 as const;
interface PersistedNftStore { readonly formatVersion: typeof NFT_CREATION_STORE_VERSION; readonly collections: readonly NftCollection[]; }

export class FileNftCreationStore {
  constructor(private readonly path: string) {}

  async list(forgeProjectId?: string): Promise<NftCollection[]> {
    const store = await this.load();
    return store.collections.filter((collection) => !forgeProjectId || collection.forgeProjectId === forgeProjectId).map(clone).sort((a, b) => a.id.localeCompare(b.id));
  }

  async get(forgeProjectId: string, id: string): Promise<NftCollection | undefined> {
    const collection = (await this.load()).collections.find((item) => item.forgeProjectId === forgeProjectId && item.id === id);
    return collection ? clone(collection) : undefined;
  }

  async create(collection: NftCollection): Promise<NftCollection> {
    validateNftCollection(collection);
    const store = await this.load();
    if (store.collections.some((item) => item.id === collection.id && item.forgeProjectId === collection.forgeProjectId)) throw new Error(`NFT collection "${collection.id}" already exists for this Forge project.`);
    await this.persist({ formatVersion: NFT_CREATION_STORE_VERSION, collections: [...store.collections, clone(collection)] });
    return clone(collection);
  }

  async save(collection: NftCollection): Promise<NftCollection> {
    validateNftCollection(collection);
    const store = await this.load();
    const index = store.collections.findIndex((item) => item.id === collection.id && item.forgeProjectId === collection.forgeProjectId);
    if (index < 0) throw new Error(`NFT collection "${collection.id}" not found.`);
    const collections = [...store.collections];
    collections[index] = clone(collection);
    await this.persist({ formatVersion: NFT_CREATION_STORE_VERSION, collections });
    return clone(collection);
  }

  async remove(forgeProjectId: string, id: string): Promise<boolean> {
    const store = await this.load();
    const next = store.collections.filter((item) => !(item.forgeProjectId === forgeProjectId && item.id === id));
    if (next.length === store.collections.length) return false;
    await this.persist({ formatVersion: NFT_CREATION_STORE_VERSION, collections: next });
    return true;
  }

  private async load(): Promise<PersistedNftStore> {
    try {
      const parsed = JSON.parse(await readFile(this.path, "utf8")) as PersistedNftStore;
      if (parsed.formatVersion !== NFT_CREATION_STORE_VERSION || !Array.isArray(parsed.collections)) throw new Error("Unsupported NFT creation store format.");
      for (const collection of parsed.collections) {
        if (collection.formatVersion !== NFT_CREATION_FORMAT_VERSION) throw new Error("Unsupported NFT collection in store.");
        validateNftCollection(collection);
      }
      return { formatVersion: NFT_CREATION_STORE_VERSION, collections: parsed.collections.map(clone) };
    } catch (error) {
      if (isMissing(error)) return { formatVersion: NFT_CREATION_STORE_VERSION, collections: [] };
      throw error;
    }
  }

  private async persist(store: PersistedNftStore): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const temp = `${this.path}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temp, `${JSON.stringify(store, null, 2)}\n`, "utf8");
    await rename(temp, this.path);
  }
}

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function isMissing(error: unknown): boolean { return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT"; }

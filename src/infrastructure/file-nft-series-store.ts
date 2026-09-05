import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { validateNftSeries, type NftSeriesDirectorState } from "../domain/nft-series-director";

export const NFT_SERIES_STORE_VERSION = 1 as const;
interface PersistedStore { readonly formatVersion: typeof NFT_SERIES_STORE_VERSION; readonly series: readonly NftSeriesDirectorState[]; }

export class FileNftSeriesStore {
  constructor(private readonly path: string) {}

  async list(forgeProjectId?: string): Promise<NftSeriesDirectorState[]> {
    const store = await this.load();
    return store.series.filter((item) => !forgeProjectId || item.forgeProjectId === forgeProjectId).map(clone).sort((a, b) => a.id.localeCompare(b.id));
  }

  async get(forgeProjectId: string, id: string): Promise<NftSeriesDirectorState | undefined> {
    const item = (await this.load()).series.find((candidate) => candidate.forgeProjectId === forgeProjectId && candidate.id === id);
    return item ? clone(item) : undefined;
  }

  async create(item: NftSeriesDirectorState): Promise<NftSeriesDirectorState> {
    const value = validateNftSeries(item);
    const store = await this.load();
    if (store.series.some((candidate) => candidate.id === value.id && candidate.forgeProjectId === value.forgeProjectId)) throw new Error(`NFT series "${value.id}" already exists.`);
    await this.persist({ formatVersion: NFT_SERIES_STORE_VERSION, series: [...store.series, value] });
    return clone(value);
  }

  async save(item: NftSeriesDirectorState): Promise<NftSeriesDirectorState> {
    const value = validateNftSeries(item);
    const store = await this.load();
    const index = store.series.findIndex((candidate) => candidate.id === value.id && candidate.forgeProjectId === value.forgeProjectId);
    if (index < 0) throw new Error(`NFT series "${value.id}" not found.`);
    const series = [...store.series];
    series[index] = value;
    await this.persist({ formatVersion: NFT_SERIES_STORE_VERSION, series });
    return clone(value);
  }

  private async load(): Promise<PersistedStore> {
    try {
      const parsed = JSON.parse(await readFile(this.path, "utf8")) as PersistedStore;
      if (parsed.formatVersion !== NFT_SERIES_STORE_VERSION || !Array.isArray(parsed.series)) throw new Error("Unsupported NFT series store format.");
      return { formatVersion: NFT_SERIES_STORE_VERSION, series: parsed.series.map(validateNftSeries) };
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT") return { formatVersion: NFT_SERIES_STORE_VERSION, series: [] };
      throw error;
    }
  }

  private async persist(store: PersistedStore): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.tmp`;
    await writeFile(temporary, `${JSON.stringify(store, null, 2)}\n`, "utf8");
    await rename(temporary, this.path);
  }
}

function clone(value: NftSeriesDirectorState): NftSeriesDirectorState { return JSON.parse(JSON.stringify(value)) as NftSeriesDirectorState; }

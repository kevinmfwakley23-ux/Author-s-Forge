import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { validateGuidedJournalJourneyProgress, type GuidedJournalJourneyProgress } from "../domain/guided-journal-journey";
import { validateGuidedJournalPromptPack, type GuidedJournalPromptPack } from "../domain/guided-journal-packs";

export const GUIDED_JOURNAL_JOURNEY_STORE_VERSION = 1 as const;

interface PersistedJourneyState {
  readonly formatVersion: typeof GUIDED_JOURNAL_JOURNEY_STORE_VERSION;
  readonly packs: readonly GuidedJournalPromptPack[];
  readonly journeys: readonly GuidedJournalJourneyProgress[];
}

export class FileGuidedJournalJourneyStore {
  private packs: GuidedJournalPromptPack[] = [];
  private journeys = new Map<string, GuidedJournalJourneyProgress>();
  private loaded = false;

  constructor(private readonly filePath: string) {
    if (!filePath.trim()) throw new Error("Guided Journal journey store path is required.");
  }

  async savePack(pack: GuidedJournalPromptPack): Promise<GuidedJournalPromptPack> {
    await this.load();
    validateGuidedJournalPromptPack(pack);
    if (this.packs.some((candidate) => candidate.id === pack.id && candidate.version === pack.version)) {
      throw new Error(`Prompt pack "${pack.id}" version ${pack.version} already exists.`);
    }
    this.packs.push(clone(pack));
    await this.persist();
    return clone(pack);
  }

  async getPack(packId: string, version?: number): Promise<GuidedJournalPromptPack | undefined> {
    await this.load();
    const matches = this.packs.filter((pack) => pack.id === required(packId, "Prompt pack id"));
    const selected = version === undefined
      ? matches.sort((a, b) => b.version - a.version)[0]
      : matches.find((pack) => pack.version === version);
    return selected ? clone(selected) : undefined;
  }

  async listLatestPacks(): Promise<readonly GuidedJournalPromptPack[]> {
    await this.load();
    const latest = new Map<string, GuidedJournalPromptPack>();
    for (const pack of this.packs) {
      const current = latest.get(pack.id);
      if (!current || pack.version > current.version) latest.set(pack.id, pack);
    }
    return [...latest.values()].sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id)).map(clone);
  }

  async saveJourney(progress: GuidedJournalJourneyProgress): Promise<GuidedJournalJourneyProgress> {
    await this.load();
    validateGuidedJournalJourneyProgress(progress);
    this.journeys.set(progress.id, clone(progress));
    await this.persist();
    return clone(progress);
  }

  async getJourney(journeyId: string): Promise<GuidedJournalJourneyProgress | undefined> {
    await this.load();
    const current = this.journeys.get(required(journeyId, "Journey id"));
    return current ? clone(current) : undefined;
  }

  async listJourneys(projectId: string): Promise<readonly GuidedJournalJourneyProgress[]> {
    await this.load();
    const id = required(projectId, "Project id");
    return [...this.journeys.values()]
      .filter((journey) => journey.projectId === id)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))
      .map(clone);
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8")) as PersistedJourneyState;
      if (parsed.formatVersion !== GUIDED_JOURNAL_JOURNEY_STORE_VERSION || !Array.isArray(parsed.packs) || !Array.isArray(parsed.journeys)) {
        throw new Error("Unsupported or corrupt Guided Journal journey store.");
      }
      const packKeys = new Set<string>();
      for (const pack of parsed.packs) {
        validateGuidedJournalPromptPack(pack);
        const key = `${pack.id}@${pack.version}`;
        if (packKeys.has(key)) throw new Error(`Duplicate persisted prompt pack version "${key}".`);
        packKeys.add(key);
        this.packs.push(clone(pack));
      }
      for (const journey of parsed.journeys) {
        validateGuidedJournalJourneyProgress(journey);
        if (this.journeys.has(journey.id)) throw new Error(`Duplicate persisted journey id "${journey.id}".`);
        this.journeys.set(journey.id, clone(journey));
      }
    } catch (error) {
      if (isMissingFile(error)) return;
      throw error;
    }
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const state: PersistedJourneyState = {
      formatVersion: GUIDED_JOURNAL_JOURNEY_STORE_VERSION,
      packs: this.packs.map(clone),
      journeys: [...this.journeys.values()].sort((a, b) => a.id.localeCompare(b.id)).map(clone),
    };
    const temporary = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    await rename(temporary, this.filePath);
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function required(value: string, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function isMissingFile(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ENOENT");
}

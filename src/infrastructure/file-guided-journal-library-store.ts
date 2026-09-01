import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { validateCoverStatementLibrary, validatePromptLibrary, type JournalCoverStatement, type JournalPrompt } from "../domain/guided-journal";

export const GUIDED_JOURNAL_LIBRARY_STORE_VERSION = 1 as const;

export interface GuidedJournalLibrarySnapshot {
  readonly formatVersion: typeof GUIDED_JOURNAL_LIBRARY_STORE_VERSION;
  readonly projectId: string;
  readonly prompts: readonly JournalPrompt[];
  readonly coverStatements: readonly JournalCoverStatement[];
  readonly updatedAt: string;
}

interface PersistedState {
  readonly formatVersion: typeof GUIDED_JOURNAL_LIBRARY_STORE_VERSION;
  readonly libraries: readonly GuidedJournalLibrarySnapshot[];
}

/** Restart-safe project-scoped source of truth for author-controlled journal libraries. */
export class FileGuidedJournalLibraryStore {
  private libraries = new Map<string, GuidedJournalLibrarySnapshot>();
  private loaded = false;

  constructor(private readonly filePath: string) {
    if (!filePath.trim()) throw new Error("Guided Journal library store path is required.");
  }

  async get(projectId: string): Promise<GuidedJournalLibrarySnapshot> {
    await this.load();
    const id = required(projectId, "Project id");
    const current = this.libraries.get(id);
    return current ? clone(current) : empty(id);
  }

  async save(snapshot: GuidedJournalLibrarySnapshot): Promise<GuidedJournalLibrarySnapshot> {
    await this.load();
    const validated = validateSnapshot(snapshot);
    this.libraries.set(validated.projectId, clone(validated));
    await this.persist();
    return clone(validated);
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as PersistedState;
      if (parsed.formatVersion !== GUIDED_JOURNAL_LIBRARY_STORE_VERSION || !Array.isArray(parsed.libraries)) throw new Error("Unsupported Guided Journal library store format.");
      for (const library of parsed.libraries) {
        const validated = validateSnapshot(library);
        if (this.libraries.has(validated.projectId)) throw new Error(`Duplicate Guided Journal library for project "${validated.projectId}".`);
        this.libraries.set(validated.projectId, clone(validated));
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const state: PersistedState = {
      formatVersion: GUIDED_JOURNAL_LIBRARY_STORE_VERSION,
      libraries: [...this.libraries.values()].sort((a, b) => a.projectId.localeCompare(b.projectId)).map(clone),
    };
    const temporary = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    await rename(temporary, this.filePath);
  }
}

function validateSnapshot(snapshot: GuidedJournalLibrarySnapshot): GuidedJournalLibrarySnapshot {
  if (snapshot.formatVersion !== GUIDED_JOURNAL_LIBRARY_STORE_VERSION) throw new Error("Unsupported Guided Journal library snapshot format.");
  const projectId = required(snapshot.projectId, "Project id");
  if (Number.isNaN(Date.parse(snapshot.updatedAt))) throw new Error("Guided Journal library updatedAt must be a valid timestamp.");
  const prompts = snapshot.prompts.length ? validatePromptLibrary(snapshot.prompts) : [];
  const coverStatements = validateCoverStatementLibrary(snapshot.coverStatements ?? []);
  return Object.freeze({ formatVersion: GUIDED_JOURNAL_LIBRARY_STORE_VERSION, projectId, prompts: Object.freeze(prompts.map((item) => Object.freeze({ ...item, tags: Object.freeze([...item.tags]) }))), coverStatements: Object.freeze(coverStatements.map((item) => Object.freeze({ ...item, tags: Object.freeze([...item.tags]) }))), updatedAt: new Date(snapshot.updatedAt).toISOString() });
}

function empty(projectId: string): GuidedJournalLibrarySnapshot {
  return Object.freeze({ formatVersion: GUIDED_JOURNAL_LIBRARY_STORE_VERSION, projectId, prompts: Object.freeze([]), coverStatements: Object.freeze([]), updatedAt: new Date(0).toISOString() });
}

function clone(snapshot: GuidedJournalLibrarySnapshot): GuidedJournalLibrarySnapshot {
  return { ...snapshot, prompts: snapshot.prompts.map((item) => ({ ...item, tags: [...item.tags] })), coverStatements: snapshot.coverStatements.map((item) => ({ ...item, tags: [...item.tags] })) };
}

function required(value: string, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

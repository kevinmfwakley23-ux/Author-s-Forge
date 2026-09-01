import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { GuidedJournalPlan } from "../domain/guided-journal";

export const GUIDED_JOURNAL_STORE_FORMAT_VERSION = 1 as const;

interface PersistedGuidedJournalState {
  readonly formatVersion: typeof GUIDED_JOURNAL_STORE_FORMAT_VERSION;
  readonly journals: readonly GuidedJournalPlan[];
}

/** Durable project-scoped storage for generated guided journal editions. */
export class FileGuidedJournalStore {
  private journals: GuidedJournalPlan[] = [];
  private loaded = false;

  constructor(private readonly filePath: string) {
    if (!filePath.trim()) throw new Error("Guided Journal store path is required.");
  }

  async list(projectId: string): Promise<readonly GuidedJournalPlan[]> {
    await this.load();
    const id = required(projectId, "Project id");
    return this.journals
      .filter((journal) => journal.projectId === id)
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt) || b.id.localeCompare(a.id))
      .map(cloneJournal);
  }

  async get(projectId: string, journalId: string): Promise<GuidedJournalPlan | undefined> {
    await this.load();
    const project = required(projectId, "Project id");
    const id = required(journalId, "Journal id");
    const journal = this.journals.find((item) => item.projectId === project && item.id === id);
    return journal ? cloneJournal(journal) : undefined;
  }

  async save(journal: GuidedJournalPlan): Promise<GuidedJournalPlan> {
    await this.load();
    validateJournal(journal);
    if (this.journals.some((item) => item.id === journal.id)) throw new Error(`Duplicate guided journal id "${journal.id}".`);
    this.journals.push(cloneJournal(journal));
    await this.persist();
    return cloneJournal(journal);
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as PersistedGuidedJournalState;
      if (parsed.formatVersion !== GUIDED_JOURNAL_STORE_FORMAT_VERSION || !Array.isArray(parsed.journals)) throw new Error("Unsupported or corrupt Guided Journal store.");
      const ids = new Set<string>();
      this.journals = parsed.journals.map((journal) => {
        validateJournal(journal);
        if (ids.has(journal.id)) throw new Error(`Duplicate guided journal id "${journal.id}" in store.`);
        ids.add(journal.id);
        return cloneJournal(journal);
      });
    } catch (error) {
      if (!isMissingFile(error)) throw error;
    }
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const state: PersistedGuidedJournalState = { formatVersion: GUIDED_JOURNAL_STORE_FORMAT_VERSION, journals: this.journals.map(cloneJournal) };
    const temp = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temp, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    await rename(temp, this.filePath);
  }
}

function validateJournal(journal: GuidedJournalPlan): void {
  if (journal.formatVersion !== 1) throw new Error("Unsupported Guided Journal format.");
  required(journal.id, "Journal id");
  required(journal.projectId, "Project id");
  required(journal.title, "Journal title");
  required(journal.seed, "Journal seed");
  if (!Array.isArray(journal.prompts) || !journal.prompts.length) throw new Error("Guided Journal must contain prompt pages.");
  const ids = new Set(journal.sourcePromptIds);
  if (ids.size !== journal.sourcePromptIds.length || journal.sourcePromptIds.length !== journal.prompts.length) throw new Error("Guided Journal source prompt ids are inconsistent.");
}

function cloneJournal(journal: GuidedJournalPlan): GuidedJournalPlan {
  return JSON.parse(JSON.stringify(journal)) as GuidedJournalPlan;
}

function required(value: string, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function isMissingFile(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ENOENT");
}

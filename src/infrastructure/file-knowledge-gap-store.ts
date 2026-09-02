import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { validateKnowledgeGapHypothesis, type KnowledgeGapHypothesis, type KnowledgeGapStatus } from "../domain/knowledge-gap";

export const KNOWLEDGE_GAP_STORE_FORMAT_VERSION = 1 as const;

interface PersistedKnowledgeGapState {
  readonly formatVersion: typeof KNOWLEDGE_GAP_STORE_FORMAT_VERSION;
  readonly gaps: readonly KnowledgeGapHypothesis[];
}

/**
 * Durable project-scoped queue for research hypotheses.
 *
 * This store is deliberately separate from Project Brain memory: an unresolved
 * knowledge gap is a question, not a fact, and therefore must never become AI
 * context or canon merely because the Radar surfaced it.
 */
export class FileKnowledgeGapStore {
  private gaps: KnowledgeGapHypothesis[] = [];
  private loaded = false;
  private mutation: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {
    if (!filePath.trim()) throw new Error("Knowledge gap store path is required.");
  }

  async list(projectId: string, statuses?: readonly KnowledgeGapStatus[]): Promise<readonly KnowledgeGapHypothesis[]> {
    await this.load();
    const id = projectIdValue(projectId);
    const allowed = statuses ? new Set(statuses) : undefined;
    return this.gaps
      .filter((gap) => gap.projectId === id && (!allowed || allowed.has(gap.status)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.createdAt.localeCompare(a.createdAt))
      .map(cloneGap);
  }

  async get(projectId: string, gapId: string): Promise<KnowledgeGapHypothesis | undefined> {
    await this.load();
    const project = projectIdValue(projectId);
    const id = idValue(gapId, "Knowledge gap id");
    const gap = this.gaps.find((item) => item.projectId === project && item.id === id);
    return gap ? cloneGap(gap) : undefined;
  }

  async appendMany(projectId: string, values: readonly KnowledgeGapHypothesis[]): Promise<readonly KnowledgeGapHypothesis[]> {
    const project = projectIdValue(projectId);
    if (!Array.isArray(values) || !values.length) return [];
    let appended: KnowledgeGapHypothesis[] = [];
    await this.exclusive(async () => {
      await this.load();
      const incoming = values.map((value) => validateKnowledgeGapHypothesis(value));
      const knownIds = new Set(this.gaps.map((gap) => gap.id));
      for (const gap of incoming) {
        if (gap.projectId !== project) throw new Error(`Knowledge gap "${gap.id}" belongs to another project.`);
        if (knownIds.has(gap.id)) throw new Error(`Duplicate knowledge gap id "${gap.id}".`);
        knownIds.add(gap.id);
      }
      this.gaps.push(...incoming.map(cloneGap));
      await this.save();
      appended = incoming.map(cloneGap);
    });
    return appended;
  }

  async replace(value: KnowledgeGapHypothesis): Promise<KnowledgeGapHypothesis> {
    const validated = validateKnowledgeGapHypothesis(value);
    let output = cloneGap(validated);
    await this.exclusive(async () => {
      await this.load();
      const index = this.gaps.findIndex((gap) => gap.projectId === validated.projectId && gap.id === validated.id);
      if (index < 0) throw new Error(`Knowledge gap "${validated.id}" not found.`);
      this.gaps[index] = cloneGap(validated);
      await this.save();
      output = cloneGap(validated);
    });
    return output;
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await readFile(this.filePath, "utf8");
      const state = validateState(JSON.parse(raw));
      this.gaps = state.gaps.map(cloneGap);
    } catch (error) {
      if (!isMissingFile(error)) throw error;
    }
    this.loaded = true;
  }

  private async save(): Promise<void> {
    const state: PersistedKnowledgeGapState = {
      formatVersion: KNOWLEDGE_GAP_STORE_FORMAT_VERSION,
      gaps: this.gaps.map(cloneGap),
    };
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    await rename(temporaryPath, this.filePath);
  }

  private async exclusive(run: () => Promise<void>): Promise<void> {
    const prior = this.mutation;
    let release!: () => void;
    this.mutation = new Promise<void>((resolve) => { release = resolve; });
    await prior;
    try { await run(); }
    finally { release(); }
  }
}

function validateState(value: unknown): PersistedKnowledgeGapState {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid knowledge gap store.");
  const state = value as Record<string, unknown>;
  if (state.formatVersion !== KNOWLEDGE_GAP_STORE_FORMAT_VERSION || !Array.isArray(state.gaps)) throw new Error("Unsupported or corrupt knowledge gap store.");
  const ids = new Set<string>();
  const gaps = state.gaps.map((value) => {
    const gap = validateKnowledgeGapHypothesis(value);
    if (ids.has(gap.id)) throw new Error(`Duplicate knowledge gap id "${gap.id}" in durable store.`);
    ids.add(gap.id);
    return gap;
  });
  return { formatVersion: KNOWLEDGE_GAP_STORE_FORMAT_VERSION, gaps };
}
function projectIdValue(value: unknown): string { return idValue(value, "Project id"); }
function idValue(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim() || value !== value.trim() || value.length > 300 || /[\r\n]/.test(value)) throw new Error(`${label} is invalid.`);
  return value;
}
function cloneGap(gap: KnowledgeGapHypothesis): KnowledgeGapHypothesis {
  return { ...gap, researchMemoryIds: [...gap.researchMemoryIds] };
}
function isMissingFile(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ENOENT");
}

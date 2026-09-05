import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { AiProposalStore, type AiProposal } from "../application/ai-proposal-store";

export const AI_PROPOSAL_STORE_FORMAT_VERSION = 1 as const;

type PersistedProposalState = {
  readonly formatVersion: typeof AI_PROPOSAL_STORE_FORMAT_VERSION;
  readonly proposals: readonly AiProposal[];
};

type SharedProposalBackend = {
  readonly store: AiProposalStore;
  loaded: boolean;
  loading?: Promise<AiProposalStore>;
  saving?: Promise<void>;
};

const SHARED_BACKENDS = new Map<string, SharedProposalBackend>();

/**
 * Durable filesystem adapter for the author-controlled AI proposal ledger.
 * Instances that point at the same file share one in-process ledger so modular
 * Studio route groups cannot race each other with stale proposal snapshots.
 */
export class FileAiProposalStore {
  private readonly canonicalPath: string;
  private readonly backend: SharedProposalBackend;

  constructor(private readonly filePath: string, store?: AiProposalStore) {
    if (!filePath.trim()) throw new Error("AI proposal store path is required.");
    this.canonicalPath = resolve(filePath);
    const existing = SHARED_BACKENDS.get(this.canonicalPath);
    if (existing) {
      if (store && existing.store !== store) throw new Error(`AI proposal store "${this.canonicalPath}" is already bound to another in-process ledger.`);
      this.backend = existing;
    } else {
      this.backend = { store: store ?? new AiProposalStore(), loaded: false };
      SHARED_BACKENDS.set(this.canonicalPath, this.backend);
    }
  }

  async load(): Promise<AiProposalStore> {
    if (this.backend.loaded) return this.backend.store;
    if (this.backend.loading) return this.backend.loading;
    this.backend.loading = this.loadOnce();
    try { return await this.backend.loading; }
    finally { this.backend.loading = undefined; }
  }

  async save(): Promise<void> {
    if (!this.backend.loaded) await this.load();
    if (this.backend.saving) await this.backend.saving;
    this.backend.saving = this.saveOnce();
    try { await this.backend.saving; }
    finally { this.backend.saving = undefined; }
  }

  get ledger(): AiProposalStore { return this.backend.store; }

  private async loadOnce(): Promise<AiProposalStore> {
    try {
      const raw = await readFile(this.canonicalPath, "utf8");
      this.backend.store.restore(validateState(JSON.parse(raw)).proposals);
    } catch (error) {
      if (!isMissingFile(error)) throw error;
    }
    this.backend.loaded = true;
    return this.backend.store;
  }

  private async saveOnce(): Promise<void> {
    const state: PersistedProposalState = { formatVersion: AI_PROPOSAL_STORE_FORMAT_VERSION, proposals: this.backend.store.snapshot() };
    await mkdir(dirname(this.canonicalPath), { recursive: true });
    const temporaryPath = `${this.canonicalPath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    await rename(temporaryPath, this.canonicalPath);
  }
}

function validateState(value: unknown): PersistedProposalState {
  if (!value || typeof value !== "object") throw new Error("Invalid AI proposal store.");
  const candidate = value as Record<string, unknown>;
  if (candidate.formatVersion !== AI_PROPOSAL_STORE_FORMAT_VERSION || !Array.isArray(candidate.proposals)) throw new Error("Unsupported or corrupt AI proposal store.");
  const ids = new Set<string>();
  const proposals = candidate.proposals.map((item) => {
    if (!item || typeof item !== "object") throw new Error("Invalid AI proposal record.");
    const proposal = item as AiProposal;
    if (!proposal.id?.trim()) throw new Error("AI proposal id is required.");
    if (ids.has(proposal.id)) throw new Error(`Duplicate AI proposal id "${proposal.id}".`);
    ids.add(proposal.id);
    if (!proposal.projectId?.trim()) throw new Error(`AI proposal "${proposal.id}" has no project id.`);
    if (!proposal.title?.trim()) throw new Error(`AI proposal "${proposal.id}" has no title.`);
    if (!proposal.proposedContent?.trim()) throw new Error(`AI proposal "${proposal.id}" has no content.`);
    if (!Array.isArray(proposal.sourceMemoryIds)) throw new Error(`AI proposal "${proposal.id}" has invalid source memory ids.`);
    if (!["pending", "accepted", "rejected", "superseded"].includes(proposal.status)) throw new Error(`AI proposal "${proposal.id}" has invalid status.`);
    if (!proposal.createdAt?.trim()) throw new Error(`AI proposal "${proposal.id}" has no creation time.`);
    if (proposal.target) {
      for (const [name, value] of Object.entries(proposal.target)) if (!value?.trim()) throw new Error(`AI proposal "${proposal.id}" has invalid target ${name}.`);
    }
    return { ...proposal, sourceMemoryIds: [...new Set(proposal.sourceMemoryIds.map(String))].sort(), ...(proposal.target ? { target: { ...proposal.target } } : {}) };
  });
  return { formatVersion: AI_PROPOSAL_STORE_FORMAT_VERSION, proposals };
}

function isMissingFile(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ENOENT");
}

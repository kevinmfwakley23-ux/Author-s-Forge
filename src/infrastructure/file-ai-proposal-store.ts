import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { AiProposalStore, type AiProposal } from "../application/ai-proposal-store";

export const AI_PROPOSAL_STORE_FORMAT_VERSION = 1 as const;

type PersistedProposalState = {
  readonly formatVersion: typeof AI_PROPOSAL_STORE_FORMAT_VERSION;
  readonly proposals: readonly AiProposal[];
};

/** Durable filesystem adapter for the author-controlled AI proposal ledger. */
export class FileAiProposalStore {
  private readonly store: AiProposalStore;
  private loaded = false;

  constructor(private readonly filePath: string, store = new AiProposalStore()) {
    if (!filePath.trim()) throw new Error("AI proposal store path is required.");
    this.store = store;
  }

  async load(): Promise<AiProposalStore> {
    if (this.loaded) return this.store;
    try {
      const raw = await readFile(this.filePath, "utf8");
      this.store.restore(validateState(JSON.parse(raw)).proposals);
    } catch (error) {
      if (!isMissingFile(error)) throw error;
    }
    this.loaded = true;
    return this.store;
  }

  async save(): Promise<void> {
    if (!this.loaded) await this.load();
    const state: PersistedProposalState = { formatVersion: AI_PROPOSAL_STORE_FORMAT_VERSION, proposals: this.store.snapshot() };
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    await rename(temporaryPath, this.filePath);
  }

  get ledger(): AiProposalStore { return this.store; }
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
    if (ids.has(proposal.id)) throw new Error(`Duplicate AI proposal id \"${proposal.id}\".`);
    ids.add(proposal.id);
    if (!proposal.projectId?.trim()) throw new Error(`AI proposal \"${proposal.id}\" has no project id.`);
    if (!proposal.title?.trim()) throw new Error(`AI proposal \"${proposal.id}\" has no title.`);
    if (!proposal.proposedContent?.trim()) throw new Error(`AI proposal \"${proposal.id}\" has no content.`);
    if (!Array.isArray(proposal.sourceMemoryIds)) throw new Error(`AI proposal \"${proposal.id}\" has invalid source memory ids.`);
    if (!["pending", "accepted", "rejected", "superseded"].includes(proposal.status)) throw new Error(`AI proposal \"${proposal.id}\" has invalid status.`);
    if (!proposal.createdAt?.trim()) throw new Error(`AI proposal \"${proposal.id}\" has no creation time.`);
    if (proposal.target) {
      for (const [name, value] of Object.entries(proposal.target)) if (!value?.trim()) throw new Error(`AI proposal \"${proposal.id}\" has invalid target ${name}.`);
    }
    return { ...proposal, sourceMemoryIds: [...new Set(proposal.sourceMemoryIds.map(String))].sort(), ...(proposal.target ? { target: { ...proposal.target } } : {}) };
  });
  return { formatVersion: AI_PROPOSAL_STORE_FORMAT_VERSION, proposals };
}

function isMissingFile(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ENOENT");
}

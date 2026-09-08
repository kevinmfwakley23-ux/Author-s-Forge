import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { AiProposalStore, type AiProposal, type ProposalReviewAuditEntry } from "../application/ai-proposal-store";

const LEGACY_AI_PROPOSAL_STORE_FORMAT_VERSION = 1 as const;
export const AI_PROPOSAL_STORE_FORMAT_VERSION = 2 as const;

type PersistedProposalState = {
  readonly formatVersion: typeof AI_PROPOSAL_STORE_FORMAT_VERSION;
  readonly proposals: readonly AiProposal[];
  readonly reviewAudit: readonly ProposalReviewAuditEntry[];
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
      const state = validateState(JSON.parse(raw));
      this.backend.store.restore(state.proposals, state.reviewAudit);
    } catch (error) {
      if (!isMissingFile(error)) throw error;
    }
    this.backend.loaded = true;
    return this.backend.store;
  }

  private async saveOnce(): Promise<void> {
    const state: PersistedProposalState = {
      formatVersion: AI_PROPOSAL_STORE_FORMAT_VERSION,
      proposals: this.backend.store.snapshot(),
      reviewAudit: this.backend.store.auditSnapshot(),
    };
    await mkdir(dirname(this.canonicalPath), { recursive: true });
    await writeFileAtomically(this.canonicalPath, `${JSON.stringify(state, null, 2)}\n`);
  }
}

function validateState(value: unknown): PersistedProposalState {
  if (!value || typeof value !== "object") throw new Error("Invalid AI proposal store.");
  const candidate = value as Record<string, unknown>;
  if (candidate.formatVersion !== LEGACY_AI_PROPOSAL_STORE_FORMAT_VERSION && candidate.formatVersion !== AI_PROPOSAL_STORE_FORMAT_VERSION) {
    throw new Error("Unsupported or corrupt AI proposal store.");
  }
  if (!Array.isArray(candidate.proposals)) throw new Error("Unsupported or corrupt AI proposal store.");

  const proposals = validateProposals(candidate.proposals);
  const reviewAudit = candidate.formatVersion === LEGACY_AI_PROPOSAL_STORE_FORMAT_VERSION
    ? migrateLegacyReviewAudit(proposals)
    : validateReviewAuditArray(candidate.reviewAudit);

  const verifier = new AiProposalStore();
  verifier.restore(proposals, reviewAudit);
  return { formatVersion: AI_PROPOSAL_STORE_FORMAT_VERSION, proposals, reviewAudit };
}

function validateProposals(value: readonly unknown[]): AiProposal[] {
  const ids = new Set<string>();
  return value.map((item) => {
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
    if (!proposal.createdAt?.trim() || Number.isNaN(Date.parse(proposal.createdAt))) throw new Error(`AI proposal "${proposal.id}" has invalid creation time.`);
    if (proposal.target) {
      for (const [name, targetValue] of Object.entries(proposal.target)) if (!targetValue?.trim()) throw new Error(`AI proposal "${proposal.id}" has invalid target ${name}.`);
    }
    return {
      ...proposal,
      sourceMemoryIds: [...new Set(proposal.sourceMemoryIds.map(String))].sort(),
      ...(proposal.target ? { target: { ...proposal.target } } : {}),
    };
  });
}

function validateReviewAuditArray(value: unknown): ProposalReviewAuditEntry[] {
  if (!Array.isArray(value)) throw new Error("Unsupported or corrupt AI proposal review audit.");
  return value.map((item) => {
    if (!item || typeof item !== "object") throw new Error("Invalid AI proposal review audit entry.");
    const entry = item as ProposalReviewAuditEntry;
    return {
      proposalId: String(entry.proposalId ?? ""),
      from: entry.from,
      to: entry.to,
      reviewer: entry.reviewer,
      ...(entry.note?.trim() ? { note: entry.note.trim() } : {}),
      reviewedAt: String(entry.reviewedAt ?? ""),
      sequence: entry.sequence,
    };
  });
}

function migrateLegacyReviewAudit(proposals: readonly AiProposal[]): ProposalReviewAuditEntry[] {
  return proposals
    .filter((proposal) => (proposal.status === "accepted" || proposal.status === "rejected") && proposal.reviewedBy === "author" && Boolean(proposal.reviewedAt?.trim()))
    .sort((a, b) => (a.reviewedAt ?? "").localeCompare(b.reviewedAt ?? "") || a.id.localeCompare(b.id))
    .map((proposal, index) => ({
      proposalId: proposal.id,
      from: "pending",
      to: proposal.status as "accepted" | "rejected",
      reviewer: "author",
      ...(proposal.reviewNote?.trim() ? { note: proposal.reviewNote.trim() } : {}),
      reviewedAt: proposal.reviewedAt as string,
      sequence: index + 1,
    }));
}

async function writeFileAtomically(path: string, content: string): Promise<void> {
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(temporaryPath, "wx");
    await handle.writeFile(content, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporaryPath, path);
    await syncDirectoryBestEffort(dirname(path));
  } finally {
    if (handle) await handle.close().catch(() => {});
    await rm(temporaryPath, { force: true }).catch(() => {});
  }
}

async function syncDirectoryBestEffort(directory: string): Promise<void> {
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(directory, "r");
    await handle.sync();
  } catch (error) {
    if (!isUnsupportedDirectorySync(error)) throw error;
  } finally {
    if (handle) await handle.close().catch(() => {});
  }
}

function isUnsupportedDirectorySync(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  return ["EISDIR", "EINVAL", "ENOTSUP", "EPERM", "EACCES"].includes(String((error as { code?: unknown }).code));
}

function isMissingFile(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ENOENT");
}

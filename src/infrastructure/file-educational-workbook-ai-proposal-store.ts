import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { validateWorkbookActivity, type WorkbookActivity } from "../domain/educational-workbook";
import type { WorkbookAiActivityProposal } from "../application/educational-workbook-intelligence";

export const EDUCATIONAL_WORKBOOK_AI_PROPOSAL_STORE_FORMAT_VERSION = 1 as const;
export type WorkbookAiProposalStatus = "pending" | "approved" | "rejected";

export interface StoredWorkbookAiProposal {
  readonly id: string;
  readonly projectId: string;
  readonly status: WorkbookAiProposalStatus;
  readonly createdAt: string;
  readonly decidedAt?: string;
  readonly activities: readonly WorkbookActivity[];
  readonly ai: WorkbookAiActivityProposal["ai"];
}

interface PersistedState {
  readonly formatVersion: typeof EDUCATIONAL_WORKBOOK_AI_PROPOSAL_STORE_FORMAT_VERSION;
  readonly proposals: readonly StoredWorkbookAiProposal[];
}

/** Durable server-owned review state so AI output cannot self-approve or be fabricated by a client approval payload. */
export class FileEducationalWorkbookAiProposalStore {
  private proposals: StoredWorkbookAiProposal[] = [];
  private loaded = false;

  constructor(private readonly filePath: string) {
    if (!filePath.trim()) throw new Error("Educational Workbook AI proposal store path is required.");
  }

  async create(input: { id: string; projectId: string; proposal: WorkbookAiActivityProposal; now?: string }): Promise<StoredWorkbookAiProposal> {
    await this.load();
    const id = required(input.id, "Workbook AI proposal id");
    const projectId = required(input.projectId, "Project id");
    if (this.proposals.some((item) => item.id === id)) throw new Error(`Duplicate workbook AI proposal id "${id}".`);
    if (!input.proposal.activities.length) throw new Error("Workbook AI proposal requires at least one activity.");
    for (const activity of input.proposal.activities) {
      validateWorkbookActivity(activity);
      if (activity.projectId !== projectId) throw new Error("Workbook AI proposal activity belongs to another project.");
    }
    const createdAt = iso(input.now ?? new Date().toISOString(), "Workbook AI proposal createdAt");
    const record: StoredWorkbookAiProposal = {
      id,
      projectId,
      status: "pending",
      createdAt,
      activities: input.proposal.activities.map(cloneActivity),
      ai: clone(input.proposal.ai),
    };
    validateProposal(record);
    this.proposals.push(clone(record));
    await this.persist();
    return clone(record);
  }

  async get(projectId: string, proposalId: string): Promise<StoredWorkbookAiProposal | undefined> {
    await this.load();
    const project = required(projectId, "Project id");
    const id = required(proposalId, "Workbook AI proposal id");
    const proposal = this.proposals.find((item) => item.projectId === project && item.id === id);
    return proposal ? clone(proposal) : undefined;
  }

  async list(projectId: string): Promise<readonly StoredWorkbookAiProposal[]> {
    await this.load();
    const project = required(projectId, "Project id");
    return this.proposals
      .filter((item) => item.projectId === project)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
      .map(clone);
  }

  async decide(projectId: string, proposalId: string, decision: "approved" | "rejected", now = new Date().toISOString()): Promise<StoredWorkbookAiProposal> {
    await this.load();
    const project = required(projectId, "Project id");
    const id = required(proposalId, "Workbook AI proposal id");
    const index = this.proposals.findIndex((item) => item.projectId === project && item.id === id);
    if (index < 0) throw new Error("Workbook AI proposal not found.");
    const current = this.proposals[index];
    if (current.status === decision) return clone(current);
    if (current.status !== "pending") throw new Error(`Workbook AI proposal is already ${current.status}.`);
    const decidedAt = iso(now, "Workbook AI proposal decision timestamp");
    if (Date.parse(decidedAt) < Date.parse(current.createdAt)) throw new Error("Workbook AI proposal decision cannot predate creation.");
    const next: StoredWorkbookAiProposal = { ...current, status: decision, decidedAt };
    validateProposal(next);
    this.proposals[index] = clone(next);
    await this.persist();
    return clone(next);
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as PersistedState;
      if (parsed.formatVersion !== EDUCATIONAL_WORKBOOK_AI_PROPOSAL_STORE_FORMAT_VERSION || !Array.isArray(parsed.proposals)) throw new Error("Unsupported or corrupt Educational Workbook AI proposal store.");
      const ids = new Set<string>();
      this.proposals = parsed.proposals.map((proposal) => {
        validateProposal(proposal);
        if (ids.has(proposal.id)) throw new Error(`Duplicate workbook AI proposal id "${proposal.id}" in store.`);
        ids.add(proposal.id);
        return clone(proposal);
      });
    } catch (error) {
      if (!isMissingFile(error)) throw error;
    }
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const state: PersistedState = {
      formatVersion: EDUCATIONAL_WORKBOOK_AI_PROPOSAL_STORE_FORMAT_VERSION,
      proposals: this.proposals.map(clone),
    };
    const temp = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temp, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    await rename(temp, this.filePath);
  }
}

function validateProposal(proposal: StoredWorkbookAiProposal): void {
  required(proposal.id, "Workbook AI proposal id");
  required(proposal.projectId, "Project id");
  if (proposal.status !== "pending" && proposal.status !== "approved" && proposal.status !== "rejected") throw new Error("Invalid workbook AI proposal status.");
  iso(proposal.createdAt, "Workbook AI proposal createdAt");
  if (proposal.status === "pending" && proposal.decidedAt !== undefined) throw new Error("Pending workbook AI proposal cannot have a decision timestamp.");
  if (proposal.status !== "pending" && !proposal.decidedAt) throw new Error("Decided workbook AI proposal requires a decision timestamp.");
  if (proposal.decidedAt && Date.parse(iso(proposal.decidedAt, "Workbook AI proposal decidedAt")) < Date.parse(proposal.createdAt)) throw new Error("Workbook AI proposal decision cannot predate creation.");
  if (!Array.isArray(proposal.activities) || !proposal.activities.length) throw new Error("Workbook AI proposal requires activities.");
  for (const activity of proposal.activities) {
    validateWorkbookActivity(activity);
    if (activity.projectId !== proposal.projectId) throw new Error("Workbook AI proposal contains another project's activity.");
  }
  if (!proposal.ai || typeof proposal.ai !== "object") throw new Error("Workbook AI proposal requires provider evidence.");
  required(proposal.ai.provider, "Workbook AI proposal provider");
  required(proposal.ai.model, "Workbook AI proposal model");
}

function cloneActivity(activity: WorkbookActivity): WorkbookActivity { return clone(activity); }
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function required(value: string, label: string): string { if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`); return value.trim(); }
function iso(value: string, label: string): string { const parsed = new Date(value); if (!Number.isFinite(parsed.getTime())) throw new Error(`${label} must be a valid timestamp.`); return parsed.toISOString(); }
function isMissingFile(error: unknown): boolean { return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ENOENT"); }

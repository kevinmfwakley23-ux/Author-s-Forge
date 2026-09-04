import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  FORGE_EXECUTION_FORMAT_VERSION,
  FORGE_EXECUTION_STATUSES,
  digestForgeExecutionPlan,
  type ForgeExecutionJob,
  type ForgeExecutionJobStore,
} from "../application/forge-execution-fabric";

export const FILE_FORGE_EXECUTION_STORE_FORMAT_VERSION = 1 as const;

type PersistedExecutionState = {
  readonly formatVersion: typeof FILE_FORGE_EXECUTION_STORE_FORMAT_VERSION;
  readonly jobs: readonly ForgeExecutionJob[];
};

/** Durable append/update ledger for author-approved Forge execution jobs. */
export class FileForgeExecutionStore implements ForgeExecutionJobStore {
  private loaded = false;
  private jobs = new Map<string, ForgeExecutionJob>();
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {
    if (!filePath.trim()) throw new Error("Forge execution store path is required.");
  }

  async list(projectId?: string): Promise<readonly ForgeExecutionJob[]> {
    await this.load();
    const jobs = [...this.jobs.values()]
      .filter((job) => !projectId || job.projectId === projectId)
      .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt) || a.id.localeCompare(b.id));
    return jobs.map(cloneJob);
  }

  async get(jobId: string): Promise<ForgeExecutionJob | null> {
    await this.load();
    const job = this.jobs.get(jobId);
    return job ? cloneJob(job) : null;
  }

  async put(job: ForgeExecutionJob): Promise<void> {
    await this.load();
    const validated = validateJob(job);
    this.jobs.set(validated.id, validated);
    this.writeQueue = this.writeQueue.then(() => this.persist());
    await this.writeQueue;
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await readFile(this.filePath, "utf8");
      const state = validateState(JSON.parse(raw));
      this.jobs = new Map(state.jobs.map((job) => [job.id, job]));
    } catch (error) {
      if (!isMissingFile(error)) throw error;
    }
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    const state: PersistedExecutionState = {
      formatVersion: FILE_FORGE_EXECUTION_STORE_FORMAT_VERSION,
      jobs: [...this.jobs.values()].sort((a, b) => a.requestedAt.localeCompare(b.requestedAt) || a.id.localeCompare(b.id)),
    };
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    await rename(temporaryPath, this.filePath);
  }
}

function validateState(value: unknown): PersistedExecutionState {
  if (!value || typeof value !== "object") throw new Error("Invalid Forge execution store.");
  const candidate = value as Record<string, unknown>;
  if (candidate.formatVersion !== FILE_FORGE_EXECUTION_STORE_FORMAT_VERSION || !Array.isArray(candidate.jobs)) {
    throw new Error("Unsupported or corrupt Forge execution store.");
  }
  const ids = new Set<string>();
  const jobs = candidate.jobs.map((value) => {
    const job = validateJob(value as ForgeExecutionJob);
    if (ids.has(job.id)) throw new Error(`Duplicate Forge execution job ${job.id}.`);
    ids.add(job.id);
    return job;
  });
  return { formatVersion: FILE_FORGE_EXECUTION_STORE_FORMAT_VERSION, jobs };
}

function validateJob(job: ForgeExecutionJob): ForgeExecutionJob {
  if (!job || typeof job !== "object" || job.formatVersion !== FORGE_EXECUTION_FORMAT_VERSION) throw new Error("Invalid Forge execution job.");
  if (!job.id?.trim() || !job.projectId?.trim() || !job.title?.trim()) throw new Error("Forge execution job identity is incomplete.");
  if (!FORGE_EXECUTION_STATUSES.includes(job.status)) throw new Error(`Forge execution job ${job.id} has invalid status.`);
  if (job.requestedBy !== "author" && job.requestedBy !== "ai") throw new Error(`Forge execution job ${job.id} has invalid requester.`);
  if (!Number.isFinite(Date.parse(job.requestedAt))) throw new Error(`Forge execution job ${job.id} has invalid request time.`);
  const digest = digestForgeExecutionPlan(job.plan);
  if (digest !== job.planDigest) throw new Error(`Forge execution job ${job.id} plan digest mismatch.`);
  if (["approved", "running", "succeeded", "failed"].includes(job.status) && (job.approvedBy !== "author" || !job.approvedAt)) {
    throw new Error(`Forge execution job ${job.id} lacks author approval evidence.`);
  }
  if (job.status === "rejected" && (!job.rejectedAt || !job.rejectionReason?.trim())) throw new Error(`Forge execution job ${job.id} lacks rejection evidence.`);
  if (job.evidence && job.evidence.approvedPlanDigest !== job.planDigest) throw new Error(`Forge execution job ${job.id} execution evidence does not match the approved plan.`);
  return cloneJob(job);
}

function cloneJob(job: ForgeExecutionJob): ForgeExecutionJob {
  return JSON.parse(JSON.stringify(job)) as ForgeExecutionJob;
}

function isMissingFile(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ENOENT");
}

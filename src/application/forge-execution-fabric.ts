import { createHash, randomUUID } from "node:crypto";

export const FORGE_EXECUTION_FORMAT_VERSION = 1 as const;
export const FORGE_EXECUTION_STATUSES = ["pending", "approved", "rejected", "running", "succeeded", "failed"] as const;
export type ForgeExecutionStatus = typeof FORGE_EXECUTION_STATUSES[number];
export type ForgeExecutionProviderKind = "local-linux" | "daytona" | "e2b";

export interface ForgeExecutionCommand {
  readonly program: string;
  readonly args?: readonly string[];
  readonly cwd?: string;
  readonly timeoutSeconds?: number;
}

export interface ForgeExecutionPlan {
  readonly provider: ForgeExecutionProviderKind;
  readonly commands: readonly ForgeExecutionCommand[];
  readonly networkDomains?: readonly string[];
  readonly purpose: string;
}

export interface ForgeExecutionCommandResult {
  readonly program: string;
  readonly args: readonly string[];
  readonly cwd?: string;
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly startedAt: string;
  readonly finishedAt: string;
}

export interface ForgeExecutionProviderResult {
  readonly provider: ForgeExecutionProviderKind;
  readonly sandboxId?: string;
  readonly commands: readonly ForgeExecutionCommandResult[];
}

export interface ForgeExecutionEvidence extends ForgeExecutionProviderResult {
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly approvedPlanDigest: string;
}

export interface ForgeExecutionJob {
  readonly formatVersion: typeof FORGE_EXECUTION_FORMAT_VERSION;
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly requestedBy: "author" | "ai";
  readonly requestedAt: string;
  readonly status: ForgeExecutionStatus;
  readonly plan: ForgeExecutionPlan;
  readonly planDigest: string;
  readonly approvedAt?: string;
  readonly approvedBy?: "author";
  readonly rejectedAt?: string;
  readonly rejectionReason?: string;
  readonly evidence?: ForgeExecutionEvidence;
  readonly failure?: string;
}

export interface ForgeExecutionJobStore {
  list(projectId?: string): Promise<readonly ForgeExecutionJob[]>;
  get(jobId: string): Promise<ForgeExecutionJob | null>;
  put(job: ForgeExecutionJob): Promise<void>;
}

export interface ForgeExecutionProvider {
  readonly kind: ForgeExecutionProviderKind;
  readonly available: boolean;
  execute(job: ForgeExecutionJob): Promise<ForgeExecutionProviderResult>;
}

export interface ForgeExecutionProposalInput {
  readonly projectId: string;
  readonly title: string;
  readonly requestedBy: "author" | "ai";
  readonly plan: ForgeExecutionPlan;
  readonly id?: string;
  readonly now?: string;
}

/**
 * Author-governed execution boundary for build/inspection/tool jobs.
 *
 * AI may propose an exact plan, but execution is impossible until the author
 * approves that exact plan digest. Execution evidence is durable through the
 * supplied store and is deliberately separate from canonical manuscript/art
 * state: downstream code must perform its own author-approved import/apply.
 */
export class ForgeExecutionFabric {
  private readonly providers = new Map<ForgeExecutionProviderKind, ForgeExecutionProvider>();

  constructor(
    private readonly store: ForgeExecutionJobStore,
    providers: readonly ForgeExecutionProvider[] = [],
  ) {
    for (const provider of providers) this.registerProvider(provider);
  }

  registerProvider(provider: ForgeExecutionProvider): void {
    if (this.providers.has(provider.kind)) throw new Error(`Execution provider ${provider.kind} is already registered.`);
    this.providers.set(provider.kind, provider);
  }

  providerStatus(): readonly { kind: ForgeExecutionProviderKind; available: boolean }[] {
    return [...this.providers.values()].map((provider) => ({ kind: provider.kind, available: provider.available }));
  }

  async propose(input: ForgeExecutionProposalInput): Promise<ForgeExecutionJob> {
    const plan = normalizePlan(input.plan);
    const projectId = requireText(input.projectId, "Execution project id");
    const title = requireText(input.title, "Execution title");
    const id = input.id?.trim() || randomUUID();
    if (await this.store.get(id)) throw new Error(`Execution job ${id} already exists.`);
    const job: ForgeExecutionJob = {
      formatVersion: FORGE_EXECUTION_FORMAT_VERSION,
      id,
      projectId,
      title,
      requestedBy: input.requestedBy,
      requestedAt: validIso(input.now) ?? new Date().toISOString(),
      status: "pending",
      plan,
      planDigest: digestPlan(plan),
    };
    await this.store.put(job);
    return cloneJob(job);
  }

  async approve(jobId: string, actor: "author" | "ai" = "author", now?: string): Promise<ForgeExecutionJob> {
    if (actor !== "author") throw new Error("Only the author can approve an execution job.");
    const job = await this.requireJob(jobId);
    if (job.status !== "pending") throw new Error(`Execution job ${job.id} is ${job.status}, not pending.`);
    assertPlanIntegrity(job);
    const approved: ForgeExecutionJob = {
      ...job,
      status: "approved",
      approvedAt: validIso(now) ?? new Date().toISOString(),
      approvedBy: "author",
    };
    await this.store.put(approved);
    return cloneJob(approved);
  }

  async reject(jobId: string, reason: string, now?: string): Promise<ForgeExecutionJob> {
    const job = await this.requireJob(jobId);
    if (job.status !== "pending" && job.status !== "approved") throw new Error(`Execution job ${job.id} cannot be rejected from ${job.status}.`);
    const rejected: ForgeExecutionJob = {
      ...job,
      status: "rejected",
      rejectedAt: validIso(now) ?? new Date().toISOString(),
      rejectionReason: requireText(reason, "Execution rejection reason"),
    };
    await this.store.put(rejected);
    return cloneJob(rejected);
  }

  async execute(jobId: string): Promise<ForgeExecutionJob> {
    const job = await this.requireJob(jobId);
    if (job.status !== "approved" || job.approvedBy !== "author" || !job.approvedAt) {
      throw new Error("Execution requires explicit author approval.");
    }
    assertPlanIntegrity(job);
    const provider = this.providers.get(job.plan.provider);
    if (!provider || !provider.available) throw new Error(`Execution provider ${job.plan.provider} is not available.`);

    const startedAt = new Date().toISOString();
    await this.store.put({ ...job, status: "running", failure: undefined });
    try {
      const result = await provider.execute(job);
      if (result.provider !== job.plan.provider) throw new Error("Execution provider result identity mismatch.");
      const failedCommand = result.commands.find((command) => command.exitCode !== 0);
      const evidence: ForgeExecutionEvidence = {
        ...cloneProviderResult(result),
        startedAt,
        finishedAt: new Date().toISOString(),
        approvedPlanDigest: job.planDigest,
      };
      const completed: ForgeExecutionJob = {
        ...job,
        status: failedCommand ? "failed" : "succeeded",
        evidence,
        ...(failedCommand ? { failure: `Command ${failedCommand.program} exited with ${failedCommand.exitCode}.` } : {}),
      };
      await this.store.put(completed);
      return cloneJob(completed);
    } catch (error) {
      const failed: ForgeExecutionJob = {
        ...job,
        status: "failed",
        failure: error instanceof Error ? error.message : String(error),
      };
      await this.store.put(failed);
      return cloneJob(failed);
    }
  }

  async get(jobId: string): Promise<ForgeExecutionJob | null> {
    const job = await this.store.get(jobId);
    return job ? cloneJob(job) : null;
  }

  async list(projectId?: string): Promise<readonly ForgeExecutionJob[]> {
    return (await this.store.list(projectId)).map(cloneJob);
  }

  private async requireJob(jobId: string): Promise<ForgeExecutionJob> {
    const id = requireText(jobId, "Execution job id");
    const job = await this.store.get(id);
    if (!job) throw new Error(`Execution job ${id} does not exist.`);
    return job;
  }
}

export function digestForgeExecutionPlan(plan: ForgeExecutionPlan): string {
  return digestPlan(normalizePlan(plan));
}

function normalizePlan(plan: ForgeExecutionPlan): ForgeExecutionPlan {
  if (!plan || typeof plan !== "object") throw new Error("Execution plan is required.");
  if (!["local-linux", "daytona", "e2b"].includes(plan.provider)) throw new Error(`Unsupported execution provider: ${String(plan.provider)}.`);
  const purpose = requireText(plan.purpose, "Execution purpose");
  if (!Array.isArray(plan.commands) || plan.commands.length === 0) throw new Error("Execution plan requires at least one command.");
  if (plan.commands.length > 24) throw new Error("Execution plan exceeds the 24-command safety limit.");
  const commands = plan.commands.map((command, index) => normalizeCommand(command, index));
  const networkDomains = [...new Set((plan.networkDomains ?? []).map((domain) => normalizeDomain(domain)))].sort();
  if (networkDomains.length > 20) throw new Error("Execution plan exceeds the 20-domain network allow-list limit.");
  return { provider: plan.provider, purpose, commands, ...(networkDomains.length ? { networkDomains } : {}) };
}

function normalizeCommand(command: ForgeExecutionCommand, index: number): ForgeExecutionCommand {
  if (!command || typeof command !== "object") throw new Error(`Execution command ${index + 1} is invalid.`);
  const program = requireText(command.program, `Execution command ${index + 1} program`);
  if (/\r|\n|\0/.test(program)) throw new Error(`Execution command ${index + 1} program contains control characters.`);
  const args = (command.args ?? []).map((arg) => {
    const value = String(arg);
    if (value.includes("\0")) throw new Error(`Execution command ${index + 1} argument contains a null byte.`);
    return value;
  });
  if (args.length > 128) throw new Error(`Execution command ${index + 1} has too many arguments.`);
  const cwd = command.cwd?.trim();
  if (cwd && (cwd.includes("\0") || cwd.split(/[\\/]+/).includes(".."))) throw new Error(`Execution command ${index + 1} has an unsafe working directory.`);
  const timeoutSeconds = command.timeoutSeconds === undefined ? 120 : Math.floor(command.timeoutSeconds);
  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds < 1 || timeoutSeconds > 900) throw new Error(`Execution command ${index + 1} timeout must be between 1 and 900 seconds.`);
  return { program, args, ...(cwd ? { cwd } : {}), timeoutSeconds };
}

function normalizeDomain(domain: string): string {
  const value = requireText(domain, "Execution network domain").toLowerCase();
  if (value.includes("://") || value.includes("/") || value.includes(":") || !/^(?:\*\.)?[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(value)) {
    throw new Error(`Invalid execution network domain: ${domain}.`);
  }
  return value;
}

function digestPlan(plan: ForgeExecutionPlan): string {
  const canonical = JSON.stringify({
    provider: plan.provider,
    purpose: plan.purpose,
    networkDomains: [...(plan.networkDomains ?? [])],
    commands: plan.commands.map((command) => ({ program: command.program, args: [...(command.args ?? [])], cwd: command.cwd ?? null, timeoutSeconds: command.timeoutSeconds ?? 120 })),
  });
  return createHash("sha256").update(canonical).digest("hex");
}

function assertPlanIntegrity(job: ForgeExecutionJob): void {
  if (job.formatVersion !== FORGE_EXECUTION_FORMAT_VERSION) throw new Error("Unsupported execution job format.");
  if (digestPlan(normalizePlan(job.plan)) !== job.planDigest) throw new Error("Execution plan changed after proposal; author approval is invalid.");
}

function requireText(value: string, label: string): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`${label} is required.`);
  if (normalized.length > 4000) throw new Error(`${label} is too long.`);
  return normalized;
}

function validIso(value?: string): string | undefined {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error("Execution timestamp must be ISO-compatible.");
  return new Date(parsed).toISOString();
}

function cloneProviderResult(result: ForgeExecutionProviderResult): ForgeExecutionProviderResult {
  return { ...result, commands: result.commands.map((command) => ({ ...command, args: [...command.args] })) };
}

function cloneJob(job: ForgeExecutionJob): ForgeExecutionJob {
  return {
    ...job,
    plan: {
      ...job.plan,
      commands: job.plan.commands.map((command) => ({ ...command, args: [...(command.args ?? [])] })),
      ...(job.plan.networkDomains ? { networkDomains: [...job.plan.networkDomains] } : {}),
    },
    ...(job.evidence ? { evidence: cloneProviderResult(job.evidence) as ForgeExecutionEvidence } : {}),
  };
}

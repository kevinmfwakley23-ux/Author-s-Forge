import type {
  ForgeExecutionCommand,
  ForgeExecutionCommandResult,
  ForgeExecutionJob,
  ForgeExecutionProvider,
  ForgeExecutionProviderResult,
} from "../application/forge-execution-fabric";

export interface DaytonaExecutionProviderOptions {
  readonly apiKey: string;
  readonly apiUrl?: string;
  readonly toolboxUrl?: string;
  readonly language?: "typescript" | "javascript" | "python";
  readonly ttlMinutes?: number;
  readonly fetchImpl?: typeof fetch;
}

/** Cloud sandbox adapter using Daytona's documented REST/toolbox boundaries. */
export class DaytonaExecutionProvider implements ForgeExecutionProvider {
  readonly kind = "daytona" as const;
  readonly available: boolean;
  private readonly apiUrl: string;
  private readonly toolboxUrl: string;
  private readonly ttlMinutes: number;
  private readonly request: typeof fetch;

  constructor(private readonly options: DaytonaExecutionProviderOptions) {
    this.available = Boolean(options.apiKey.trim());
    this.apiUrl = stripTrailingSlash(options.apiUrl ?? "https://app.daytona.io/api");
    this.toolboxUrl = stripTrailingSlash(options.toolboxUrl ?? "https://proxy.app.daytona.io/toolbox");
    this.ttlMinutes = Math.max(5, Math.min(120, Math.floor(options.ttlMinutes ?? 30)));
    this.request = options.fetchImpl ?? fetch;
  }

  async execute(job: ForgeExecutionJob): Promise<ForgeExecutionProviderResult> {
    if (!this.available) throw new Error("Daytona execution is unavailable because DAYTONA_API_KEY is not configured.");
    const sandboxId = await this.createSandbox(job);
    const results: ForgeExecutionCommandResult[] = [];
    try {
      for (const command of job.plan.commands) {
        const result = await this.executeCommand(sandboxId, command);
        results.push(result);
        if (result.exitCode !== 0) break;
      }
      return { provider: this.kind, sandboxId, commands: results };
    } finally {
      await this.deleteSandbox(sandboxId).catch(() => undefined);
    }
  }

  private async createSandbox(job: ForgeExecutionJob): Promise<string> {
    const domains = job.plan.networkDomains ?? [];
    const body: Record<string, unknown> = {
      language: this.options.language ?? "typescript",
      ttlMinutes: this.ttlMinutes,
      ...(domains.length ? { domainAllowList: domains.join(",") } : { networkBlockAll: true }),
    };
    const response = await this.request(`${this.apiUrl}/sandbox`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body),
    });
    const payload = await parseResponse(response, "create Daytona sandbox");
    const record = payload as Record<string, unknown>;
    const id = [record.id, record.sandboxId, record.name].find((value) => typeof value === "string" && value.trim()) as string | undefined;
    if (!id) throw new Error("Daytona sandbox create response did not include an id or name.");
    return id;
  }

  private async executeCommand(sandboxId: string, command: ForgeExecutionCommand): Promise<ForgeExecutionCommandResult> {
    const startedAt = new Date().toISOString();
    const response = await this.request(`${this.toolboxUrl}/${encodeURIComponent(sandboxId)}/process/execute`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify({
        command: shellCommand(command),
        ...(command.cwd ? { cwd: command.cwd } : {}),
        timeout: command.timeoutSeconds ?? 120,
      }),
    });
    const payload = await parseResponse(response, `execute ${command.program} in Daytona`);
    const record = payload as Record<string, unknown>;
    const exitCode = typeof record.exitCode === "number" && Number.isFinite(record.exitCode) ? Math.trunc(record.exitCode) : 1;
    const result = typeof record.result === "string" ? record.result : JSON.stringify(record.result ?? "");
    return {
      program: command.program,
      args: [...(command.args ?? [])],
      ...(command.cwd ? { cwd: command.cwd } : {}),
      exitCode,
      stdout: exitCode === 0 ? result : "",
      stderr: exitCode === 0 ? "" : result,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  }

  private async deleteSandbox(sandboxId: string): Promise<void> {
    const response = await this.request(`${this.apiUrl}/sandbox/${encodeURIComponent(sandboxId)}`, {
      method: "DELETE",
      headers: this.headers(false),
    });
    if (!response.ok && response.status !== 404) {
      const text = await response.text();
      throw new Error(`Unable to delete Daytona sandbox (${response.status}): ${text.slice(0, 500)}`);
    }
  }

  private headers(json: boolean): Record<string, string> {
    return {
      Authorization: `Bearer ${this.options.apiKey}`,
      Accept: "application/json",
      ...(json ? { "Content-Type": "application/json" } : {}),
    };
  }
}

export function daytonaExecutionProviderFromEnvironment(): DaytonaExecutionProvider | null {
  const apiKey = process.env.DAYTONA_API_KEY?.trim();
  if (!apiKey) return null;
  return new DaytonaExecutionProvider({
    apiKey,
    apiUrl: process.env.DAYTONA_API_URL,
    toolboxUrl: process.env.DAYTONA_TOOLBOX_URL,
    language: parseLanguage(process.env.DAYTONA_LANGUAGE),
    ttlMinutes: parsePositiveInt(process.env.DAYTONA_TTL_MINUTES),
  });
}

function shellCommand(command: ForgeExecutionCommand): string {
  return [command.program, ...(command.args ?? [])].map(posixQuote).join(" ");
}

function posixQuote(value: string): string {
  if (/^[a-zA-Z0-9_./:@%+=,-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

async function parseResponse(response: Response, action: string): Promise<unknown> {
  const text = await response.text();
  if (!response.ok) throw new Error(`Unable to ${action} (${response.status}): ${text.slice(0, 1000)}`);
  if (!text.trim()) return {};
  try { return JSON.parse(text); } catch { throw new Error(`Unable to ${action}: provider returned non-JSON data.`); }
}

function stripTrailingSlash(value: string): string { return value.replace(/\/+$/, ""); }
function parseLanguage(value?: string): "typescript" | "javascript" | "python" | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "typescript" || normalized === "javascript" || normalized === "python") return normalized;
  throw new Error("DAYTONA_LANGUAGE must be typescript, javascript, or python.");
}
function parsePositiveInt(value?: string): number | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error("DAYTONA_TTL_MINUTES must be a positive number.");
  return Math.floor(parsed);
}

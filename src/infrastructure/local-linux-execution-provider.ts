import { realpath } from "node:fs/promises";
import { delimiter, relative, resolve } from "node:path";
import { spawn } from "node:child_process";
import type {
  ForgeExecutionCommand,
  ForgeExecutionCommandResult,
  ForgeExecutionJob,
  ForgeExecutionProvider,
  ForgeExecutionProviderResult,
} from "../application/forge-execution-fabric";

export interface LocalLinuxExecutionProviderOptions {
  readonly rootDirectory: string;
  readonly allowedExecutables: readonly string[];
  readonly enabled?: boolean;
  readonly maxOutputBytes?: number;
}

/**
 * Executes an author-approved command vector without a shell inside one
 * explicitly configured workspace root. This adapter is suitable for a Linux
 * host or Termux process only when the owner deliberately enables it.
 */
export class LocalLinuxExecutionProvider implements ForgeExecutionProvider {
  readonly kind = "local-linux" as const;
  readonly available: boolean;
  private readonly allowed: Set<string>;
  private readonly maxOutputBytes: number;

  constructor(private readonly options: LocalLinuxExecutionProviderOptions) {
    if (!options.rootDirectory.trim()) throw new Error("Local execution root directory is required.");
    this.allowed = new Set(options.allowedExecutables.map((value) => value.trim()).filter(Boolean));
    this.available = options.enabled === true && this.allowed.size > 0;
    this.maxOutputBytes = Math.max(16_384, Math.min(4_194_304, options.maxOutputBytes ?? 1_048_576));
  }

  async execute(job: ForgeExecutionJob): Promise<ForgeExecutionProviderResult> {
    if (!this.available) throw new Error("Local Linux execution is disabled or has no executable allow list.");
    const root = await realpath(resolve(this.options.rootDirectory));
    const commands: ForgeExecutionCommandResult[] = [];
    for (const command of job.plan.commands) {
      if (!this.allowed.has(command.program)) throw new Error(`Executable ${command.program} is not allowed for local execution.`);
      const cwd = await resolveSafeCwd(root, command.cwd);
      const result = await executeVector(command, cwd, this.maxOutputBytes);
      commands.push(result);
      if (result.exitCode !== 0) break;
    }
    return { provider: this.kind, commands };
  }
}

export function localLinuxExecutionProviderFromEnvironment(): LocalLinuxExecutionProvider | null {
  const rootDirectory = process.env.FORGE_EXECUTION_ROOT?.trim();
  if (!rootDirectory) return null;
  const allowedExecutables = (process.env.FORGE_LOCAL_EXECUTABLES ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return new LocalLinuxExecutionProvider({
    rootDirectory,
    allowedExecutables,
    enabled: process.env.FORGE_LOCAL_EXECUTION === "1",
  });
}

async function resolveSafeCwd(root: string, requested?: string): Promise<string> {
  const candidate = requested?.trim() ? resolve(root, requested) : root;
  const actual = await realpath(candidate);
  const relation = relative(root, actual);
  if (relation === ".." || relation.startsWith(`..${delimiter}`) || resolve(root, relation) !== actual) {
    throw new Error("Execution working directory escapes the configured workspace root.");
  }
  return actual;
}

async function executeVector(command: ForgeExecutionCommand, cwd: string, maxOutputBytes: number): Promise<ForgeExecutionCommandResult> {
  const startedAt = new Date().toISOString();
  const timeoutMs = (command.timeoutSeconds ?? 120) * 1000;
  return new Promise((resolveResult, reject) => {
    const child = spawn(command.program, [...(command.args ?? [])], {
      cwd,
      shell: false,
      windowsHide: true,
      env: minimalEnvironment(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    let outputExceeded = false;
    const collect = (current: Buffer, chunk: Buffer): Buffer => {
      if (current.length >= maxOutputBytes) { outputExceeded = true; return current; }
      const remaining = maxOutputBytes - current.length;
      if (chunk.length > remaining) outputExceeded = true;
      return Buffer.concat([current, chunk.subarray(0, remaining)]);
    };
    child.stdout.on("data", (chunk: Buffer) => { stdout = collect(stdout, chunk); });
    child.stderr.on("data", (chunk: Buffer) => { stderr = collect(stderr, chunk); });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => { if (!child.killed) child.kill("SIGKILL"); }, 1_000).unref();
    }, timeoutMs);
    timer.unref();
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      const suffix = [timedOut ? `Command timed out after ${command.timeoutSeconds ?? 120}s.` : "", outputExceeded ? `Output truncated at ${maxOutputBytes} bytes.` : "", signal ? `Process signal: ${signal}.` : ""].filter(Boolean).join(" ");
      const stderrText = `${stderr.toString("utf8")}${suffix ? `${stderr.length ? "\n" : ""}${suffix}` : ""}`;
      resolveResult({
        program: command.program,
        args: [...(command.args ?? [])],
        ...(command.cwd ? { cwd: command.cwd } : {}),
        exitCode: timedOut ? 124 : (code ?? 1),
        stdout: stdout.toString("utf8"),
        stderr: stderrText,
        startedAt,
        finishedAt: new Date().toISOString(),
      });
    });
  });
}

function minimalEnvironment(): NodeJS.ProcessEnv {
  const keys = ["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "TERM"];
  const env: NodeJS.ProcessEnv = {};
  for (const key of keys) if (process.env[key] !== undefined) env[key] = process.env[key];
  return env;
}

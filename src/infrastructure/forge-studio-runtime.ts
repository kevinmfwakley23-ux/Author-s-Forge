import { join } from "node:path";
import type { ProjectStorePort } from "../application/project-store-port";
import { ForgeCore, createForgeCore } from "../application/forge-core";
import { ForgeExecutionFabric, type ForgeExecutionProvider } from "../application/forge-execution-fabric";
import { bindForgeAiRuntime } from "./ai-provider";
import { FileProjectStore } from "./file-project-store";
import { FileForgeExecutionStore } from "./file-forge-execution-store";
import { LocalLinuxExecutionProvider } from "./local-linux-execution-provider";
import { DaytonaExecutionProvider } from "./daytona-execution-provider";
import { discoverConfiguredAiModelResources } from "./ai-model-resources";

/** Canonical production composition shared by the Studio server and device launchers. */
export interface ForgeStudioRuntime {
  readonly core: ForgeCore;
  readonly projectStore: ProjectStorePort;
  readonly execution: ForgeExecutionFabric;
}

export function createForgeStudioRuntime(dataRoot: string, env: NodeJS.ProcessEnv = process.env): ForgeStudioRuntime {
  const projectStore = new FileProjectStore(dataRoot);
  const executionStore = new FileForgeExecutionStore(join(dataRoot, "execution", "jobs.json"));
  const execution = new ForgeExecutionFabric(executionStore, discoverExecutionProviders(env));
  const core = createForgeCore({ projectStore, executionFabric: execution });
  core.registerAiModels(discoverConfiguredAiModelResources(env));
  // Production callers use the real process environment and therefore bind the
  // shared provider boundary to this exact ForgeCore broker/routing instance.
  // Tests that inject an isolated env retain deterministic local composition.
  if (env === process.env) bindForgeAiRuntime(core.ai, core.routing);
  return { core, projectStore, execution };
}

export function createDefaultForgeStudioRuntime(cwd = process.cwd(), env: NodeJS.ProcessEnv = process.env): ForgeStudioRuntime {
  return createForgeStudioRuntime(env.FORGE_DATA_DIR ?? join(cwd, ".forge-data"), env);
}

function discoverExecutionProviders(env: NodeJS.ProcessEnv): ForgeExecutionProvider[] {
  const providers: ForgeExecutionProvider[] = [];
  const localRoot = env.FORGE_EXECUTION_ROOT?.trim();
  if (localRoot) {
    providers.push(new LocalLinuxExecutionProvider({
      rootDirectory: localRoot,
      allowedExecutables: (env.FORGE_LOCAL_EXECUTABLES ?? "").split(",").map((value) => value.trim()).filter(Boolean),
      enabled: env.FORGE_LOCAL_EXECUTION === "1",
    }));
  }
  const daytonaKey = env.DAYTONA_API_KEY?.trim();
  if (daytonaKey) {
    providers.push(new DaytonaExecutionProvider({
      apiKey: daytonaKey,
      apiUrl: env.DAYTONA_API_URL,
      toolboxUrl: env.DAYTONA_TOOLBOX_URL,
      language: executionLanguage(env.DAYTONA_LANGUAGE),
      ttlMinutes: positiveInteger(env.DAYTONA_TTL_MINUTES),
    }));
  }
  return providers;
}

function executionLanguage(value?: string): "typescript" | "javascript" | "python" | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "typescript" || normalized === "javascript" || normalized === "python") return normalized;
  throw new Error("DAYTONA_LANGUAGE must be typescript, javascript, or python.");
}

function positiveInteger(value?: string): number | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error("DAYTONA_TTL_MINUTES must be a positive number.");
  return Math.floor(parsed);
}

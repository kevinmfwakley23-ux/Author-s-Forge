import { join } from "node:path";
import type { ProjectStorePort } from "../application/project-store-port";
import { CoreGovernanceAuthority } from "../application/core-governance-authority";
import { ForgeCore, createForgeCore } from "../application/forge-core";
import { bindForgeAiRuntime } from "./ai-provider";
import { FileProjectStore } from "./file-project-store";
import { discoverConfiguredAiModelResources } from "./ai-model-resources";

/** Canonical production composition shared by the Studio server and device launchers. */
export interface ForgeStudioRuntime {
  readonly core: ForgeCore;
  readonly projectStore: ProjectStorePort;
  readonly governance: CoreGovernanceAuthority;
}

export function createForgeStudioRuntime(dataRoot: string, env: NodeJS.ProcessEnv = process.env): ForgeStudioRuntime {
  const projectStore = new FileProjectStore(dataRoot);
  const core = createForgeCore({ projectStore });
  const governance = new CoreGovernanceAuthority();
  core.registerAiModels(discoverConfiguredAiModelResources(env));
  // Production callers use the real process environment and therefore bind the
  // shared provider boundary to this exact ForgeCore broker/routing instance.
  // Tests that inject an isolated env retain deterministic local composition.
  if (env === process.env) bindForgeAiRuntime(core.ai, core.routing);
  return { core, projectStore, governance };
}

export function createDefaultForgeStudioRuntime(cwd = process.cwd(), env: NodeJS.ProcessEnv = process.env): ForgeStudioRuntime {
  return createForgeStudioRuntime(env.FORGE_DATA_DIR ?? join(cwd, ".forge-data"), env);
}

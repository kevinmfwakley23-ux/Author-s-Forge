import { join } from "node:path";
import type { ProjectStorePort } from "../application/project-store-port";
import { ForgeCore, createForgeCore } from "../application/forge-core";
import { FileProjectStore } from "./file-project-store";
import { discoverConfiguredAiModelResources } from "./ai-model-resources";

/** Canonical production composition shared by the Studio server and device launchers. */
export interface ForgeStudioRuntime {
  readonly core: ForgeCore;
  readonly projectStore: ProjectStorePort;
}

export function createForgeStudioRuntime(dataRoot: string, env: NodeJS.ProcessEnv = process.env): ForgeStudioRuntime {
  const projectStore = new FileProjectStore(dataRoot);
  const core = createForgeCore({ projectStore });
  core.registerAiModels(discoverConfiguredAiModelResources(env));
  return { core, projectStore };
}

export function createDefaultForgeStudioRuntime(cwd = process.cwd(), env: NodeJS.ProcessEnv = process.env): ForgeStudioRuntime {
  return createForgeStudioRuntime(env.FORGE_DATA_DIR ?? join(cwd, ".forge-data"), env);
}

import { join } from "node:path";
import { FileProjectStore } from "./file-project-store";
import { createForgeCore, type ForgeCore } from "../application/forge-core";
import { discoverConfiguredAiModelResources } from "./ai-model-resources";

/** Production composition root for the shared Forge Brain. */
export function createForgeCoreRuntime(dataRoot: string): ForgeCore {
  const projectStore = new FileProjectStore(dataRoot);
  const core = createForgeCore({ projectStore });
  core.registerAiModels(discoverConfiguredAiModelResources());
  return core;
}

/** Standard runtime location used by Studio and device launchers. */
export function createDefaultForgeCoreRuntime(cwd = process.cwd()): ForgeCore {
  return createForgeCoreRuntime(process.env.FORGE_DATA_DIR ?? join(cwd, ".forge-data"));
}

import { join } from "node:path";
import type { ProjectStorePort } from "../application/project-store-port";
import { ForgeCore, createForgeCore } from "../application/forge-core";
import type { AiTask } from "../application/ai-model-broker";
import { FileProjectStore } from "./file-project-store";
import { discoverConfiguredAiModelResources } from "./ai-model-resources";
import { generateTextThroughCore, type AiGenerationRequest, type AiGenerationResult } from "./ai-provider";
import { generateProjectTextThroughCore, type CoreProjectAiGenerationRequest } from "./core-project-ai-provider";

/** Canonical production composition shared by the Studio server and device launchers. */
export interface ForgeStudioRuntime {
  readonly core: ForgeCore;
  readonly projectStore: ProjectStorePort;
  readonly generateText: (request: AiGenerationRequest, task?: AiTask) => Promise<AiGenerationResult>;
  readonly generateProjectText: (request: CoreProjectAiGenerationRequest, task?: AiTask) => Promise<AiGenerationResult>;
}

export function createForgeStudioRuntime(dataRoot: string, env: NodeJS.ProcessEnv = process.env): ForgeStudioRuntime {
  const projectStore = new FileProjectStore(dataRoot);
  const core = createForgeCore({ projectStore });
  core.registerAiModels(discoverConfiguredAiModelResources(env));
  return {
    core,
    projectStore,
    generateText: (request, task = "writing") => generateTextThroughCore(core, request, task),
    generateProjectText: (request, task = "writing") => generateProjectTextThroughCore(core, request, task),
  };
}

export function createDefaultForgeStudioRuntime(cwd = process.cwd(), env: NodeJS.ProcessEnv = process.env): ForgeStudioRuntime {
  return createForgeStudioRuntime(env.FORGE_DATA_DIR ?? join(cwd, ".forge-data"), env);
}

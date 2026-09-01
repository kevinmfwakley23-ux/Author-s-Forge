import { buildProjectContext } from "../application/context-pipeline";
import type { ForgeCore } from "../application/forge-core";
import type { AiTask } from "../application/ai-model-broker";
import type { ProjectBrainQuery } from "../application/project-brain";
import type { ProjectMemoryStore } from "../application/project-memory-store";
import { estimateTokens } from "../application/context-optimizer";
import { generateTextThroughCore, type AiGenerationRequest, type AiGenerationResult } from "./ai-provider";

export interface CoreProjectAiGenerationRequest extends Omit<AiGenerationRequest, "system"> {
  readonly system?: string;
  readonly memory: ProjectMemoryStore;
  readonly context: ProjectBrainQuery;
  readonly contextBudget?: number;
}

/**
 * Project-aware generation through the canonical ForgeCore routing boundary.
 *
 * Project Brain retrieval/budgeting happens before provider dispatch, while
 * model selection, retries, failover, cooldowns and runtime telemetry remain
 * exclusively owned by ForgeCore. This prevents project-aware callers from
 * falling back to the legacy environment-order provider path.
 */
export async function generateProjectTextThroughCore(
  core: ForgeCore,
  request: CoreProjectAiGenerationRequest,
  task: AiTask = "writing",
): Promise<AiGenerationResult> {
  const projectContext = buildProjectContext(request.memory, {
    query: request.context,
    budget: request.contextBudget,
  });
  const system = [request.system?.trim(), projectContext.system].filter(Boolean).join("\n\n");
  const result = await generateTextThroughCore(core, {
    system,
    user: request.user,
    temperature: request.temperature,
    maxOutputTokens: request.maxOutputTokens,
  }, task);

  if (!result.optimization) return result;
  const originalEstimatedTokens = projectContext.originalEstimatedTokens
    + estimateTokens([request.system?.trim(), request.user].filter(Boolean).join("\n\n"));
  const optimizedEstimatedTokens = result.optimization.optimizedEstimatedTokens;
  const tokensSaved = Math.max(0, originalEstimatedTokens - optimizedEstimatedTokens);

  return {
    ...result,
    optimization: {
      originalEstimatedTokens,
      optimizedEstimatedTokens,
      tokensSaved,
      compressionRatio: originalEstimatedTokens > 0 ? optimizedEstimatedTokens / originalEstimatedTokens : 1,
      strategy: [...projectContext.strategies, ...result.optimization.strategy],
    },
  };
}

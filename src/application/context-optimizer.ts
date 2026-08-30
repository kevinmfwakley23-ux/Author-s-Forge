import { classifyContextPayload } from "./context-payload-classifier";
import { createDefaultContextEngineRegistry } from "./context-engines";

export interface ContextOptimizationInput {
  readonly system: string;
  readonly user: string;
  readonly maxInputTokens?: number;
}

export interface ContextOptimizationResult {
  readonly system: string;
  readonly user: string;
  readonly originalEstimatedTokens: number;
  readonly optimizedEstimatedTokens: number;
  readonly tokensSaved: number;
  readonly compressionRatio: number;
  readonly strategy: readonly string[];
  readonly changed: boolean;
}

const TOKEN_CHARS = 4;
const DEFAULT_ENGINE_REGISTRY = createDefaultContextEngineRegistry();

export function estimateTokens(text: string): number {
  const normalized = text.trim();
  if (!normalized) return 0;
  return Math.max(1, Math.ceil(normalized.length / TOKEN_CHARS));
}

function optimizePayload(text: string, sourceName: string) {
  const classification = classifyContextPayload(text, sourceName);
  return DEFAULT_ENGINE_REGISTRY.optimize({
    text,
    kind: classification.kind,
    sourceName,
  });
}

export function optimizeContext(input: ContextOptimizationInput): ContextOptimizationResult {
  const originalEstimatedTokens = estimateTokens(input.system) + estimateTokens(input.user);
  const system = optimizePayload(input.system, "system.txt");
  const user = optimizePayload(input.user, "user.txt");
  const optimizedEstimatedTokens = estimateTokens(system.text) + estimateTokens(user.text);
  const maxInputTokens = input.maxInputTokens;
  const overBudget = maxInputTokens !== undefined && optimizedEstimatedTokens > maxInputTokens;
  const strategy = [...system.strategy, ...user.strategy];

  if (optimizedEstimatedTokens >= originalEstimatedTokens || (overBudget && optimizedEstimatedTokens >= originalEstimatedTokens)) {
    return {
      system: input.system,
      user: input.user,
      originalEstimatedTokens,
      optimizedEstimatedTokens: originalEstimatedTokens,
      tokensSaved: 0,
      compressionRatio: 1,
      strategy: ["no-op-inflation-guard", ...strategy],
      changed: false,
    };
  }

  return {
    system: system.text,
    user: user.text,
    originalEstimatedTokens,
    optimizedEstimatedTokens,
    tokensSaved: originalEstimatedTokens - optimizedEstimatedTokens,
    compressionRatio: optimizedEstimatedTokens / originalEstimatedTokens,
    strategy,
    changed: true,
  };
}

import { createProductionContextEngineRegistry } from "./context-engine-stack";
import { InMemoryContextOptimizationLedger, type ContextOptimizationLedger } from "./context-optimization-ledger";
import type { ContextPayloadKind } from "./context-payload-classifier";

export interface OptimizeContextRequest {
  readonly requestId: string;
  readonly text: string;
  readonly kind: ContextPayloadKind;
  readonly provider?: string;
  readonly model?: string;
  readonly cache?: "hit" | "miss" | "not-used";
  readonly retrievedContextCount?: number;
}

export interface OptimizeContextResult {
  readonly text: string;
  readonly originalEstimatedTokens: number;
  readonly optimizedEstimatedTokens: number;
  readonly tokensSaved: number;
  readonly savingsRatio: number;
  readonly strategies: readonly string[];
  readonly fallback: boolean;
}

const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

export class ContextOptimizationService {
  constructor(
    private readonly ledger: ContextOptimizationLedger = new InMemoryContextOptimizationLedger(),
  ) {}

  optimize(request: OptimizeContextRequest): OptimizeContextResult {
    const started = Date.now();
    const originalEstimatedTokens = estimateTokens(request.text);
    const registry = createProductionContextEngineRegistry();
    const optimized = registry.optimize({ kind: request.kind, text: request.text });
    const optimizedEstimatedTokens = estimateTokens(optimized.text);
    const fallback = optimizedEstimatedTokens > originalEstimatedTokens;
    const output = fallback ? request.text : optimized.text;
    const finalTokens = estimateTokens(output);

    this.ledger.record({
      requestId: request.requestId,
      createdAt: new Date().toISOString(),
      originalEstimatedTokens,
      optimizedEstimatedTokens: finalTokens,
      tokensSaved: Math.max(0, originalEstimatedTokens - finalTokens),
      compressionRatio: originalEstimatedTokens === 0 ? 0 : Math.max(0, (originalEstimatedTokens - finalTokens) / originalEstimatedTokens),
      cache: request.cache ?? "not-used",
      retrievedContextCount: request.retrievedContextCount ?? 0,
      strategies: optimized.strategy,
      provider: request.provider,
      model: request.model,
      optimizationLatencyMs: Date.now() - started,
      fallbackReason: fallback ? "optimization-inflated-token-estimate" : undefined,
    });

    return {
      text: output,
      originalEstimatedTokens,
      optimizedEstimatedTokens: finalTokens,
      tokensSaved: Math.max(0, originalEstimatedTokens - finalTokens),
      savingsRatio: originalEstimatedTokens === 0 ? 0 : Math.max(0, (originalEstimatedTokens - finalTokens) / originalEstimatedTokens),
      strategies: optimized.strategy,
      fallback,
    };
  }

  getLedger(): ContextOptimizationLedger { return this.ledger; }
}

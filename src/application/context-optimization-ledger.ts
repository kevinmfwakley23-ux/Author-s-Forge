export interface ContextOptimizationLedgerEntry {
  readonly requestId: string;
  readonly createdAt: string;
  readonly originalEstimatedTokens: number;
  readonly optimizedEstimatedTokens: number;
  readonly tokensSaved: number;
  readonly compressionRatio: number;
  readonly cache: "hit" | "miss" | "not-used";
  readonly retrievedContextCount: number;
  readonly strategies: readonly string[];
  readonly provider?: string;
  readonly model?: string;
  readonly estimatedRequestCost?: number;
  readonly optimizationLatencyMs: number;
  readonly fallbackReason?: string;
}

export interface ContextOptimizationLedgerSummary {
  readonly requests: number;
  readonly originalEstimatedTokens: number;
  readonly optimizedEstimatedTokens: number;
  readonly tokensSaved: number;
  readonly compressionRatio: number;
  readonly cacheHits: number;
  readonly cacheMisses: number;
  readonly fallbacks: number;
  readonly estimatedRequestCost: number;
  readonly optimizationLatencyMs: number;
}

export interface ContextOptimizationLedger {
  record(entry: ContextOptimizationLedgerEntry): void;
  list(): readonly ContextOptimizationLedgerEntry[];
  get(requestId: string): ContextOptimizationLedgerEntry | undefined;
  summarize(): ContextOptimizationLedgerSummary;
}

export class InMemoryContextOptimizationLedger implements ContextOptimizationLedger {
  private readonly entries = new Map<string, ContextOptimizationLedgerEntry>();

  record(entry: ContextOptimizationLedgerEntry): void {
    if (!entry.requestId.trim()) throw new Error("Optimization ledger requestId is required.");
    if (entry.originalEstimatedTokens < 0 || entry.optimizedEstimatedTokens < 0) {
      throw new Error("Optimization ledger token counts cannot be negative.");
    }
    if (entry.optimizedEstimatedTokens > entry.originalEstimatedTokens) {
      throw new Error("Optimization ledger cannot report token inflation as savings.");
    }
    if (entry.compressionRatio < 0 || entry.compressionRatio > 1) {
      throw new Error("Optimization ledger compression ratio must be between 0 and 1.");
    }
    this.entries.set(entry.requestId, Object.freeze({ ...entry, strategies: [...entry.strategies] }));
  }

  list(): readonly ContextOptimizationLedgerEntry[] { return [...this.entries.values()]; }

  get(requestId: string): ContextOptimizationLedgerEntry | undefined { return this.entries.get(requestId); }

  summarize(): ContextOptimizationLedgerSummary {
    const entries = this.list();
    const originalEstimatedTokens = entries.reduce((sum, entry) => sum + entry.originalEstimatedTokens, 0);
    const optimizedEstimatedTokens = entries.reduce((sum, entry) => sum + entry.optimizedEstimatedTokens, 0);
    const tokensSaved = originalEstimatedTokens - optimizedEstimatedTokens;
    return {
      requests: entries.length,
      originalEstimatedTokens,
      optimizedEstimatedTokens,
      tokensSaved,
      compressionRatio: originalEstimatedTokens === 0 ? 0 : tokensSaved / originalEstimatedTokens,
      cacheHits: entries.filter((entry) => entry.cache === "hit").length,
      cacheMisses: entries.filter((entry) => entry.cache === "miss").length,
      fallbacks: entries.filter((entry) => Boolean(entry.fallbackReason)).length,
      estimatedRequestCost: entries.reduce((sum, entry) => sum + (entry.estimatedRequestCost ?? 0), 0),
      optimizationLatencyMs: entries.reduce((sum, entry) => sum + entry.optimizationLatencyMs, 0),
    };
  }
}

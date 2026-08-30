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

export interface ContextOptimizationLedger {
  record(entry: ContextOptimizationLedgerEntry): void;
  list(): readonly ContextOptimizationLedgerEntry[];
  get(requestId: string): ContextOptimizationLedgerEntry | undefined;
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
    this.entries.set(entry.requestId, Object.freeze({ ...entry }));
  }

  list(): readonly ContextOptimizationLedgerEntry[] {
    return [...this.entries.values()];
  }

  get(requestId: string): ContextOptimizationLedgerEntry | undefined {
    return this.entries.get(requestId);
  }
}

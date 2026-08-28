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

export function estimateTokens(text: string): number {
  const normalized = text.trim();
  if (!normalized) return 0;
  return Math.max(1, Math.ceil(normalized.length / TOKEN_CHARS));
}

function compactText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function compactDuplicateLines(text: string): string {
  const lines = text.split("\n");
  const seen = new Set<string>();
  const result: string[] = [];
  for (const line of lines) {
    const key = line.trim();
    if (!key) {
      result.push("");
      continue;
    }
    if (/^(system|user|assistant|instruction|context|canon|memory|research):?$/i.test(key)) {
      result.push(line);
      continue;
    }
    if (key.length >= 24 && seen.has(key)) continue;
    if (key.length >= 24) seen.add(key);
    result.push(line);
  }
  return result.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function optimizeContext(input: ContextOptimizationInput): ContextOptimizationResult {
  const originalSystemTokens = estimateTokens(input.system);
  const originalUserTokens = estimateTokens(input.user);
  const originalEstimatedTokens = originalSystemTokens + originalUserTokens;

  const compactedSystem = compactDuplicateLines(compactText(input.system));
  const compactedUser = compactDuplicateLines(compactText(input.user));
  const optimizedEstimatedTokens = estimateTokens(compactedSystem) + estimateTokens(compactedUser);

  const maxInputTokens = input.maxInputTokens;
  const overBudget = maxInputTokens !== undefined && optimizedEstimatedTokens > maxInputTokens;
  const strategy = ["newline-normalization", "whitespace-compaction", "duplicate-line-removal"];

  // Deterministic compaction must never be allowed to make the prompt larger.
  if (optimizedEstimatedTokens >= originalEstimatedTokens || overBudget && optimizedEstimatedTokens >= originalEstimatedTokens) {
    return {
      system: input.system,
      user: input.user,
      originalEstimatedTokens,
      optimizedEstimatedTokens: originalEstimatedTokens,
      tokensSaved: 0,
      compressionRatio: 1,
      strategy: ["no-op-inflation-guard"],
      changed: false,
    };
  }

  return {
    system: compactedSystem,
    user: compactedUser,
    originalEstimatedTokens,
    optimizedEstimatedTokens,
    tokensSaved: originalEstimatedTokens - optimizedEstimatedTokens,
    compressionRatio: optimizedEstimatedTokens / originalEstimatedTokens,
    strategy,
    changed: true,
  };
}

import { estimateTokens } from "./context-optimizer";

export type ContextTier = "essential" | "project" | "active" | "supporting" | "historical";

export interface ContextFragment {
  readonly id: string;
  readonly text: string;
  readonly tier: ContextTier;
  readonly priority: number;
  readonly canonical?: boolean;
}

export interface ContextBudgetPolicy {
  readonly maxInputTokens: number;
  readonly reservedSystemTokens: number;
  readonly minimumActiveTokens: number;
}

export interface SelectedContext {
  readonly fragments: readonly ContextFragment[];
  readonly text: string;
  readonly estimatedTokens: number;
  readonly omittedFragmentIds: readonly string[];
}

const TIER_WEIGHT: Record<ContextTier, number> = {
  essential: 1000,
  project: 800,
  active: 600,
  supporting: 400,
  historical: 200,
};

export function selectContextFragments(fragments: readonly ContextFragment[], policy: ContextBudgetPolicy): SelectedContext {
  if (policy.maxInputTokens < 1) throw new Error("Context budget must be positive.");
  if (policy.reservedSystemTokens < 0 || policy.reservedSystemTokens >= policy.maxInputTokens) throw new Error("Reserved system tokens must be non-negative and below the input budget.");
  const available = policy.maxInputTokens - policy.reservedSystemTokens;
  const ranked = [...fragments].sort((a, b) => (Number(Boolean(b.canonical)) - Number(Boolean(a.canonical))) || (TIER_WEIGHT[b.tier] - TIER_WEIGHT[a.tier]) || (b.priority - a.priority) || a.id.localeCompare(b.id));
  const selected: ContextFragment[] = [];
  let used = 0;
  for (const fragment of ranked) {
    const tokens = estimateTokens(fragment.text);
    if (used + tokens <= available) {
      selected.push(fragment);
      used += tokens;
    }
  }
  const selectedIds = new Set(selected.map((fragment) => fragment.id));
  return { fragments: selected, text: selected.map((fragment) => fragment.text).join("\n\n"), estimatedTokens: used, omittedFragmentIds: fragments.filter((fragment) => !selectedIds.has(fragment.id)).map((fragment) => fragment.id) };
}

export interface DeduplicatedContext {
  readonly fragments: readonly ContextFragment[];
  readonly duplicateFragmentIds: readonly string[];
}

export function deduplicateContextFragments(fragments: readonly ContextFragment[]): DeduplicatedContext {
  const seen = new Set<string>();
  const duplicateFragmentIds: string[] = [];
  const unique: ContextFragment[] = [];
  for (const fragment of fragments) {
    const key = fragment.text.trim().replace(/\s+/g, " ");
    if (seen.has(key)) { duplicateFragmentIds.push(fragment.id); continue; }
    seen.add(key);
    unique.push(fragment);
  }
  return { fragments: unique, duplicateFragmentIds };
}

export interface ContextOptimizationLedgerEntry {
  readonly requestId: string;
  readonly originalTokens: number;
  readonly optimizedTokens: number;
  readonly tokensSaved: number;
  readonly savingsRatio: number;
  readonly strategies: readonly string[];
  readonly timestamp: string;
}

export function createContextOptimizationLedgerEntry(input: Omit<ContextOptimizationLedgerEntry, "tokensSaved" | "savingsRatio">): ContextOptimizationLedgerEntry {
  const tokensSaved = Math.max(0, input.originalTokens - input.optimizedTokens);
  const savingsRatio = input.originalTokens === 0 ? 0 : tokensSaved / input.originalTokens;
  return Object.freeze({ ...input, tokensSaved, savingsRatio });
}

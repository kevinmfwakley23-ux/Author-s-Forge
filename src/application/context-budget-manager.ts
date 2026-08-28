import { estimateTokens } from "./context-optimizer";

export type ContextPriority = "critical" | "high" | "normal" | "optional";

export interface ContextSection {
  readonly id: string;
  readonly content: string;
  readonly priority: ContextPriority;
  readonly order?: number;
}

export interface ContextBudgetResult {
  readonly sections: readonly ContextSection[];
  readonly includedIds: readonly string[];
  readonly omittedIds: readonly string[];
  readonly originalEstimatedTokens: number;
  readonly selectedEstimatedTokens: number;
  readonly tokensSaved: number;
  readonly budget: number;
  readonly constrained: boolean;
}

const PRIORITY_WEIGHT: Record<ContextPriority, number> = {
  critical: 4,
  high: 3,
  normal: 2,
  optional: 1,
};

/**
 * Selects whole context sections without mutating their source content.
 * Critical sections are never silently dropped; if they exceed the budget,
 * the result remains over budget and the caller can decide how to recover.
 */
export function selectContextBudget(
  sections: readonly ContextSection[],
  budget: number | undefined,
): ContextBudgetResult {
  const normalizedBudget = Number.isFinite(budget) && (budget ?? 0) > 0 ? Math.floor(budget as number) : undefined;
  const originalEstimatedTokens = sections.reduce((sum, section) => sum + estimateTokens(section.content), 0);

  if (normalizedBudget === undefined || originalEstimatedTokens <= normalizedBudget) {
    return {
      sections,
      includedIds: sections.map((section) => section.id),
      omittedIds: [],
      originalEstimatedTokens,
      selectedEstimatedTokens: originalEstimatedTokens,
      tokensSaved: 0,
      budget: normalizedBudget ?? originalEstimatedTokens,
      constrained: false,
    };
  }

  const ranked = [...sections].sort((a, b) => {
    const priority = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
    if (priority !== 0) return priority;
    return (a.order ?? 0) - (b.order ?? 0);
  });

  const selected: ContextSection[] = [];
  let selectedEstimatedTokens = 0;
  for (const section of ranked) {
    const tokens = estimateTokens(section.content);
    if (section.priority === "critical") {
      selected.push(section);
      selectedEstimatedTokens += tokens;
      continue;
    }
    if (selectedEstimatedTokens + tokens <= normalizedBudget) {
      selected.push(section);
      selectedEstimatedTokens += tokens;
    }
  }

  const selectedIds = new Set(selected.map((section) => section.id));
  const orderedSelected = sections.filter((section) => selectedIds.has(section.id));
  const omittedIds = sections.filter((section) => !selectedIds.has(section.id)).map((section) => section.id);

  return {
    sections: orderedSelected,
    includedIds: orderedSelected.map((section) => section.id),
    omittedIds,
    originalEstimatedTokens,
    selectedEstimatedTokens,
    tokensSaved: Math.max(0, originalEstimatedTokens - selectedEstimatedTokens),
    budget: normalizedBudget,
    constrained: true,
  };
}

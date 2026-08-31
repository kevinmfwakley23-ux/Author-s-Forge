import type { AiModelResource, AiModelSelection, AiModelSelectionRequest } from './ai-model-broker';

export type AiCostRoutingMode = 'economy' | 'balanced' | 'quality';

export interface AiCostRoutingRequest extends AiModelSelectionRequest {
  readonly routingMode?: AiCostRoutingMode;
  readonly estimatedOutputTokens?: number;
}

export interface AiCostRoutingDecision {
  readonly selection: AiModelSelection;
  readonly routingMode: AiCostRoutingMode;
  readonly estimatedRequestCostUsd?: number;
  readonly reasons: readonly string[];
}

/**
 * Re-ranks already-eligible broker candidates without weakening capability,
 * health, quota, or hard price filters. Economy is the default because Forge
 * should spend the least amount necessary for a task that still satisfies the
 * author's requirements.
 */
export function rankCostConsciousCandidates(
  candidates: readonly AiModelSelection[],
  request: AiCostRoutingRequest,
): AiCostRoutingDecision[] {
  const routingMode = request.routingMode ?? 'economy';
  const inputTokens = Math.max(0, request.estimatedInputTokens ?? 0);
  const outputTokens = Math.max(0, request.estimatedOutputTokens ?? 0);

  const decisions = candidates.map((selection) => {
    const estimatedRequestCostUsd = estimateRequestCost(selection.resource, inputTokens, outputTokens);
    const costScore = costPreferenceScore(selection.resource, estimatedRequestCostUsd, routingMode);
    const qualityScore = qualityPreferenceScore(selection.resource, routingMode);
    const reasons = [
      ...selection.reasons,
      `${routingMode} routing mode`,
      ...(estimatedRequestCostUsd === undefined ? ['request cost unknown'] : [`estimated request cost $${estimatedRequestCostUsd.toFixed(6)}`]),
    ];
    return {
      selection: { ...selection, score: selection.score + costScore + qualityScore, reasons },
      routingMode,
      ...(estimatedRequestCostUsd === undefined ? {} : { estimatedRequestCostUsd }),
      reasons,
    };
  });

  return decisions.sort((a, b) => {
    const score = b.selection.score - a.selection.score;
    if (score !== 0) return score;
    if (routingMode === 'economy') {
      const aCost = a.estimatedRequestCostUsd ?? Number.POSITIVE_INFINITY;
      const bCost = b.estimatedRequestCostUsd ?? Number.POSITIVE_INFINITY;
      if (aCost !== bCost) return aCost - bCost;
    }
    return a.selection.resource.provider.localeCompare(b.selection.resource.provider)
      || a.selection.resource.model.localeCompare(b.selection.resource.model);
  });
}

export function estimateRequestCost(
  resource: AiModelResource,
  inputTokens: number,
  outputTokens: number,
): number | undefined {
  const inputRate = resource.estimatedInputCostPerMillion;
  const outputRate = resource.estimatedOutputCostPerMillion;
  if (inputRate === undefined && outputRate === undefined) return undefined;
  return (Math.max(0, inputTokens) / 1_000_000) * (inputRate ?? 0)
    + (Math.max(0, outputTokens) / 1_000_000) * (outputRate ?? 0);
}

function costPreferenceScore(resource: AiModelResource, estimatedCost: number | undefined, mode: AiCostRoutingMode): number {
  if (mode === 'quality') return 0;
  const inputRate = resource.estimatedInputCostPerMillion;
  const outputRate = resource.estimatedOutputCostPerMillion;
  if (estimatedCost === undefined && inputRate === undefined && outputRate === undefined) return mode === 'economy' ? -12 : -4;

  const blendedRate = (inputRate ?? 0) + (outputRate ?? 0);
  const factor = mode === 'economy' ? 7 : 2;
  const requestPenalty = estimatedCost === undefined ? 0 : Math.min(80, estimatedCost * (mode === 'economy' ? 160 : 60));
  return Math.max(-120, 36 - Math.min(100, blendedRate * factor) - requestPenalty);
}

function qualityPreferenceScore(resource: AiModelResource, mode: AiCostRoutingMode): number {
  if (mode !== 'quality') return 0;
  const capabilities = resource.capabilities;
  let score = 0;
  if (capabilities.reasoning) score += 12;
  if (capabilities.creativeWriting) score += 12;
  if (capabilities.instructionFollowing) score += 10;
  if (capabilities.longContext) score += 8;
  if (capabilities.contextWindow) score += Math.min(12, Math.floor(capabilities.contextWindow / 100_000));
  return score;
}

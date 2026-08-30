export type AiTaskKind =
  | "draft"
  | "rewrite"
  | "edit"
  | "research"
  | "vision"
  | "structured"
  | "tool";

export interface AiResourceCapabilities {
  readonly reasoning?: boolean;
  readonly vision?: boolean;
  readonly tools?: boolean;
  readonly streaming?: boolean;
  readonly structuredOutput?: boolean;
  readonly contextTokens?: number;
}

export interface AiResourceHealth {
  readonly status: "healthy" | "degraded" | "unknown" | "offline";
  readonly latencyMs?: number;
  readonly checkedAt?: string;
}

export interface AiResourceEconomics {
  readonly inputCostPerMillion?: number;
  readonly outputCostPerMillion?: number;
  readonly quotaRemaining?: number;
  readonly quotaUnit?: "tokens" | "requests" | "unknown";
}

export interface AiResource {
  readonly id: string;
  readonly provider: string;
  readonly model: string;
  readonly capabilities: AiResourceCapabilities;
  readonly health?: AiResourceHealth;
  readonly economics?: AiResourceEconomics;
  readonly priority?: number;
}

export interface AiTaskRequirements {
  readonly kind: AiTaskKind;
  readonly minimumContextTokens?: number;
  readonly reasoning?: boolean;
  readonly vision?: boolean;
  readonly tools?: boolean;
  readonly streaming?: boolean;
  readonly structuredOutput?: boolean;
  readonly preferredProviders?: readonly string[];
  readonly maximumInputCostPerMillion?: number;
  readonly maximumOutputCostPerMillion?: number;
}

export interface AiResourceDecision {
  readonly resource: AiResource;
  readonly score: number;
  readonly reasons: readonly string[];
}

/**
 * Deterministic, provider-neutral resource selection.
 *
 * This layer deliberately does not discover or claim availability. Callers must
 * supply resources from real provider/gateway discovery. Unknown health and
 * pricing are treated as unknown, never as free or healthy.
 */
export class AiResourceBroker {
  constructor(private readonly resources: readonly AiResource[]) {}

  listEligible(requirements: AiTaskRequirements): readonly AiResourceDecision[] {
    return this.resources
      .filter((resource) => isEligible(resource, requirements))
      .map((resource) => scoreResource(resource, requirements))
      .sort((a, b) => b.score - a.score || a.resource.id.localeCompare(b.resource.id));
  }

  select(requirements: AiTaskRequirements): AiResourceDecision {
    const [best] = this.listEligible(requirements);
    if (!best) {
      throw new Error(`No eligible AI resource satisfies task requirements: ${requirements.kind}.`);
    }
    return best;
  }
}

function isEligible(resource: AiResource, requirements: AiTaskRequirements): boolean {
  const c = resource.capabilities;
  if (requirements.minimumContextTokens !== undefined && (c.contextTokens ?? 0) < requirements.minimumContextTokens) return false;
  if (requirements.reasoning && c.reasoning !== true) return false;
  if (requirements.vision && c.vision !== true) return false;
  if (requirements.tools && c.tools !== true) return false;
  if (requirements.streaming && c.streaming !== true) return false;
  if (requirements.structuredOutput && c.structuredOutput !== true) return false;
  if (requirements.maximumInputCostPerMillion !== undefined && (resource.economics?.inputCostPerMillion === undefined || resource.economics.inputCostPerMillion > requirements.maximumInputCostPerMillion)) return false;
  if (requirements.maximumOutputCostPerMillion !== undefined && (resource.economics?.outputCostPerMillion === undefined || resource.economics.outputCostPerMillion > requirements.maximumOutputCostPerMillion)) return false;
  if (resource.health?.status === "offline") return false;
  if (requirements.preferredProviders?.length && !requirements.preferredProviders.includes(resource.provider)) return false;
  return true;
}

function scoreResource(resource: AiResource, requirements: AiTaskRequirements): AiResourceDecision {
  let score = resource.priority ?? 0;
  const reasons: string[] = [];
  const c = resource.capabilities;
  const health = resource.health?.status;

  if (health === "healthy") { score += 30; reasons.push("verified healthy"); }
  else if (health === "degraded") { score -= 15; reasons.push("provider reports degraded health"); }
  else { reasons.push("health is unverified"); }

  if (requirements.preferredProviders?.includes(resource.provider)) { score += 25; reasons.push("preferred provider"); }
  if (c.reasoning) score += 5;
  if (requirements.vision && c.vision) reasons.push("vision capability satisfied");
  if (requirements.tools && c.tools) reasons.push("tool capability satisfied");
  if (requirements.streaming && c.streaming) reasons.push("streaming capability satisfied");
  if (requirements.structuredOutput && c.structuredOutput) reasons.push("structured output capability satisfied");
  if (requirements.minimumContextTokens !== undefined) reasons.push(`context capacity ${c.contextTokens ?? 0} tokens`);

  const inputCost = resource.economics?.inputCostPerMillion;
  const outputCost = resource.economics?.outputCostPerMillion;
  if (inputCost !== undefined) score += Math.max(0, 12 - Math.min(12, inputCost));
  if (outputCost !== undefined) score += Math.max(0, 12 - Math.min(12, outputCost));
  if (resource.economics?.quotaRemaining !== undefined) {
    score += resource.economics.quotaRemaining > 0 ? 8 : -20;
    reasons.push(`reported quota ${resource.economics.quotaRemaining} ${resource.economics.quotaUnit ?? "unknown"}`);
  } else {
    reasons.push("quota is unverified");
  }
  if (resource.health?.latencyMs !== undefined) score += Math.max(0, 8 - Math.floor(resource.health.latencyMs / 250));

  if (requirements.kind === "vision" && c.vision) score += 10;
  if (requirements.kind === "tool" && c.tools) score += 10;
  if (requirements.kind === "structured" && c.structuredOutput) score += 10;

  return { resource, score, reasons };
}

export type AiTask =
  | "writing"
  | "editing"
  | "research"
  | "vision"
  | "cover"
  | "marketing"
  | "tool-use"
  | "voice-preservation"
  | "continuity";

export type AiBillingClass = "local" | "subscription" | "free" | "metered" | "gateway-managed" | "unknown";
export type AiSpendPolicy = "no-paid-tokens" | "budgeted" | "unrestricted";

export interface AiModelCapabilities {
  readonly contextWindow?: number;
  readonly maxOutputTokens?: number;
  readonly reasoning?: boolean;
  readonly vision?: boolean;
  readonly streaming?: boolean;
  readonly toolCalls?: boolean;
  readonly creativeWriting?: boolean;
  readonly instructionFollowing?: boolean;
  readonly longContext?: boolean;
}

/** Provider/account quota shared by every model in the same quota scope. */
export interface AiProviderQuota {
  readonly scope: string;
  readonly provider?: string;
  readonly quotaLimit?: number;
  readonly usedTokens?: number;
  readonly remainingQuota?: number;
  readonly quotaResetAt?: string;
}

export interface AiModelResource {
  readonly provider: string;
  readonly model: string;
  readonly capabilities: AiModelCapabilities;
  readonly configured: boolean;
  readonly healthy?: boolean;
  readonly billingClass?: AiBillingClass;
  readonly estimatedInputCostPerMillion?: number;
  readonly estimatedOutputCostPerMillion?: number;
  /** Optional model-specific quota. Provider-wide quotas belong in AiProviderQuota. */
  readonly remainingQuota?: number;
  readonly usedTokens?: number;
  readonly quotaLimit?: number;
  readonly quotaResetAt?: string;
  /** Links this model to one shared provider/account quota pool. */
  readonly quotaScope?: string;
  readonly cooldownUntil?: string;
  readonly consecutiveFailures?: number;
  readonly latencyMs?: number;
}

export interface AiModelSelectionRequest {
  readonly task: AiTask;
  readonly minimumContextWindow?: number;
  readonly minimumOutputTokens?: number;
  readonly requiresReasoning?: boolean;
  readonly requiresVision?: boolean;
  readonly requiresToolCalls?: boolean;
  readonly requiresStreaming?: boolean;
  readonly requiresCreativeWriting?: boolean;
  readonly requiresInstructionFollowing?: boolean;
  readonly preferProvider?: string;
  readonly preferModel?: string;
  readonly preferredProviders?: readonly string[];
  readonly maxInputCostPerMillion?: number;
  readonly maxOutputCostPerMillion?: number;
  readonly maxEstimatedRequestCostUsd?: number;
  readonly estimatedInputTokens?: number;
  readonly estimatedOutputTokens?: number;
  readonly quotaSafetyFraction?: number;
  readonly spendPolicy?: AiSpendPolicy;
  readonly trustedNoSpendModels?: readonly string[];
  readonly now?: string;
}

export interface AiModelSelection {
  readonly resource: AiModelResource;
  readonly score: number;
  readonly reasons: readonly string[];
}

export interface AiRoutingTelemetry {
  readonly provider: string;
  readonly model: string;
  readonly consecutiveFailures: number;
  readonly totalTokens: number;
  readonly lastLatencyMs?: number;
  readonly cooldownUntil?: string;
}

/**
 * Canonical provider/model selection authority for Author's Forge.
 *
 * Unknown model limits remain unknown. A configured provider is rejected for a
 * capacity requirement only when Forge has real metadata proving that the
 * resource is too small. Provider/account quotas are represented separately
 * from models so one shared allowance cannot be accidentally multiplied by the
 * number of configured models.
 */
export class AiModelBroker {
  private resources: AiModelResource[] = [];
  private readonly quotaPools = new Map<string, AiProviderQuota>();
  private readonly baselineUsedByResource = new Map<string, number>();
  private readonly telemetryTokensByResource = new Map<string, number>();

  setResources(resources: readonly AiModelResource[]): void {
    this.resources = resources.filter((resource) => resource.configured).map(cloneResource);
    this.baselineUsedByResource.clear();
    const liveKeys = new Set<string>();
    for (const resource of this.resources) {
      const key = resourceKey(resource.provider, resource.model);
      liveKeys.add(key);
      this.baselineUsedByResource.set(key, initialResourceUsedTokens(resource));
    }
    for (const key of [...this.telemetryTokensByResource.keys()]) {
      if (!liveKeys.has(key)) this.telemetryTokensByResource.delete(key);
    }
  }

  setProviderQuotas(quotas: readonly AiProviderQuota[]): void {
    this.quotaPools.clear();
    for (const quota of quotas) {
      const scope = quota.scope.trim();
      if (!scope) throw new Error("AI provider quota scope cannot be blank.");
      this.quotaPools.set(scope, cloneProviderQuota({ ...quota, scope }));
    }
  }

  listProviderQuotas(): AiProviderQuota[] {
    return [...this.quotaPools.values()].map((quota) => this.effectiveProviderQuota(quota)).map(cloneProviderQuota);
  }

  applyRoutingTelemetry(telemetry: readonly AiRoutingTelemetry[]): void {
    const byKey = new Map(telemetry.map((item) => [resourceKey(item.provider, item.model), item]));
    for (const [key, item] of byKey) this.telemetryTokensByResource.set(key, Math.max(0, item.totalTokens));
    this.resources = this.resources.map((resource) => {
      const current = byKey.get(resourceKey(resource.provider, resource.model));
      if (!current) return resource;
      return {
        ...resource,
        consecutiveFailures: current.consecutiveFailures,
        usedTokens: Math.max(initialResourceUsedTokens(resource), current.totalTokens),
        latencyMs: current.lastLatencyMs,
        cooldownUntil: current.cooldownUntil,
      };
    });
  }

  listResources(): AiModelResource[] {
    return this.resources.map(cloneResource);
  }

  select(request: AiModelSelectionRequest): AiModelSelection {
    const selected = this.rank(request)[0];
    if (!selected) throw new Error(`No healthy configured AI model satisfies the ${request.task} requirements and current spend policy.`);
    return selected;
  }

  rank(request: AiModelSelectionRequest): AiModelSelection[] {
    const safetyFraction = clampSafetyFraction(request.quotaSafetyFraction ?? 0.1);
    const estimatedInputTokens = Math.max(0, request.estimatedInputTokens ?? 0);
    const estimatedOutputTokens = Math.max(0, request.estimatedOutputTokens ?? 0);
    const estimatedRequestTokens = estimatedInputTokens + estimatedOutputTokens;
    const now = Date.parse(request.now ?? new Date().toISOString());
    const preferredOrder = unique(
      (request.preferredProviders ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean),
    );

    const candidates = this.resources
      .map((resource, registrationIndex) => ({ resource, registrationIndex }))
      .filter(({ resource }) => this.isEligible(resource, request, estimatedInputTokens, estimatedOutputTokens, estimatedRequestTokens, safetyFraction, now));

    const usedTokens = candidates.map(({ resource }) => Math.max(0, resource.usedTokens ?? 0));
    const minUsed = usedTokens.length ? Math.min(...usedTokens) : 0;
    const maxUsed = usedTokens.length ? Math.max(...usedTokens) : 0;

    return candidates
      .map(({ resource, registrationIndex }) => ({
        ...this.score(resource, request, preferredOrder, estimatedRequestTokens, minUsed, maxUsed),
        registrationIndex,
      }))
      .sort((a, b) => b.score - a.score || a.registrationIndex - b.registrationIndex)
      .map(({ registrationIndex: _registrationIndex, ...selection }) => selection);
  }

  private isEligible(
    resource: AiModelResource,
    request: AiModelSelectionRequest,
    estimatedInputTokens: number,
    estimatedOutputTokens: number,
    estimatedRequestTokens: number,
    safetyFraction: number,
    now: number,
  ): boolean {
    const capabilities = resource.capabilities;
    if (resource.healthy === false) return false;
    if (resource.cooldownUntil && Number.isFinite(now) && Date.parse(resource.cooldownUntil) > now) return false;
    if (!this.spendEligible(resource, request, estimatedInputTokens, estimatedOutputTokens)) return false;

    if (
      request.minimumContextWindow !== undefined &&
      capabilities.contextWindow !== undefined &&
      capabilities.contextWindow < request.minimumContextWindow
    ) return false;
    if (
      request.minimumOutputTokens !== undefined &&
      capabilities.maxOutputTokens !== undefined &&
      capabilities.maxOutputTokens < request.minimumOutputTokens
    ) return false;

    if (request.requiresReasoning && capabilities.reasoning !== true) return false;
    if (request.requiresVision && capabilities.vision !== true) return false;
    if (request.requiresToolCalls && capabilities.toolCalls !== true) return false;
    if (request.requiresStreaming && capabilities.streaming !== true) return false;
    if (request.requiresCreativeWriting && capabilities.creativeWriting !== true) return false;
    if (request.requiresInstructionFollowing && capabilities.instructionFollowing !== true) return false;

    if (
      request.maxInputCostPerMillion !== undefined &&
      resource.estimatedInputCostPerMillion !== undefined &&
      resource.estimatedInputCostPerMillion > request.maxInputCostPerMillion
    ) return false;
    if (
      request.maxOutputCostPerMillion !== undefined &&
      resource.estimatedOutputCostPerMillion !== undefined &&
      resource.estimatedOutputCostPerMillion > request.maxOutputCostPerMillion
    ) return false;

    const modelRemaining = modelRemainingQuota(resource);
    if (!quotaAllows(modelRemaining, resource.quotaLimit, estimatedRequestTokens, safetyFraction)) return false;

    const providerQuota = this.providerQuotaFor(resource);
    if (providerQuota && !quotaAllows(providerQuota.remainingQuota, providerQuota.quotaLimit, estimatedRequestTokens, safetyFraction)) return false;

    return true;
  }

  private spendEligible(resource: AiModelResource, request: AiModelSelectionRequest, inputTokens: number, outputTokens: number): boolean {
    const policy = request.spendPolicy;
    if (!policy) return true;

    const trusted = new Set((request.trustedNoSpendModels ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean));
    const key = `${resource.provider}/${resource.model}`.toLowerCase();
    const billing = resource.billingClass ?? "unknown";
    if (policy === "no-paid-tokens") {
      return billing === "local" || billing === "subscription" || billing === "free" || trusted.has(key);
    }
    if (policy === "budgeted") {
      if (billing === "local" || billing === "subscription" || billing === "free" || trusted.has(key)) return true;
      const estimated = estimateResourceRequestCost(resource, inputTokens, outputTokens);
      if (estimated === undefined) return false;
      return request.maxEstimatedRequestCostUsd !== undefined && estimated <= request.maxEstimatedRequestCostUsd;
    }
    return true;
  }

  private score(
    resource: AiModelResource,
    request: AiModelSelectionRequest,
    preferredOrder: readonly string[],
    estimatedRequestTokens: number,
    minUsed: number,
    maxUsed: number,
  ): AiModelSelection {
    let score = 0;
    const reasons: string[] = [];
    const capabilities = resource.capabilities;
    const modelRemaining = modelRemainingQuota(resource);
    const providerQuota = this.providerQuotaFor(resource);
    const remaining = minimumDefined(modelRemaining, providerQuota?.remainingQuota);

    if (resource.provider === request.preferProvider) {
      score += 100;
      reasons.push("preferred provider");
    }
    if (resource.model === request.preferModel) {
      score += 75;
      reasons.push("preferred model");
    }

    const billing = resource.billingClass ?? "unknown";
    if (billing === "local" || billing === "free") { score += 36; reasons.push(`${billing} inference`); }
    else if (billing === "subscription") { score += 30; reasons.push("subscription-covered inference"); }
    else if (billing === "metered") reasons.push("metered inference");
    else reasons.push(`${billing} billing`);

    const orderIndex = preferredOrder.indexOf(resource.provider.toLowerCase());
    if (orderIndex >= 0) {
      const bonus = Math.max(2, 24 - orderIndex * 4);
      score += bonus;
      reasons.push(`provider order ${orderIndex + 1}`);
    }

    if (resource.healthy === true) {
      score += 25;
      reasons.push("healthy");
    }
    if (resource.consecutiveFailures) {
      score -= Math.min(40, resource.consecutiveFailures * 10);
      reasons.push(`failure penalty (${resource.consecutiveFailures})`);
    }
    if (resource.latencyMs !== undefined) {
      score += Math.max(-15, 15 - Math.floor(resource.latencyMs / 500));
      reasons.push(`latency ${resource.latencyMs}ms`);
    }

    if (maxUsed > minUsed) {
      const tokenUse = Math.max(0, resource.usedTokens ?? 0);
      const balanceBonus = Math.round(((maxUsed - tokenUse) / (maxUsed - minUsed)) * 32);
      score += balanceBonus;
      reasons.push(`usage balance ${tokenUse.toLocaleString()} accounted tokens`);
    }

    if (remaining !== undefined) {
      score += 10;
      reasons.push(`quota available (${remaining.toLocaleString()} tokens)`);
      if (estimatedRequestTokens > 0) reasons.push("input + output quota reserve protected");
    }
    if (providerQuota?.remainingQuota !== undefined) reasons.push(`shared provider quota ${providerQuota.scope}`);

    const scoringLimit = minimumDefined(resource.quotaLimit, providerQuota?.quotaLimit);
    if (remaining !== undefined && scoringLimit !== undefined && scoringLimit > 0) {
      score += Math.min(30, Math.round((remaining / scoringLimit) * 30));
    }

    if (resource.estimatedInputCostPerMillion !== undefined) {
      score += Math.max(0, 20 - Math.min(20, resource.estimatedInputCostPerMillion));
    }
    if (request.task === "vision" && capabilities.vision) {
      score += 30;
      reasons.push("vision capable");
    }
    if ((request.task === "tool-use" || request.requiresToolCalls) && capabilities.toolCalls) {
      score += 30;
      reasons.push("tool-call capable");
    }
    if ((request.task === "writing" || request.task === "voice-preservation") && capabilities.creativeWriting) {
      score += 35;
      reasons.push("creative-writing capable");
    }
    if ((request.task === "voice-preservation" || request.requiresInstructionFollowing) && capabilities.instructionFollowing) {
      score += 25;
      reasons.push("instruction-following capable");
    }
    if (request.task === "continuity" && capabilities.longContext) {
      score += 35;
      reasons.push("long-context capable");
    }
    if (request.requiresReasoning && capabilities.reasoning) {
      score += 30;
      reasons.push("reasoning capable");
    }
    if (request.requiresStreaming && capabilities.streaming) {
      score += 15;
      reasons.push("streaming capable");
    }

    if (capabilities.contextWindow !== undefined) {
      score += Math.min(20, Math.floor(capabilities.contextWindow / 100000));
    } else if (request.minimumContextWindow !== undefined) {
      reasons.push("context limit unknown; provider validates");
    }
    if (capabilities.maxOutputTokens !== undefined) {
      score += Math.min(10, Math.floor(capabilities.maxOutputTokens / 10000));
    } else if (request.minimumOutputTokens !== undefined) {
      reasons.push("output limit unknown; provider validates");
    }

    return { resource: cloneResource(resource), score, reasons };
  }

  private providerQuotaFor(resource: AiModelResource): AiProviderQuota | undefined {
    if (!resource.quotaScope) return undefined;
    const quota = this.quotaPools.get(resource.quotaScope);
    return quota ? this.effectiveProviderQuota(quota) : undefined;
  }

  private effectiveProviderQuota(quota: AiProviderQuota): AiProviderQuota {
    const runtimeTokens = this.resources
      .filter((resource) => resource.quotaScope === quota.scope)
      .reduce((sum, resource) => {
        const key = resourceKey(resource.provider, resource.model);
        const total = this.telemetryTokensByResource.get(key) ?? this.baselineUsedByResource.get(key) ?? 0;
        const baseline = this.baselineUsedByResource.get(key) ?? 0;
        return sum + Math.max(0, total - baseline);
      }, 0);

    const baselineUsed = providerBaselineUsedTokens(quota);
    const effectiveUsed = baselineUsed + runtimeTokens;
    const fromLimit = quota.quotaLimit !== undefined ? Math.max(0, quota.quotaLimit - effectiveUsed) : undefined;
    const fromRemaining = quota.remainingQuota !== undefined ? Math.max(0, quota.remainingQuota - runtimeTokens) : undefined;
    const remainingQuota = minimumDefined(fromLimit, fromRemaining);

    return {
      ...quota,
      usedTokens: effectiveUsed,
      ...(remainingQuota !== undefined ? { remainingQuota } : {}),
    };
  }
}

export function estimateResourceRequestCost(resource: AiModelResource, inputTokens: number, outputTokens: number): number | undefined {
  const inputRate = resource.estimatedInputCostPerMillion;
  const outputRate = resource.estimatedOutputCostPerMillion;
  if (inputRate === undefined && outputRate === undefined) return undefined;
  return (Math.max(0, inputTokens) / 1_000_000) * (inputRate ?? 0) + (Math.max(0, outputTokens) / 1_000_000) * (outputRate ?? 0);
}

function modelRemainingQuota(resource: AiModelResource): number | undefined {
  const computed =
    resource.quotaLimit !== undefined && resource.usedTokens !== undefined
      ? Math.max(0, resource.quotaLimit - resource.usedTokens)
      : undefined;
  return minimumDefined(resource.remainingQuota !== undefined ? Math.max(0, resource.remainingQuota) : undefined, computed);
}

function quotaAllows(remaining: number | undefined, limit: number | undefined, requestTokens: number, safetyFraction: number): boolean {
  if (remaining === undefined) return true;
  if (remaining <= 0) return false;
  if (requestTokens <= 0) return true;
  const quotaBase = limit ?? remaining;
  const safetyReserve = Math.ceil(quotaBase * safetyFraction);
  return remaining - requestTokens >= safetyReserve;
}

function initialResourceUsedTokens(resource: AiModelResource): number {
  if (resource.usedTokens !== undefined) return Math.max(0, resource.usedTokens);
  if (resource.quotaLimit !== undefined && resource.remainingQuota !== undefined) {
    return Math.max(0, resource.quotaLimit - Math.min(resource.quotaLimit, resource.remainingQuota));
  }
  return 0;
}

function providerBaselineUsedTokens(quota: AiProviderQuota): number {
  if (quota.usedTokens !== undefined) return Math.max(0, quota.usedTokens);
  if (quota.quotaLimit !== undefined && quota.remainingQuota !== undefined) {
    return Math.max(0, quota.quotaLimit - Math.min(quota.quotaLimit, quota.remainingQuota));
  }
  return 0;
}

function cloneResource(resource: AiModelResource): AiModelResource {
  return { ...resource, capabilities: { ...resource.capabilities } };
}

function cloneProviderQuota(quota: AiProviderQuota): AiProviderQuota {
  return { ...quota };
}

function clampSafetyFraction(value: number): number {
  return Math.min(0.99, Math.max(0, Number.isFinite(value) ? value : 0.1));
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function minimumDefined(a: number | undefined, b: number | undefined): number | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return Math.min(a, b);
}

function resourceKey(provider: string, model: string): string {
  return `${provider}::${model}`;
}

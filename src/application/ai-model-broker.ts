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

export interface AiModelResource {
  readonly provider: string;
  readonly model: string;
  readonly capabilities: AiModelCapabilities;
  readonly configured: boolean;
  readonly healthy?: boolean;
  readonly estimatedInputCostPerMillion?: number;
  readonly estimatedOutputCostPerMillion?: number;
  readonly remainingQuota?: number;
  readonly usedTokens?: number;
  readonly quotaLimit?: number;
  readonly quotaResetAt?: string;
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
  readonly estimatedInputTokens?: number;
  readonly estimatedOutputTokens?: number;
  readonly quotaSafetyFraction?: number;
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
 * resource is too small. When a limit is unknown, the provider remains eligible
 * and the real provider adapter is allowed to accept/reject the request.
 */
export class AiModelBroker {
  private resources: AiModelResource[] = [];

  setResources(resources: readonly AiModelResource[]): void {
    this.resources = resources.filter((resource) => resource.configured).map(cloneResource);
  }

  applyRoutingTelemetry(telemetry: readonly AiRoutingTelemetry[]): void {
    const byKey = new Map(telemetry.map((item) => [`${item.provider}::${item.model}`, item]));
    this.resources = this.resources.map((resource) => {
      const current = byKey.get(`${resource.provider}::${resource.model}`);
      if (!current) return resource;
      return {
        ...resource,
        consecutiveFailures: current.consecutiveFailures,
        usedTokens: Math.max(resource.usedTokens ?? 0, current.totalTokens),
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
    if (!selected) throw new Error(`No healthy configured AI model satisfies the ${request.task} requirements.`);
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
      .filter(({ resource }) => this.isEligible(resource, request, estimatedRequestTokens, safetyFraction, now));

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
    estimatedRequestTokens: number,
    safetyFraction: number,
    now: number,
  ): boolean {
    const capabilities = resource.capabilities;
    if (resource.healthy === false) return false;
    if (resource.cooldownUntil && Number.isFinite(now) && Date.parse(resource.cooldownUntil) > now) return false;

    // Capacity metadata is optional. Unknown is not the same as insufficient.
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

    // Feature requirements are strict: advanced capability must be explicitly known true.
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

    const remaining = this.remainingQuota(resource);
    if (remaining !== undefined && remaining <= 0) return false;
    if (remaining !== undefined && estimatedRequestTokens > 0) {
      const quotaBase = resource.quotaLimit ?? remaining;
      const safetyReserve = Math.ceil(quotaBase * safetyFraction);
      if (remaining - estimatedRequestTokens < safetyReserve) return false;
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
    const remaining = this.remainingQuota(resource);

    if (resource.provider === request.preferProvider) {
      score += 100;
      reasons.push("preferred provider");
    }
    if (resource.model === request.preferModel) {
      score += 75;
      reasons.push("preferred model");
    }

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
      if (resource.quotaLimit && resource.quotaLimit > 0) {
        score += Math.min(30, Math.round((remaining / resource.quotaLimit) * 30));
      }
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

  private remainingQuota(resource: AiModelResource): number | undefined {
    const computed =
      resource.quotaLimit !== undefined && resource.usedTokens !== undefined
        ? Math.max(0, resource.quotaLimit - resource.usedTokens)
        : undefined;
    if (resource.remainingQuota !== undefined && computed !== undefined) {
      return Math.min(Math.max(0, resource.remainingQuota), computed);
    }
    if (computed !== undefined) return computed;
    if (resource.remainingQuota !== undefined) return Math.max(0, resource.remainingQuota);
    return undefined;
  }
}

function cloneResource(resource: AiModelResource): AiModelResource {
  return { ...resource, capabilities: { ...resource.capabilities } };
}

function clampSafetyFraction(value: number): number {
  return Math.min(0.99, Math.max(0, Number.isFinite(value) ? value : 0.1));
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

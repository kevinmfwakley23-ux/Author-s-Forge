import { AiModelResource } from './ai-model-broker';

export interface AiProviderRuntimeState {
  readonly provider: string;
  readonly model: string;
  readonly consecutiveFailures: number;
  readonly totalFailures: number;
  readonly totalSuccesses: number;
  readonly totalTokens: number;
  readonly lastLatencyMs?: number;
  readonly cooldownUntil?: string;
  readonly lastError?: string;
  readonly updatedAt: string;
}

export class AiRoutingState {
  private readonly states = new Map<string, AiProviderRuntimeState>();

  hydrate(resources: readonly AiModelResource[], now = new Date().toISOString()): void {
    for (const resource of resources) {
      const key = this.key(resource.provider, resource.model);
      const current = this.states.get(key);
      if (!current) this.states.set(key, { provider: resource.provider, model: resource.model, consecutiveFailures: resource.consecutiveFailures ?? 0, totalFailures: 0, totalSuccesses: 0, totalTokens: resource.usedTokens ?? 0, lastLatencyMs: resource.latencyMs, cooldownUntil: resource.cooldownUntil, updatedAt: now });
    }
  }

  recordSuccess(provider: string, model: string, latencyMs: number, tokens = 0, now = new Date().toISOString()): void {
    const current = this.get(provider, model, now);
    this.states.set(this.key(provider, model), { ...current, consecutiveFailures: 0, totalSuccesses: current.totalSuccesses + 1, totalTokens: current.totalTokens + Math.max(0, tokens), lastLatencyMs: Math.max(0, latencyMs), cooldownUntil: undefined, lastError: undefined, updatedAt: now });
  }

  recordFailure(provider: string, model: string, error: unknown, now = new Date().toISOString(), cooldownMs = 0): void {
    const current = this.get(provider, model, now);
    const failures = current.consecutiveFailures + 1;
    const cooldownUntil = cooldownMs > 0 ? new Date(Date.parse(now) + cooldownMs).toISOString() : current.cooldownUntil;
    this.states.set(this.key(provider, model), { ...current, consecutiveFailures: failures, totalFailures: current.totalFailures + 1, cooldownUntil, lastError: error instanceof Error ? error.message : String(error), updatedAt: now });
  }

  recordUsage(provider: string, model: string, tokens: number, now = new Date().toISOString()): void {
    const current = this.get(provider, model, now);
    this.states.set(this.key(provider, model), { ...current, totalTokens: current.totalTokens + Math.max(0, tokens), updatedAt: now });
  }

  get(provider: string, model: string, now = new Date().toISOString()): AiProviderRuntimeState {
    return this.states.get(this.key(provider, model)) ?? { provider, model, consecutiveFailures: 0, totalFailures: 0, totalSuccesses: 0, totalTokens: 0, updatedAt: now };
  }

  snapshot(): readonly AiProviderRuntimeState[] { return [...this.states.values()].map((state) => ({ ...state })); }
  private key(provider: string, model: string): string { return `${provider}::${model}`; }
}

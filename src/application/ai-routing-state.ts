import { AiModelResource } from './ai-model-broker';

export const AI_ROUTING_STATE_FORMAT_VERSION = 1 as const;

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

export interface AiRoutingStateSnapshot {
  readonly formatVersion: typeof AI_ROUTING_STATE_FORMAT_VERSION;
  readonly states: readonly AiProviderRuntimeState[];
}

export class AiRoutingState {
  private readonly states = new Map<string, AiProviderRuntimeState>();

  hydrate(resources: readonly AiModelResource[], now = new Date().toISOString()): void {
    for (const resource of resources) {
      const key = this.key(resource.provider, resource.model);
      const current = this.states.get(key);
      if (!current) this.states.set(key, {
        provider: resource.provider, model: resource.model,
        consecutiveFailures: Math.max(0, resource.consecutiveFailures ?? 0),
        totalFailures: 0, totalSuccesses: 0, totalTokens: Math.max(0, resource.usedTokens ?? 0),
        lastLatencyMs: resource.latencyMs, cooldownUntil: resource.cooldownUntil, updatedAt: now
      });
    }
  }

  recordSuccess(provider: string, model: string, latencyMs: number, tokens = 0, now = new Date().toISOString()): void {
    const current = this.get(provider, model, now);
    this.states.set(this.key(provider, model), {
      ...current, consecutiveFailures: 0, totalSuccesses: current.totalSuccesses + 1,
      totalTokens: current.totalTokens + Math.max(0, tokens), lastLatencyMs: Math.max(0, latencyMs),
      cooldownUntil: undefined, lastError: undefined, updatedAt: now
    });
  }

  recordFailure(provider: string, model: string, error: unknown, now = new Date().toISOString(), cooldownMs = 0): void {
    const current = this.get(provider, model, now);
    const failures = current.consecutiveFailures + 1;
    const cooldownUntil = cooldownMs > 0 ? new Date(Date.parse(now) + cooldownMs).toISOString() : current.cooldownUntil;
    this.states.set(this.key(provider, model), {
      ...current, consecutiveFailures: failures, totalFailures: current.totalFailures + 1,
      cooldownUntil, lastError: error instanceof Error ? error.message : String(error), updatedAt: now
    });
  }

  recordUsage(provider: string, model: string, tokens: number, now = new Date().toISOString()): void {
    const current = this.get(provider, model, now);
    this.states.set(this.key(provider, model), { ...current, totalTokens: current.totalTokens + Math.max(0, tokens), updatedAt: now });
  }

  get(provider: string, model: string, now = new Date().toISOString()): AiProviderRuntimeState {
    return this.states.get(this.key(provider, model)) ?? { provider, model, consecutiveFailures: 0, totalFailures: 0, totalSuccesses: 0, totalTokens: 0, updatedAt: now };
  }

  snapshot(): readonly AiProviderRuntimeState[] { return [...this.states.values()].sort(byProviderModel).map((state) => ({ ...state })); }

  createSnapshot(): AiRoutingStateSnapshot {
    return { formatVersion: AI_ROUTING_STATE_FORMAT_VERSION, states: this.snapshot() };
  }

  restore(snapshot: AiRoutingStateSnapshot): void {
    if (snapshot.formatVersion !== AI_ROUTING_STATE_FORMAT_VERSION) throw new Error('Unsupported AI routing state format.');
    this.states.clear();
    for (const state of snapshot.states) {
      validateState(state);
      this.states.set(this.key(state.provider, state.model), { ...state });
    }
  }

  clear(): void { this.states.clear(); }

  private key(provider: string, model: string): string { return `${provider}::${model}`; }
}

function byProviderModel(a: AiProviderRuntimeState, b: AiProviderRuntimeState): number {
  return `${a.provider}::${a.model}`.localeCompare(`${b.provider}::${b.model}`);
}

function validateState(state: AiProviderRuntimeState): void {
  if (!state.provider.trim() || !state.model.trim()) throw new Error('AI routing state requires provider and model.');
  if (![state.consecutiveFailures, state.totalFailures, state.totalSuccesses, state.totalTokens].every(Number.isFinite)) throw new Error('AI routing counters must be finite.');
  if (state.consecutiveFailures < 0 || state.totalFailures < 0 || state.totalSuccesses < 0 || state.totalTokens < 0) throw new Error('AI routing counters cannot be negative.');
  if (state.lastLatencyMs !== undefined && (!Number.isFinite(state.lastLatencyMs) || state.lastLatencyMs < 0)) throw new Error('AI routing latency cannot be negative.');
  if (Number.isNaN(Date.parse(state.updatedAt))) throw new Error('AI routing state updatedAt must be a valid timestamp.');
}

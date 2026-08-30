import { AiModelBroker, AiModelResource, AiModelSelection, AiModelSelectionRequest } from './ai-model-broker';

export interface AiFederationPlan { readonly candidates: readonly AiModelSelection[]; readonly generatedAt: string; readonly maxAttempts: number; readonly guarantee: 'available-candidate' | 'no-eligible-candidate'; }

/** Provider-neutral federation boundary. It plans failover without coupling the core to a vendor SDK. */
export class AiFederation {
  constructor(private readonly broker: AiModelBroker) {}
  plan(request: AiModelSelectionRequest, maxAttempts = 8): AiFederationPlan {
    const candidates = this.broker.rank(request);
    const bounded = Math.max(1, Math.min(maxAttempts, candidates.length || 1));
    return { candidates, generatedAt: new Date().toISOString(), maxAttempts: bounded, guarantee: candidates.length ? 'available-candidate' : 'no-eligible-candidate' };
  }
  resources(): readonly AiModelResource[] { return this.broker.listResources(); }
}

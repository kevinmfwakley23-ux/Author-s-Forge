import { AiModelBroker, type AiModelResource, type AiModelSelection, type AiModelSelectionRequest } from './ai-model-broker';

export interface AiFederationPlan {
  readonly candidates: readonly AiModelSelection[];
  readonly generatedAt: string;
  readonly maxAttempts: number;
  readonly guarantee: 'available-candidate' | 'no-eligible-candidate';
}

/** Vendor-neutral federation boundary shared by all Forge offices. */
export class AiFederation {
  constructor(private readonly broker: AiModelBroker) {}

  plan(request: AiModelSelectionRequest, maxAttempts = 8): AiFederationPlan {
    const candidates = this.broker.rank(request);
    return {
      candidates,
      generatedAt: new Date().toISOString(),
      maxAttempts: Math.max(1, Math.min(maxAttempts, candidates.length || 1)),
      guarantee: candidates.length > 0 ? 'available-candidate' : 'no-eligible-candidate'
    };
  }

  resources(): readonly AiModelResource[] { return this.broker.listResources(); }
}

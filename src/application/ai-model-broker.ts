export type AiTask = 'writing' | 'editing' | 'research' | 'vision' | 'cover' | 'marketing' | 'tool-use';

export interface AiModelCapabilities {
  readonly contextWindow?: number;
  readonly maxOutputTokens?: number;
  readonly reasoning?: boolean;
  readonly vision?: boolean;
  readonly streaming?: boolean;
  readonly toolCalls?: boolean;
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
}

export interface AiModelSelectionRequest {
  readonly task: AiTask;
  readonly minimumContextWindow?: number;
  readonly minimumOutputTokens?: number;
  readonly requiresReasoning?: boolean;
  readonly requiresVision?: boolean;
  readonly requiresToolCalls?: boolean;
  readonly requiresStreaming?: boolean;
  readonly preferProvider?: string;
  readonly preferModel?: string;
  readonly maxInputCostPerMillion?: number;
  readonly maxOutputCostPerMillion?: number;
}

export interface AiModelSelection {
  readonly resource: AiModelResource;
  readonly score: number;
  readonly reasons: readonly string[];
}

/** Provider-neutral selection over resources discovered from real health checks. */
export class AiModelBroker {
  private resources: AiModelResource[] = [];

  setResources(resources: readonly AiModelResource[]): void {
    this.resources = resources.filter((resource) => resource.configured);
  }

  listResources(): AiModelResource[] {
    return this.resources.map((resource) => ({ ...resource, capabilities: { ...resource.capabilities } }));
  }

  select(request: AiModelSelectionRequest): AiModelSelection {
    const candidates = this.resources.filter((resource) => {
      const c = resource.capabilities;
      if (resource.healthy === false) return false;
      if (request.minimumContextWindow !== undefined && (c.contextWindow ?? 0) < request.minimumContextWindow) return false;
      if (request.minimumOutputTokens !== undefined && (c.maxOutputTokens ?? 0) < request.minimumOutputTokens) return false;
      if (request.requiresReasoning && !c.reasoning) return false;
      if (request.requiresVision && !c.vision) return false;
      if (request.requiresToolCalls && !c.toolCalls) return false;
      if (request.requiresStreaming && !c.streaming) return false;
      if (request.maxInputCostPerMillion !== undefined && resource.estimatedInputCostPerMillion !== undefined && resource.estimatedInputCostPerMillion > request.maxInputCostPerMillion) return false;
      if (request.maxOutputCostPerMillion !== undefined && resource.estimatedOutputCostPerMillion !== undefined && resource.estimatedOutputCostPerMillion > request.maxOutputCostPerMillion) return false;
      return true;
    });

    if (candidates.length === 0) throw new Error(`No healthy configured AI model satisfies the ${request.task} requirements.`);

    return candidates.map((resource) => {
      let score = 0;
      const reasons: string[] = [];
      if (resource.provider === request.preferProvider) { score += 100; reasons.push('preferred provider'); }
      if (resource.model === request.preferModel) { score += 75; reasons.push('preferred model'); }
      if (resource.healthy === true) { score += 25; reasons.push('healthy'); }
      if (resource.remainingQuota !== undefined) {
        if (resource.remainingQuota > 0) { score += 10; reasons.push('reported quota available'); }
        else score -= 50;
      }
      if (resource.estimatedInputCostPerMillion !== undefined) { score += Math.max(0, 20 - Math.min(20, resource.estimatedInputCostPerMillion)); reasons.push('input cost metadata available'); }
      if (request.task === 'vision' && resource.capabilities.vision) { score += 30; reasons.push('vision capable'); }
      if ((request.task === 'tool-use' || request.requiresToolCalls) && resource.capabilities.toolCalls) { score += 30; reasons.push('tool-call capable'); }
      if (request.requiresReasoning && resource.capabilities.reasoning) { score += 30; reasons.push('reasoning capable'); }
      if (request.requiresStreaming && resource.capabilities.streaming) { score += 15; reasons.push('streaming capable'); }
      if (resource.capabilities.contextWindow) score += Math.min(20, Math.floor(resource.capabilities.contextWindow / 100000));
      if (resource.capabilities.maxOutputTokens) score += Math.min(10, Math.floor(resource.capabilities.maxOutputTokens / 10000));
      return { resource, score, reasons };
    }).sort((a, b) => b.score - a.score || a.resource.provider.localeCompare(b.resource.provider) || a.resource.model.localeCompare(b.resource.model))[0];
  }
}

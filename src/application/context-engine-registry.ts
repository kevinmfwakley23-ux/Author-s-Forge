import type { ContextPayloadKind } from "./context-payload-classifier";

export interface ContextEngineInput {
  readonly text: string;
  readonly kind: ContextPayloadKind;
  readonly sourceName?: string;
}

export interface ContextEngineResult {
  readonly text: string;
  readonly changed: boolean;
  readonly strategy: readonly string[];
}

export interface ContextCompressionEngine {
  readonly id: string;
  readonly priority: number;
  readonly enabled: boolean;
  readonly supportedKinds: readonly ContextPayloadKind[];
  supports(input: ContextEngineInput): boolean;
  apply(input: ContextEngineInput): ContextEngineResult;
}

export class ContextEngineRegistry {
  private readonly engines: ContextCompressionEngine[];

  constructor(engines: readonly ContextCompressionEngine[] = []) {
    this.engines = [...engines].sort((a, b) => b.priority - a.priority);
  }

  register(engine: ContextCompressionEngine): void {
    if (this.engines.some((candidate) => candidate.id === engine.id)) {
      throw new Error(`Context engine already registered: ${engine.id}`);
    }
    this.engines.push(engine);
    this.engines.sort((a, b) => b.priority - a.priority);
  }

  list(): readonly ContextCompressionEngine[] {
    return [...this.engines];
  }

  optimize(input: ContextEngineInput): ContextEngineResult {
    let current = input.text;
    const strategy: string[] = [];
    let changed = false;

    for (const engine of this.engines) {
      if (!engine.enabled || !engine.supports({ ...input, text: current })) continue;
      const result = engine.apply({ ...input, text: current });
      if (!result.changed) continue;
      current = result.text;
      changed = true;
      strategy.push(engine.id, ...result.strategy);
    }

    return { text: current, changed, strategy };
  }
}

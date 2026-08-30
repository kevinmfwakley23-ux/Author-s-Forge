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
  readonly originalLength: number;
  readonly optimizedLength: number;
  readonly savingsRatio: number;
}

export interface ContextEngineResultDraft {
  readonly text: string;
  readonly changed: boolean;
  readonly strategy: readonly string[];
}

export function finalizeContextEngineResult(originalText: string, result: ContextEngineResultDraft): ContextEngineResult {
  const originalLength = originalText.length;
  const optimizedLength = result.text.length;
  const changed = result.text !== originalText;
  const savingsRatio = originalLength === 0 ? 0 : (originalLength - optimizedLength) / originalLength;
  return { ...result, changed, originalLength, optimizedLength, savingsRatio };
}

export interface ContextCompressionEngine {
  readonly id: string;
  readonly priority: number;
  readonly enabled: boolean;
  readonly supportedKinds: readonly ContextPayloadKind[];
  supports(input: ContextEngineInput): boolean;
  apply(input: ContextEngineInput): ContextEngineResultDraft;
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

    for (const engine of this.engines) {
      if (!engine.enabled || !engine.supports({ ...input, text: current })) continue;
      const result = engine.apply({ ...input, text: current });
      if (!result.changed || result.text.length >= current.length) continue;
      current = result.text;
      strategy.push(engine.id, ...result.strategy);
    }

    return finalizeContextEngineResult(input.text, {
      text: current,
      changed: current !== input.text,
      strategy,
    });
  }
}

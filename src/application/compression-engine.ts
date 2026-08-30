export type CompressionTarget = 'messages' | 'tool_results' | 'structured_data';

export interface CompressionInput {
  target: CompressionTarget;
  content: string;
  metadata?: Readonly<Record<string, string>>;
}

export interface CompressionResult {
  content: string;
  changed: boolean;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  engineId: string;
  reason?: string;
}

export interface CompressionEngine {
  readonly id: string;
  readonly priority: number;
  readonly targets: readonly CompressionTarget[];
  compress(input: CompressionInput): CompressionResult;
}

/** Provider-neutral, fail-open registry for independently testable context optimizers. */
export class CompressionEngineRegistry {
  private readonly engines = new Map<string, CompressionEngine>();

  constructor(engines: readonly CompressionEngine[] = []) {
    for (const engine of engines) this.register(engine);
  }

  register(engine: CompressionEngine): void {
    if (!engine.id.trim()) throw new Error('Compression engine id is required');
    if (!Number.isFinite(engine.priority)) throw new Error(`Invalid priority for ${engine.id}`);
    this.engines.set(engine.id, engine);
  }

  remove(id: string): boolean { return this.engines.delete(id); }
  get(id: string): CompressionEngine | undefined { return this.engines.get(id); }

  list(target?: CompressionTarget): CompressionEngine[] {
    return [...this.engines.values()]
      .filter((engine) => !target || engine.targets.includes(target))
      .sort((a, b) => a.priority - b.priority);
  }

  compress(input: CompressionInput): CompressionResult {
    const originalTokens = estimateTokens(input.content);
    let current = input.content;
    let last: CompressionResult | undefined;

    for (const engine of this.list(input.target)) {
      let result: CompressionResult;
      try {
        result = engine.compress({ ...input, content: current });
      } catch {
        continue;
      }
      if (result.changed && result.content.length < current.length) {
        current = result.content;
        last = result;
      }
    }

    if (!last) {
      return {
        content: input.content,
        changed: false,
        estimatedInputTokens: originalTokens,
        estimatedOutputTokens: originalTokens,
        engineId: 'none',
        reason: 'No safe engine produced measurable savings',
      };
    }

    return {
      ...last,
      content: current,
      changed: true,
      estimatedInputTokens: originalTokens,
      estimatedOutputTokens: estimateTokens(current),
    };
  }
}

export function estimateTokens(value: string): number {
  return value ? Math.ceil(value.length / 4) : 0;
}

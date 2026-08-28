export type CompressionTarget = 'context' | 'tool_results' | 'structured_data';

export interface CompressionInput {
  readonly text: string;
  readonly target: CompressionTarget;
}

export interface CompressionResult {
  readonly text: string;
  readonly changed: boolean;
  readonly estimatedInputTokens: number;
  readonly estimatedOutputTokens: number;
  readonly reason?: string;
}

export interface CompressionEngine {
  readonly id: string;
  readonly priority: number;
  readonly targets: readonly CompressionTarget[];
  readonly lossless: boolean;
  compress(input: CompressionInput): CompressionResult;
}

export interface CompressionEngineRegistryOptions {
  readonly engines?: readonly CompressionEngine[];
}

export class CompressionEngineRegistry {
  private readonly engines = new Map<string, CompressionEngine>();

  constructor(options: CompressionEngineRegistryOptions = {}) {
    for (const engine of options.engines ?? []) this.register(engine);
  }

  register(engine: CompressionEngine): void {
    if (this.engines.has(engine.id)) {
      throw new Error(`Compression engine already registered: ${engine.id}`);
    }
    if (!Number.isFinite(engine.priority)) {
      throw new Error(`Compression engine priority must be finite: ${engine.id}`);
    }
    this.engines.set(engine.id, engine);
  }

  unregister(id: string): boolean {
    return this.engines.delete(id);
  }

  get(id: string): CompressionEngine | undefined {
    return this.engines.get(id);
  }

  list(target?: CompressionTarget): CompressionEngine[] {
    return [...this.engines.values()]
      .filter((engine) => !target || engine.targets.includes(target))
      .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  }
}

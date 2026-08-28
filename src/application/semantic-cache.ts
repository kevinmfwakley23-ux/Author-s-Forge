export interface SemanticCacheEntry<T> {
  readonly key: string;
  readonly value: T;
  readonly createdAt: number;
  readonly expiresAt?: number;
}

export interface SemanticCacheOptions {
  readonly maxEntries?: number;
  readonly ttlMs?: number;
}

/**
 * Small provider-neutral cache boundary for deterministic reuse of equivalent
 * AI context/request payloads. The cache never mutates project state and is
 * intentionally in-memory; durable caching can be introduced behind the same
 * contract later.
 */
export class SemanticCache<T> {
  private readonly entries = new Map<string, SemanticCacheEntry<T>>();
  private readonly maxEntries: number;
  private readonly ttlMs?: number;

  public constructor(options: SemanticCacheOptions = {}) {
    this.maxEntries = Math.max(1, Math.floor(options.maxEntries ?? 128));
    this.ttlMs = options.ttlMs === undefined ? undefined : Math.max(1, Math.floor(options.ttlMs));
  }

  public get(key: string, now = Date.now()): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== undefined && entry.expiresAt <= now) {
      this.entries.delete(key);
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  public set(key: string, value: T, now = Date.now()): void {
    const entry: SemanticCacheEntry<T> = {
      key,
      value,
      createdAt: now,
      ...(this.ttlMs === undefined ? {} : { expiresAt: now + this.ttlMs }),
    };
    this.entries.delete(key);
    this.entries.set(key, entry);
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  public delete(key: string): boolean {
    return this.entries.delete(key);
  }

  public clear(): void {
    this.entries.clear();
  }

  public get size(): number {
    return this.entries.size;
  }
}

export function stableCacheKey(parts: readonly unknown[]): string {
  return parts.map((part) => {
    if (typeof part === "string") return part;
    return JSON.stringify(part, Object.keys(part as object).sort());
  }).join("\n---\n");
}

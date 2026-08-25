import type { MemoryAuthority, MemoryQuery, MemoryRecord } from "../domain/memory";

export interface PromotionDecision {
  readonly memoryId: string;
  readonly from: MemoryAuthority;
  readonly to: MemoryAuthority;
  readonly actor: "author" | "system";
  readonly reason: string;
}

export class ProjectMemoryStore {
  private readonly records = new Map<string, MemoryRecord>();

  register(memory: MemoryRecord): void {
    if (this.records.has(memory.id)) {
      throw new Error(`Duplicate memory id "${memory.id}".`);
    }
    this.records.set(memory.id, cloneMemory(memory));
  }

  get(memoryId: string): MemoryRecord | undefined {
    const memory = this.records.get(memoryId);
    return memory ? cloneMemory(memory) : undefined;
  }

  list(): MemoryRecord[] {
    return [...this.records.values()]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(cloneMemory);
  }

  query(query: MemoryQuery = {}): MemoryRecord[] {
    if (query.limit !== undefined && (!Number.isInteger(query.limit) || query.limit < 0)) {
      throw new Error("Memory query limit must be a non-negative integer.");
    }

    const results = this.list().filter((memory) => {
      if (query.projectId && memory.projectId !== query.projectId) return false;
      if (query.class && memory.class !== query.class) return false;
      if (query.authority && memory.authority !== query.authority) return false;
      if (query.authoritativeOnly && memory.authority !== "authoritative") return false;
      if (query.relatedMemoryId && !memory.relatedMemoryIds.includes(query.relatedMemoryId)) return false;
      return true;
    });

    return results.slice(0, query.limit ?? Number.MAX_SAFE_INTEGER);
  }

  promote(memoryId: string, actor: PromotionDecision["actor"], reason: string): PromotionDecision {
    const existing = this.records.get(memoryId);
    if (!existing) throw new Error(`Memory "${memoryId}" not found.`);
    if (existing.authority === "authoritative") {
      return { memoryId, from: existing.authority, to: existing.authority, actor, reason };
    }
    if (existing.provenance.length === 0) {
      throw new Error(`Memory "${memoryId}" cannot be promoted without provenance.`);
    }
    if (actor !== "author") {
      throw new Error(`Memory "${memoryId}" requires author authority for promotion.`);
    }

    const promoted: MemoryRecord = {
      ...existing,
      authority: "authoritative",
      updatedAt: new Date().toISOString()
    };
    this.records.set(memoryId, cloneMemory(promoted));
    return { memoryId, from: existing.authority, to: promoted.authority, actor, reason };
  }

  supersede(memoryId: string, replacementId: string, now = new Date().toISOString()): MemoryRecord {
    const existing = this.records.get(memoryId);
    if (!existing) throw new Error(`Memory "${memoryId}" not found.`);
    if (!this.records.has(replacementId)) throw new Error(`Replacement memory "${replacementId}" not found.`);
    const superseded: MemoryRecord = {
      ...existing,
      authority: "superseded",
      updatedAt: now
    };
    this.records.set(memoryId, cloneMemory(superseded));
    return cloneMemory(superseded);
  }

  toPortableState(): readonly MemoryRecord[] {
    return this.list();
  }

  restore(records: readonly MemoryRecord[]): void {
    this.records.clear();
    for (const record of records) this.register(record);
  }
}

function cloneMemory(memory: MemoryRecord): MemoryRecord {
  return {
    ...memory,
    provenance: memory.provenance.map((item) => ({ ...item })),
    relatedMemoryIds: [...memory.relatedMemoryIds]
  };
}

import type { MemoryAuthority, MemoryQuery, MemoryRecord } from "../domain/memory";
import { MEMORY_FORMAT_VERSION, validateMemoryRecord } from "../domain/memory";

export interface MemoryPromotionDecision {
  readonly memoryId: string;
  readonly from: MemoryAuthority;
  readonly to: MemoryAuthority;
  readonly actor: "author" | "system";
  readonly reason: string;
}

export interface ProjectMemorySnapshot {
  readonly formatVersion: typeof MEMORY_FORMAT_VERSION;
  readonly projectId: string;
  readonly memories: readonly MemoryRecord[];
}

export class ProjectMemoryStore {
  private readonly records = new Map<string, MemoryRecord>();

  register(memory: MemoryRecord): void {
    validateMemoryRecord(memory);
    if (this.records.has(memory.id)) throw new Error(`Duplicate memory id "${memory.id}".`);
    this.records.set(memory.id, cloneMemory(memory));
  }

  get(memoryId: string): MemoryRecord | undefined {
    const memory = this.records.get(memoryId);
    return memory ? cloneMemory(memory) : undefined;
  }

  list(): MemoryRecord[] {
    return [...this.records.values()].sort((a, b) => a.id.localeCompare(b.id)).map(cloneMemory);
  }

  query(query: MemoryQuery = {}): MemoryRecord[] {
    if (query.limit !== undefined && (!Number.isInteger(query.limit) || query.limit < 0)) throw new Error("Memory query limit must be a non-negative integer.");
    const changedSinceInstant = query.changedSince === undefined ? undefined : parseTimestamp(query.changedSince, "Memory changedSince must be a valid timestamp.");

    return this.list().filter((memory) => {
      if (query.projectId && memory.projectId !== query.projectId) return false;
      if (query.class && memory.class !== query.class) return false;
      if (query.authority && memory.authority !== query.authority) return false;
      if (query.authoritativeOnly && memory.authority !== "authoritative") return false;
      if (query.relatedMemoryId && !memory.relatedMemoryIds.includes(query.relatedMemoryId)) return false;
      if (query.relevanceTags && !query.relevanceTags.every((tag) => memory.relevanceTags.includes(tag))) return false;
      if (changedSinceInstant !== undefined && parseTimestamp(memory.updatedAt, `Memory "${memory.id}" has an invalid updatedAt timestamp.`) <= changedSinceInstant) return false;
      return true;
    }).slice(0, query.limit ?? Number.MAX_SAFE_INTEGER);
  }

  promote(memoryId: string, actor: MemoryPromotionDecision["actor"], reason: string): MemoryPromotionDecision {
    if (!reason.trim()) throw new Error("Promotion reason is required.");
    const existing = this.records.get(memoryId);
    if (!existing) throw new Error(`Memory "${memoryId}" not found.`);
    if (existing.authority === "authoritative") return { memoryId, from: existing.authority, to: existing.authority, actor, reason: reason.trim() };
    if (existing.provenance.length === 0) throw new Error(`Memory "${memoryId}" cannot be promoted without provenance.`);
    if (actor !== "author") throw new Error(`Memory "${memoryId}" requires author authority for promotion.`);
    if (!isPromotableAuthority(existing.authority)) throw new Error(`Memory "${memoryId}" cannot be promoted from ${existing.authority}.`);

    const promoted: MemoryRecord = { ...existing, authority: "authoritative", updatedAt: new Date().toISOString() };
    validateMemoryRecord(promoted);
    this.records.set(memoryId, cloneMemory(promoted));
    return { memoryId, from: existing.authority, to: promoted.authority, actor, reason: reason.trim() };
  }

  supersede(memoryId: string, replacementId: string, now = new Date().toISOString()): MemoryRecord {
    const existing = this.records.get(memoryId);
    if (!existing) throw new Error(`Memory "${memoryId}" not found.`);
    const replacement = this.records.get(replacementId);
    if (!replacement) throw new Error(`Replacement memory "${replacementId}" not found.`);
    if (existing.projectId !== replacement.projectId) throw new Error("Superseding memory must belong to the same project.");
    if (memoryId === replacementId) throw new Error("Memory cannot supersede itself.");
    if (existing.class !== replacement.class) throw new Error("Superseding memory must use the same memory class.");
    if (existing.authority === "superseded" || existing.authority === "archived" || existing.supersededBy) {
      throw new Error(`Memory "${memoryId}" is not active and cannot be superseded again.`);
    }
    if (replacement.authority === "superseded" || replacement.authority === "archived" || replacement.supersededBy) {
      throw new Error(`Replacement memory "${replacementId}" must be active.`);
    }
    if (replacement.supersedes && replacement.supersedes !== memoryId) {
      throw new Error(`Replacement memory "${replacementId}" already supersedes "${replacement.supersedes}".`);
    }
    if (Number.isNaN(Date.parse(now))) throw new Error("Memory supersession timestamp must be valid.");
    if (Date.parse(now) < Date.parse(existing.createdAt) || Date.parse(now) < Date.parse(replacement.createdAt)) {
      throw new Error("Memory supersession cannot precede either record's creation.");
    }

    const superseded: MemoryRecord = { ...existing, authority: "superseded", supersededBy: replacementId, updatedAt: now };
    const linkedReplacement: MemoryRecord = { ...replacement, supersedes: memoryId };
    validateMemoryRecord(superseded);
    validateMemoryRecord(linkedReplacement);
    this.records.set(memoryId, cloneMemory(superseded));
    this.records.set(replacementId, cloneMemory(linkedReplacement));
    return cloneMemory(superseded);
  }

  toPortableState(): readonly MemoryRecord[] { return this.list(); }

  createSnapshot(projectId: string): ProjectMemorySnapshot {
    if (!projectId.trim()) throw new Error("Project id is required for memory snapshot.");
    return { formatVersion: MEMORY_FORMAT_VERSION, projectId, memories: this.query({ projectId }) };
  }

  restore(records: readonly MemoryRecord[]): void {
    const staged = new Map<string, MemoryRecord>();
    for (const record of records) {
      validateMemoryRecord(record);
      if (staged.has(record.id)) throw new Error(`Duplicate memory id "${record.id}" in restore payload.`);
      staged.set(record.id, cloneMemory(record));
    }
    this.records.clear();
    for (const [id, record] of staged) this.records.set(id, record);
  }

  restoreSnapshot(snapshot: ProjectMemorySnapshot): void {
    if (snapshot.formatVersion !== MEMORY_FORMAT_VERSION) throw new Error("Unsupported memory snapshot format.");
    if (!snapshot.projectId.trim()) throw new Error("Memory snapshot project id is required.");
    if (snapshot.memories.some((memory) => memory.projectId !== snapshot.projectId)) throw new Error("Memory snapshot contains records from another project.");
    this.restore(snapshot.memories);
  }
}

function parseTimestamp(value: string, errorMessage: string): number {
  const instant = Date.parse(value);
  if (Number.isNaN(instant)) throw new Error(errorMessage);
  return instant;
}

function cloneMemory(memory: MemoryRecord): MemoryRecord {
  return { ...memory, provenance: memory.provenance.map((item) => ({ ...item })), relatedMemoryIds: [...memory.relatedMemoryIds], relevanceTags: [...memory.relevanceTags] };
}

function isPromotableAuthority(authority: MemoryAuthority): boolean {
  return authority === "proposed" || authority === "working" || authority === "verified";
}
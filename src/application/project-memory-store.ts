import { randomUUID } from "node:crypto";
import type { MemoryAuthority, MemoryQuery, MemoryRecord } from "../domain/memory";
import { MEMORY_FORMAT_VERSION, validateMemoryRecord } from "../domain/memory";

export interface MemoryPromotionDecision {
  readonly memoryId: string;
  readonly from: MemoryAuthority;
  readonly to: MemoryAuthority;
  readonly actor: "author" | "system";
  readonly reason: string;
}

export interface MemoryLifecycleEvent {
  readonly id: string;
  readonly projectId: string;
  readonly type: "promotion" | "supersession";
  readonly memoryId: string;
  readonly replacementId?: string;
  readonly from: MemoryAuthority;
  readonly to: MemoryAuthority;
  readonly actor: "author" | "system";
  readonly reason: string;
  readonly occurredAt: string;
}

export interface MemorySupersessionDecision {
  readonly actor: "author" | "system";
  readonly reason: string;
  readonly now?: string;
}

export interface ProjectMemorySnapshot {
  readonly formatVersion: typeof MEMORY_FORMAT_VERSION;
  readonly projectId: string;
  readonly memories: readonly MemoryRecord[];
  readonly lifecycleEvents?: readonly MemoryLifecycleEvent[];
}

export class ProjectMemoryStore {
  private readonly records = new Map<string, MemoryRecord>();
  private readonly lifecycleEvents: MemoryLifecycleEvent[] = [];

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

  listLifecycleEvents(projectId?: string): MemoryLifecycleEvent[] {
    return this.lifecycleEvents
      .filter((event) => projectId === undefined || event.projectId === projectId)
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id))
      .map(cloneLifecycleEvent);
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

  promote(memoryId: string, actor: MemoryPromotionDecision["actor"], reason: string, now = new Date().toISOString()): MemoryPromotionDecision {
    if (!reason.trim()) throw new Error("Promotion reason is required.");
    const existing = this.records.get(memoryId);
    if (!existing) throw new Error(`Memory "${memoryId}" not found.`);
    if (existing.authority === "authoritative") return { memoryId, from: existing.authority, to: existing.authority, actor, reason: reason.trim() };
    if (existing.provenance.length === 0) throw new Error(`Memory "${memoryId}" cannot be promoted without provenance.`);
    if (actor !== "author") throw new Error(`Memory "${memoryId}" requires author authority for promotion.`);
    if (!isPromotableAuthority(existing.authority)) throw new Error(`Memory "${memoryId}" cannot be promoted from ${existing.authority}.`);

    const promoted: MemoryRecord = { ...existing, authority: "authoritative", updatedAt: now };
    validateMemoryRecord(promoted);
    const decision = { memoryId, from: existing.authority, to: promoted.authority, actor, reason: reason.trim() } as const;
    const event: MemoryLifecycleEvent = {
      id: `memory-event-${randomUUID()}`, projectId: existing.projectId, type: "promotion", memoryId,
      from: existing.authority, to: promoted.authority, actor, reason: decision.reason, occurredAt: now,
    };
    validateLifecycleEvent(event, this.records);
    this.records.set(memoryId, cloneMemory(promoted));
    this.lifecycleEvents.push(cloneLifecycleEvent(event));
    return decision;
  }

  supersede(memoryId: string, replacementId: string, decision: MemorySupersessionDecision): MemoryRecord {
    if (!decision || !decision.reason?.trim()) throw new Error("Memory supersession reason is required.");
    const now = decision.now ?? new Date().toISOString();
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
    const event: MemoryLifecycleEvent = {
      id: `memory-event-${randomUUID()}`, projectId: existing.projectId, type: "supersession", memoryId,
      replacementId, from: existing.authority, to: "superseded", actor: decision.actor,
      reason: decision.reason.trim(), occurredAt: now,
    };
    validateLifecycleEvent(event, this.records);
    this.records.set(memoryId, cloneMemory(superseded));
    this.records.set(replacementId, cloneMemory(linkedReplacement));
    this.lifecycleEvents.push(cloneLifecycleEvent(event));
    return cloneMemory(superseded);
  }

  toPortableState(): readonly MemoryRecord[] { return this.list(); }

  createSnapshot(projectId: string): ProjectMemorySnapshot {
    if (!projectId.trim()) throw new Error("Project id is required for memory snapshot.");
    return {
      formatVersion: MEMORY_FORMAT_VERSION,
      projectId,
      memories: this.query({ projectId }),
      lifecycleEvents: this.listLifecycleEvents(projectId),
    };
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
    this.lifecycleEvents.length = 0;
  }

  restoreSnapshot(snapshot: ProjectMemorySnapshot): void {
    if (snapshot.formatVersion !== MEMORY_FORMAT_VERSION) throw new Error("Unsupported memory snapshot format.");
    if (!snapshot.projectId.trim()) throw new Error("Memory snapshot project id is required.");
    if (snapshot.memories.some((memory) => memory.projectId !== snapshot.projectId)) throw new Error("Memory snapshot contains records from another project.");
    const stagedRecords = new Map(snapshot.memories.map((memory) => [memory.id, memory]));
    const stagedEvents = [...(snapshot.lifecycleEvents ?? [])];
    for (const event of stagedEvents) {
      if (event.projectId !== snapshot.projectId) throw new Error("Memory snapshot contains lifecycle events from another project.");
      validateLifecycleEvent(event, stagedRecords);
    }
    const eventIds = new Set<string>();
    for (const event of stagedEvents) {
      if (eventIds.has(event.id)) throw new Error(`Duplicate memory lifecycle event id "${event.id}".`);
      eventIds.add(event.id);
    }
    this.restore(snapshot.memories);
    this.lifecycleEvents.push(...stagedEvents.map(cloneLifecycleEvent));
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

function cloneLifecycleEvent(event: MemoryLifecycleEvent): MemoryLifecycleEvent {
  return { ...event };
}

function validateLifecycleEvent(event: MemoryLifecycleEvent, records: ReadonlyMap<string, MemoryRecord>): void {
  if (!event.id?.trim()) throw new Error("Memory lifecycle event id is required.");
  if (!event.projectId?.trim()) throw new Error("Memory lifecycle event project id is required.");
  if (event.type !== "promotion" && event.type !== "supersession") throw new Error("Memory lifecycle event type is invalid.");
  if (!event.memoryId?.trim() || !records.has(event.memoryId)) throw new Error(`Memory lifecycle event references missing memory "${event.memoryId}".`);
  if (records.get(event.memoryId)?.projectId !== event.projectId) throw new Error("Memory lifecycle event record belongs to another project.");
  if (event.actor !== "author" && event.actor !== "system") throw new Error("Memory lifecycle event actor is invalid.");
  if (!event.reason?.trim()) throw new Error("Memory lifecycle event reason is required.");
  if (!event.occurredAt?.trim() || Number.isNaN(Date.parse(event.occurredAt))) throw new Error("Memory lifecycle event timestamp must be valid.");
  if (event.type === "supersession") {
    if (!event.replacementId?.trim() || !records.has(event.replacementId)) throw new Error("Memory supersession event requires an existing replacement.");
    if (records.get(event.replacementId)?.projectId !== event.projectId) throw new Error("Memory supersession replacement belongs to another project.");
  } else if (event.replacementId !== undefined) {
    throw new Error("Memory promotion event cannot contain a replacement.");
  }
}

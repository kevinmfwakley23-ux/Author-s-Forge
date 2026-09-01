import { randomUUID } from "node:crypto";
import type { MemoryAuthority, MemoryQuery, MemoryRecord } from "../domain/memory";
import { MEMORY_FORMAT_VERSION, isMemoryAuthority, validateMemoryRecord } from "../domain/memory";

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
  readonly replacementLinkCreated?: boolean;
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
      .sort(compareLifecycleEvents)
      .map(cloneLifecycleEvent);
  }

  query(query: MemoryQuery = {}): MemoryRecord[] {
    validateMemoryQuery(query);
    const changedSinceInstant = query.changedSince === undefined ? undefined : parseTimestamp(query.changedSince, "Memory changedSince must be a valid timestamp.");
    return filterMemoryRecords(this.list(), query, changedSinceInstant);
  }

  queryAt(query: MemoryQuery, asOf: string): MemoryRecord[] {
    validateMemoryQuery(query);
    if (typeof query.projectId !== "string" || !query.projectId.trim()) throw new Error("Point-in-time memory query requires a project id.");
    const asOfInstant = parseTimestamp(asOf, "Point-in-time memory query requires a valid asOf timestamp.");
    const changedSinceInstant = query.changedSince === undefined ? undefined : parseTimestamp(query.changedSince, "Memory changedSince must be a valid timestamp.");
    if (changedSinceInstant !== undefined && changedSinceInstant > asOfInstant) throw new Error("Memory changedSince cannot be later than asOf.");

    const projectId = query.projectId.trim();
    const historical = reconstructProjectMemoryAt(
      this.list().filter((memory) => memory.projectId === projectId),
      this.listLifecycleEvents(projectId),
      asOfInstant,
    );
    return filterMemoryRecords(historical, { ...query, projectId }, changedSinceInstant);
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

    const replacementLinkCreated = replacement.supersedes === undefined;
    const superseded: MemoryRecord = { ...existing, authority: "superseded", supersededBy: replacementId, updatedAt: now };
    const linkedReplacement: MemoryRecord = { ...replacement, supersedes: memoryId, updatedAt: now };
    validateMemoryRecord(superseded);
    validateMemoryRecord(linkedReplacement);
    const event: MemoryLifecycleEvent = {
      id: `memory-event-${randomUUID()}`, projectId: existing.projectId, type: "supersession", memoryId,
      replacementId, replacementLinkCreated, from: existing.authority, to: "superseded", actor: decision.actor,
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
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) throw new Error("Invalid memory snapshot.");
    if (snapshot.formatVersion !== MEMORY_FORMAT_VERSION) throw new Error("Unsupported memory snapshot format.");
    if (typeof snapshot.projectId !== "string" || !snapshot.projectId.trim()) throw new Error("Memory snapshot project id is required.");
    if (!Array.isArray(snapshot.memories)) throw new Error("Memory snapshot memories must be an array.");
    if (snapshot.lifecycleEvents !== undefined && !Array.isArray(snapshot.lifecycleEvents)) throw new Error("Memory snapshot lifecycle events must be an array.");

    const stagedRecords = new Map<string, MemoryRecord>();
    for (const memory of snapshot.memories) {
      validateMemoryRecord(memory);
      if (memory.projectId !== snapshot.projectId) throw new Error("Memory snapshot contains records from another project.");
      if (stagedRecords.has(memory.id)) throw new Error(`Duplicate memory id "${memory.id}" in memory snapshot.`);
      stagedRecords.set(memory.id, cloneMemory(memory));
    }

    const stagedEvents: MemoryLifecycleEvent[] = [];
    const eventIds = new Set<string>();
    for (const raw of snapshot.lifecycleEvents ?? []) {
      const event = validateLifecycleEvent(raw, stagedRecords);
      if (event.projectId !== snapshot.projectId) throw new Error("Memory snapshot contains lifecycle events from another project.");
      if (eventIds.has(event.id)) throw new Error(`Duplicate memory lifecycle event id "${event.id}".`);
      eventIds.add(event.id);
      stagedEvents.push(event);
    }
    validateLifecycleSnapshotConsistency(stagedEvents, stagedRecords);

    this.restore([...stagedRecords.values()]);
    this.lifecycleEvents.push(...stagedEvents.map(cloneLifecycleEvent));
  }
}

function validateMemoryQuery(query: MemoryQuery): void {
  if (!query || typeof query !== "object" || Array.isArray(query)) throw new Error("Memory query must be an object.");
  if (query.limit !== undefined && (!Number.isInteger(query.limit) || query.limit < 0)) throw new Error("Memory query limit must be a non-negative integer.");
}

function filterMemoryRecords(records: readonly MemoryRecord[], query: MemoryQuery, changedSinceInstant?: number): MemoryRecord[] {
  return records.filter((memory) => {
    if (query.projectId && memory.projectId !== query.projectId) return false;
    if (query.class && memory.class !== query.class) return false;
    if (query.authority && memory.authority !== query.authority) return false;
    if (query.authoritativeOnly && memory.authority !== "authoritative") return false;
    if (query.relatedMemoryId && !memory.relatedMemoryIds.includes(query.relatedMemoryId)) return false;
    if (query.relevanceTags && !query.relevanceTags.every((tag) => memory.relevanceTags.includes(tag))) return false;
    if (changedSinceInstant !== undefined && parseTimestamp(memory.updatedAt, `Memory "${memory.id}" has an invalid updatedAt timestamp.`) <= changedSinceInstant) return false;
    return true;
  }).slice(0, query.limit ?? Number.MAX_SAFE_INTEGER).map(cloneMemory);
}

function reconstructProjectMemoryAt(
  records: readonly MemoryRecord[],
  events: readonly MemoryLifecycleEvent[],
  asOfInstant: number,
): MemoryRecord[] {
  const historical = new Map(
    records
      .filter((memory) => parseTimestamp(memory.createdAt, `Memory "${memory.id}" has an invalid createdAt timestamp.`) <= asOfInstant)
      .map((memory) => [memory.id, cloneMemory(memory)]),
  );

  for (const memory of historical.values()) {
    const updatedAtInstant = parseTimestamp(memory.updatedAt, `Memory "${memory.id}" has an invalid updatedAt timestamp.`);
    if (updatedAtInstant <= asOfInstant) continue;
    const explained = events.some((event) => {
      const occurredAt = parseTimestamp(event.occurredAt, "Memory lifecycle event timestamp must be valid.");
      return occurredAt === updatedAtInstant && (event.memoryId === memory.id || event.replacementId === memory.id);
    });
    if (!explained) throw new Error(`Memory "${memory.id}" cannot be reconstructed at the requested time because its update history is incomplete.`);
  }

  const futureEvents = events
    .filter((event) => parseTimestamp(event.occurredAt, "Memory lifecycle event timestamp must be valid.") > asOfInstant)
    .sort((a, b) => compareLifecycleEvents(b, a));

  for (const event of futureEvents) {
    if (event.type === "promotion") {
      const memory = historical.get(event.memoryId);
      if (memory) historical.set(event.memoryId, { ...memory, authority: event.from });
      continue;
    }

    const memory = historical.get(event.memoryId);
    if (memory) {
      const { supersededBy: _supersededBy, ...restored } = memory;
      historical.set(event.memoryId, { ...restored, authority: event.from });
    }

    if (!event.replacementId) continue;
    const replacement = historical.get(event.replacementId);
    if (!replacement || replacement.supersedes !== event.memoryId) continue;
    if (event.replacementLinkCreated === true) {
      const { supersedes: _supersedes, ...unlinked } = replacement;
      historical.set(event.replacementId, unlinked);
    } else if (event.replacementLinkCreated === undefined) {
      throw new Error(`Memory supersession event "${event.id}" cannot be reconstructed before its transition because replacement-link provenance is missing.`);
    }
  }

  for (const [memoryId, memory] of historical) {
    const updatedAtInstant = parseTimestamp(memory.updatedAt, `Memory "${memory.id}" has an invalid updatedAt timestamp.`);
    if (updatedAtInstant <= asOfInstant) continue;
    const priorEvent = events
      .filter((event) => {
        const occurredAt = parseTimestamp(event.occurredAt, "Memory lifecycle event timestamp must be valid.");
        return occurredAt <= asOfInstant && (event.memoryId === memoryId || event.replacementId === memoryId);
      })
      .sort((a, b) => compareLifecycleEvents(b, a))[0];
    historical.set(memoryId, { ...memory, updatedAt: priorEvent?.occurredAt ?? memory.createdAt });
  }

  return [...historical.values()].sort((a, b) => a.id.localeCompare(b.id)).map(cloneMemory);
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

function isActiveAuthority(authority: MemoryAuthority): boolean {
  return authority !== "archived" && authority !== "superseded";
}

function cloneLifecycleEvent(event: MemoryLifecycleEvent): MemoryLifecycleEvent {
  return { ...event };
}

function compareLifecycleEvents(a: MemoryLifecycleEvent, b: MemoryLifecycleEvent): number {
  const byTime = a.occurredAt.localeCompare(b.occurredAt);
  if (byTime !== 0) return byTime;
  if (a.memoryId === b.memoryId && a.type !== b.type) return a.type === "promotion" ? -1 : 1;
  return a.id.localeCompare(b.id);
}

function validateLifecycleEvent(value: unknown, records: ReadonlyMap<string, MemoryRecord>): MemoryLifecycleEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid memory lifecycle event.");
  const event = value as MemoryLifecycleEvent;
  if (typeof event.id !== "string" || !event.id.trim()) throw new Error("Memory lifecycle event id is required.");
  if (typeof event.projectId !== "string" || !event.projectId.trim()) throw new Error("Memory lifecycle event project id is required.");
  if (event.type !== "promotion" && event.type !== "supersession") throw new Error("Memory lifecycle event type is invalid.");
  if (typeof event.memoryId !== "string" || !event.memoryId.trim() || !records.has(event.memoryId)) throw new Error(`Memory lifecycle event references missing memory "${String(event.memoryId)}".`);
  if (records.get(event.memoryId)?.projectId !== event.projectId) throw new Error("Memory lifecycle event record belongs to another project.");
  if (!isMemoryAuthority(event.from) || !isMemoryAuthority(event.to)) throw new Error("Memory lifecycle event authority is invalid.");
  if (event.actor !== "author" && event.actor !== "system") throw new Error("Memory lifecycle event actor is invalid.");
  if (typeof event.reason !== "string" || !event.reason.trim()) throw new Error("Memory lifecycle event reason is required.");
  if (typeof event.occurredAt !== "string" || !event.occurredAt.trim() || Number.isNaN(Date.parse(event.occurredAt))) throw new Error("Memory lifecycle event timestamp must be valid.");
  if (event.replacementLinkCreated !== undefined && typeof event.replacementLinkCreated !== "boolean") throw new Error("Memory lifecycle replacement link marker must be a boolean.");
  if (event.type === "supersession") {
    if (typeof event.replacementId !== "string" || !event.replacementId.trim() || !records.has(event.replacementId)) throw new Error("Memory supersession event requires an existing replacement.");
    if (records.get(event.replacementId)?.projectId !== event.projectId) throw new Error("Memory supersession replacement belongs to another project.");
  } else {
    if (event.replacementId !== undefined) throw new Error("Memory promotion event cannot contain a replacement.");
    if (event.replacementLinkCreated !== undefined) throw new Error("Memory promotion event cannot contain a replacement link marker.");
  }
  return cloneLifecycleEvent(event);
}

function validateLifecycleSnapshotConsistency(events: readonly MemoryLifecycleEvent[], records: ReadonlyMap<string, MemoryRecord>): void {
  const ordered = [...events].sort(compareLifecycleEvents);
  const authorityAfterEvent = new Map<string, MemoryAuthority>();
  const lastEventAt = new Map<string, number>();
  const promoted = new Set<string>();
  const superseded = new Set<string>();

  for (const event of ordered) {
    const memory = records.get(event.memoryId);
    if (!memory) throw new Error(`Memory lifecycle event references missing memory "${event.memoryId}".`);
    const occurredAt = Date.parse(event.occurredAt);
    if (occurredAt < Date.parse(memory.createdAt)) throw new Error(`Memory lifecycle event "${event.id}" predates memory "${memory.id}" creation.`);
    if (occurredAt > Date.parse(memory.updatedAt)) throw new Error(`Memory lifecycle event "${event.id}" occurs after memory "${memory.id}" updatedAt.`);
    const priorAt = lastEventAt.get(memory.id);
    if (priorAt !== undefined && occurredAt < priorAt) throw new Error(`Memory lifecycle events for "${memory.id}" are not chronological.`);
    lastEventAt.set(memory.id, occurredAt);

    const priorAuthority = authorityAfterEvent.get(memory.id);
    if (priorAuthority !== undefined && event.from !== priorAuthority) throw new Error(`Memory lifecycle event "${event.id}" does not continue the prior authority transition for "${memory.id}".`);

    if (event.type === "promotion") {
      if (!isPromotableAuthority(event.from) || event.to !== "authoritative") throw new Error(`Memory promotion event "${event.id}" has an impossible authority transition.`);
      if (promoted.has(memory.id)) throw new Error(`Memory "${memory.id}" has duplicate promotion events.`);
      promoted.add(memory.id);
      authorityAfterEvent.set(memory.id, "authoritative");
      continue;
    }

    if (!isActiveAuthority(event.from) || event.to !== "superseded") throw new Error(`Memory supersession event "${event.id}" has an impossible authority transition.`);
    if (superseded.has(memory.id)) throw new Error(`Memory "${memory.id}" has duplicate supersession events.`);
    superseded.add(memory.id);
    const replacement = records.get(event.replacementId!);
    if (!replacement) throw new Error(`Memory supersession event "${event.id}" references a missing replacement.`);
    if (replacement.id === memory.id) throw new Error(`Memory supersession event "${event.id}" cannot replace a memory with itself.`);
    if (replacement.class !== memory.class) throw new Error(`Memory supersession event "${event.id}" crosses memory classes.`);
    if (occurredAt < Date.parse(replacement.createdAt)) throw new Error(`Memory supersession event "${event.id}" predates its replacement memory.`);
    if (occurredAt > Date.parse(replacement.updatedAt)) throw new Error(`Memory supersession event "${event.id}" occurs after replacement memory "${replacement.id}" updatedAt.`);
    if (memory.supersededBy !== replacement.id || replacement.supersedes !== memory.id) throw new Error(`Memory supersession event "${event.id}" does not match reciprocal supersession links.`);
    authorityAfterEvent.set(memory.id, "superseded");
  }

  for (const [memoryId, authority] of authorityAfterEvent) {
    const current = records.get(memoryId);
    if (!current || current.authority !== authority) throw new Error(`Memory lifecycle ledger does not reconstruct current authority for "${memoryId}".`);
  }
}

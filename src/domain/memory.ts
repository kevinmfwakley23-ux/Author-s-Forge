export const MEMORY_FORMAT_VERSION = 1 as const;

export const MEMORY_CLASSES = Object.freeze([
  "author-memory", "project-memory", "story-canon", "character-memory", "relationship-memory",
  "location-memory", "timeline-memory", "style-memory", "research-memory", "creative-note",
  "working-draft", "hypothesis", "open-thread", "visual-identity", "production-memory",
  "publishing-memory", "marketing-memory", "generated-alternative", "decision-memory",
] as const);
export type MemoryClass = (typeof MEMORY_CLASSES)[number];

export const MEMORY_AUTHORITIES = Object.freeze([
  "proposed", "working", "verified", "authoritative", "superseded", "archived",
] as const);
export type MemoryAuthority = (typeof MEMORY_AUTHORITIES)[number];

export const MEMORY_PROVENANCE_KINDS = Object.freeze(["source", "author", "system"] as const);
export type MemoryProvenanceKind = (typeof MEMORY_PROVENANCE_KINDS)[number];

export interface MemoryProvenance { readonly kind: MemoryProvenanceKind; readonly reference: string; readonly recordedAt: string; }
export interface MemoryRecord {
  readonly id: string; readonly projectId: string; readonly class: MemoryClass; readonly authority: MemoryAuthority;
  readonly summary: string; readonly content: string; readonly createdAt: string; readonly updatedAt: string;
  readonly provenance: readonly MemoryProvenance[]; readonly supersedes?: string; readonly supersededBy?: string;
  readonly relatedMemoryIds: readonly string[]; readonly relevanceTags: readonly string[];
  readonly stateKey?: string; readonly stateValue?: string;
}
export interface MemoryQuery {
  readonly projectId?: string; readonly class?: MemoryClass; readonly authority?: MemoryAuthority; readonly authoritativeOnly?: boolean;
  readonly relatedMemoryId?: string; readonly relevanceTags?: readonly string[]; readonly changedSince?: string; readonly limit?: number;
}
export interface CreateMemoryRecordInput {
  readonly id: string;
  readonly projectId: string;
  readonly class: MemoryClass;
  readonly authority: MemoryAuthority;
  readonly summary: string;
  readonly content: string;
  readonly provenance?: readonly MemoryProvenance[];
  readonly supersedes?: string;
  readonly relatedMemoryIds?: readonly string[];
  readonly relevanceTags?: readonly string[];
  readonly stateKey?: string;
  readonly stateValue?: string;
  readonly now?: string;
}

export function createMemoryRecord(input: CreateMemoryRecordInput): MemoryRecord {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Memory input object is required.");

  const id = requiredString(input.id, "Memory id");
  const projectId = requiredString(input.projectId, "Memory project id");
  const summary = requiredString(input.summary, "Memory summary");
  const content = requiredString(input.content, "Memory content");
  if (!isMemoryClass(input.class)) throw new Error(`Unsupported memory class "${String(input.class)}".`);
  if (!isMemoryAuthority(input.authority)) throw new Error(`Unsupported memory authority "${String(input.authority)}".`);

  const provenance = normalizeProvenance(input.provenance ?? []);
  if (input.authority === "authoritative" && provenance.length === 0) throw new Error("Authoritative memory requires provenance.");

  const supersedes = optionalString(input.supersedes, "Memory supersedes");
  if (supersedes === id) throw new Error("Memory cannot supersede itself.");

  const relatedMemoryIds = normalizeStrings(input.relatedMemoryIds ?? [], "Memory related ids");
  const relevanceTags = normalizeStrings(input.relevanceTags ?? [], "Memory relevance tags");
  const rawStateKey = optionalString(input.stateKey, "Memory state key");
  const rawStateValue = optionalString(input.stateValue, "Memory state value");
  if ((rawStateKey === undefined) !== (rawStateValue === undefined)) throw new Error("Memory state key and state value must be provided together.");
  const stateKey = rawStateKey === undefined ? undefined : normalizeStateKey(rawStateKey);
  const stateValue = rawStateValue === undefined ? undefined : normalizeStateValue(rawStateValue);
  const now = input.now ?? new Date().toISOString();
  validateTimestamp(now, "createdAt");

  const memory: MemoryRecord = {
    id, projectId, class: input.class, authority: input.authority,
    summary, content, createdAt: now, updatedAt: now, provenance,
    ...(supersedes ? { supersedes } : {}),
    relatedMemoryIds, relevanceTags,
    ...(stateKey === undefined ? {} : { stateKey, stateValue }),
  };
  validateMemoryRecord(memory);
  return memory;
}

export function validateMemoryRecord(memory: MemoryRecord): void {
  if (!memory || typeof memory !== "object") throw new Error("Memory record is required.");
  if (typeof memory.id !== "string" || !memory.id.trim()) throw new Error("Memory id is required.");
  if (typeof memory.projectId !== "string" || !memory.projectId.trim()) throw new Error("Memory project id is required.");
  if (!MEMORY_CLASSES.includes(memory.class)) throw new Error(`Unsupported memory class "${String(memory.class)}".`);
  if (!MEMORY_AUTHORITIES.includes(memory.authority)) throw new Error(`Unsupported memory authority "${String(memory.authority)}".`);
  if (typeof memory.summary !== "string" || !memory.summary.trim()) throw new Error("Memory summary is required.");
  if (typeof memory.content !== "string" || !memory.content.trim()) throw new Error("Memory content is required.");
  validateTimestamp(memory.createdAt, "createdAt");
  validateTimestamp(memory.updatedAt, "updatedAt");
  if (Date.parse(memory.updatedAt) < Date.parse(memory.createdAt)) throw new Error("Memory updatedAt cannot precede createdAt.");
  if (!Array.isArray(memory.provenance)) throw new Error("Memory provenance must be an array.");
  for (const item of memory.provenance) {
    if (!item || !MEMORY_PROVENANCE_KINDS.includes(item.kind)) throw new Error("Memory provenance kind is invalid.");
    if (typeof item.reference !== "string" || !item.reference.trim()) throw new Error("Memory provenance reference is required.");
    validateTimestamp(item.recordedAt, "provenance recordedAt");
  }
  if (memory.authority === "authoritative" && memory.provenance.length === 0) throw new Error("Authoritative memory requires provenance.");
  validateUniqueStringCollection(memory.relatedMemoryIds, "related ids");
  validateUniqueStringCollection(memory.relevanceTags, "relevance tags");
  validateOptionalLink(memory.supersedes, "supersedes");
  validateOptionalLink(memory.supersededBy, "supersededBy");
  if (memory.supersedes === memory.id || memory.supersededBy === memory.id) throw new Error("Memory cannot supersede itself.");
  if (memory.supersedes !== undefined && memory.supersededBy !== undefined && memory.supersedes === memory.supersededBy) {
    throw new Error("Memory supersession links cannot point to the same record in both directions.");
  }
  const hasStateKey = memory.stateKey !== undefined;
  const hasStateValue = memory.stateValue !== undefined;
  if (hasStateKey !== hasStateValue) throw new Error("Memory state key and state value must be provided together.");
  if (hasStateKey) {
    if (typeof memory.stateKey !== "string" || !memory.stateKey.trim()) throw new Error("Memory state key is required when state value is present.");
    if (memory.stateKey !== normalizeStateKey(memory.stateKey)) throw new Error("Memory state key must use canonical normalization.");
    if (typeof memory.stateValue !== "string" || !memory.stateValue.trim()) throw new Error("Memory state value is required when state key is present.");
  }
}

export function isMemoryClass(value: unknown): value is MemoryClass {
  return typeof value === "string" && (MEMORY_CLASSES as readonly string[]).includes(value);
}

export function isMemoryAuthority(value: unknown): value is MemoryAuthority {
  return typeof value === "string" && (MEMORY_AUTHORITIES as readonly string[]).includes(value);
}

export function isMemoryProvenanceKind(value: unknown): value is MemoryProvenanceKind {
  return typeof value === "string" && (MEMORY_PROVENANCE_KINDS as readonly string[]).includes(value);
}

export function normalizeMemoryStateKey(value: string): string {
  return normalizeStateKey(requiredString(value, "Memory state key"));
}

export function normalizeMemoryStateValue(value: string): string {
  return normalizeStateValue(requiredString(value, "Memory state value"));
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function optionalString(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error(`${label} must be a string.`);
  const normalized = value.trim();
  return normalized || undefined;
}

function validateUniqueStringCollection(value: readonly string[], field: string): void {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`Memory ${field} must be non-empty strings.`);
  }
  if (new Set(value).size !== value.length) throw new Error(`Memory ${field} must not contain duplicates.`);
}

function validateOptionalLink(value: string | undefined, field: string): void {
  if (value !== undefined && (typeof value !== "string" || !value.trim())) {
    throw new Error(`Memory ${field} must be a non-empty string when present.`);
  }
}

function validateTimestamp(value: string, field: string): void {
  if (typeof value !== "string" || !value.trim() || Number.isNaN(Date.parse(value))) throw new Error(`Memory ${field} must be a valid timestamp.`);
}

function normalizeProvenance(provenance: unknown): readonly MemoryProvenance[] {
  if (!Array.isArray(provenance)) throw new Error("Memory provenance must be an array.");
  return provenance.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Memory provenance entry must be an object.");
    const value = item as Record<string, unknown>;
    if (!isMemoryProvenanceKind(value.kind)) throw new Error("Memory provenance kind is invalid.");
    const reference = requiredString(value.reference, "Memory provenance reference");
    if (typeof value.recordedAt !== "string") throw new Error("Memory provenance recordedAt must be a valid timestamp.");
    validateTimestamp(value.recordedAt, "provenance recordedAt");
    return { kind: value.kind, reference, recordedAt: value.recordedAt };
  });
}

function normalizeStrings(values: unknown, label: string): readonly string[] {
  if (!Array.isArray(values)) throw new Error(`${label} must be an array.`);
  const normalized = values.map((value) => {
    if (typeof value !== "string") throw new Error(`${label} must contain strings.`);
    return value.trim();
  }).filter(Boolean);
  return [...new Set(normalized)].sort();
}

function normalizeStateKey(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("und").replace(/\s+/g, " ");
}

function normalizeStateValue(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ");
}
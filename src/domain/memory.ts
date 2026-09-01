export const MEMORY_FORMAT_VERSION = 1 as const;

export type MemoryClass =
  | "author-memory" | "project-memory" | "story-canon" | "character-memory" | "relationship-memory"
  | "location-memory" | "timeline-memory" | "style-memory" | "research-memory" | "creative-note"
  | "working-draft" | "hypothesis" | "open-thread" | "visual-identity" | "production-memory"
  | "publishing-memory" | "marketing-memory" | "generated-alternative" | "decision-memory";

export type MemoryAuthority = "proposed" | "working" | "verified" | "authoritative" | "superseded" | "archived";

const MEMORY_CLASSES: readonly MemoryClass[] = [
  "author-memory", "project-memory", "story-canon", "character-memory", "relationship-memory",
  "location-memory", "timeline-memory", "style-memory", "research-memory", "creative-note",
  "working-draft", "hypothesis", "open-thread", "visual-identity", "production-memory",
  "publishing-memory", "marketing-memory", "generated-alternative", "decision-memory",
];
const MEMORY_AUTHORITIES: readonly MemoryAuthority[] = ["proposed", "working", "verified", "authoritative", "superseded", "archived"];
const PROVENANCE_KINDS: readonly MemoryProvenance["kind"][] = ["source", "author", "system"];

export interface MemoryProvenance { readonly kind: "source" | "author" | "system"; readonly reference: string; readonly recordedAt: string; }
export interface MemoryRecord {
  readonly id: string; readonly projectId: string; readonly class: MemoryClass; readonly authority: MemoryAuthority;
  readonly summary: string; readonly content: string; readonly createdAt: string; readonly updatedAt: string;
  readonly provenance: readonly MemoryProvenance[]; readonly supersedes?: string; readonly supersededBy?: string;
  readonly relatedMemoryIds: readonly string[]; readonly relevanceTags: readonly string[];
}
export interface MemoryQuery {
  readonly projectId?: string; readonly class?: MemoryClass; readonly authority?: MemoryAuthority; readonly authoritativeOnly?: boolean;
  readonly relatedMemoryId?: string; readonly relevanceTags?: readonly string[]; readonly changedSince?: string; readonly limit?: number;
}
export function createMemoryRecord(input: {
  id: string; projectId: string; class: MemoryClass; authority: MemoryAuthority; summary: string; content: string;
  provenance?: readonly MemoryProvenance[]; supersedes?: string; relatedMemoryIds?: readonly string[]; relevanceTags?: readonly string[]; now?: string;
}): MemoryRecord {
  if (!input.id.trim()) throw new Error("Memory id is required.");
  if (!input.projectId.trim()) throw new Error("Memory project id is required.");
  if (!input.summary.trim()) throw new Error("Memory summary is required.");
  if (!input.content.trim()) throw new Error("Memory content is required.");
  if (input.supersedes === input.id) throw new Error("Memory cannot supersede itself.");
  const provenance = normalizeProvenance(input.provenance ?? []);
  if (input.authority === "authoritative" && provenance.length === 0) throw new Error("Authoritative memory requires provenance.");
  const now = input.now ?? new Date().toISOString();
  const memory: MemoryRecord = {
    id: input.id.trim(), projectId: input.projectId.trim(), class: input.class, authority: input.authority,
    summary: input.summary.trim(), content: input.content.trim(), createdAt: now, updatedAt: now, provenance,
    ...(input.supersedes ? { supersedes: input.supersedes.trim() } : {}),
    relatedMemoryIds: normalizeStrings(input.relatedMemoryIds ?? []), relevanceTags: normalizeStrings(input.relevanceTags ?? [])
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
    if (!item || !PROVENANCE_KINDS.includes(item.kind)) throw new Error("Memory provenance kind is invalid.");
    if (typeof item.reference !== "string" || !item.reference.trim()) throw new Error("Memory provenance reference is required.");
    validateTimestamp(item.recordedAt, "provenance recordedAt");
  }
  if (memory.authority === "authoritative" && memory.provenance.length === 0) throw new Error("Authoritative memory requires provenance.");
  if (!Array.isArray(memory.relatedMemoryIds) || memory.relatedMemoryIds.some((value) => typeof value !== "string" || !value.trim())) throw new Error("Memory related ids must be non-empty strings.");
  if (!Array.isArray(memory.relevanceTags) || memory.relevanceTags.some((value) => typeof value !== "string" || !value.trim())) throw new Error("Memory relevance tags must be non-empty strings.");
  if (memory.supersedes === memory.id || memory.supersededBy === memory.id) throw new Error("Memory cannot supersede itself.");
}

function validateTimestamp(value: string, field: string): void {
  if (typeof value !== "string" || !value.trim() || Number.isNaN(Date.parse(value))) throw new Error(`Memory ${field} must be a valid timestamp.`);
}
function normalizeProvenance(provenance: readonly MemoryProvenance[]): readonly MemoryProvenance[] {
  return provenance.map((item) => {
    if (!item.reference.trim()) throw new Error("Memory provenance reference is required.");
    validateTimestamp(item.recordedAt, "provenance recordedAt");
    return { ...item, reference: item.reference.trim() };
  });
}
function normalizeStrings(values: readonly string[]): readonly string[] { return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort(); }

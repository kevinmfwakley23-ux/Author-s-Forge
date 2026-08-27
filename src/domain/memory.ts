export const MEMORY_FORMAT_VERSION = 1 as const;

export type MemoryClass =
  | "author-memory"
  | "project-memory"
  | "story-canon"
  | "character-memory"
  | "relationship-memory"
  | "location-memory"
  | "timeline-memory"
  | "style-memory"
  | "research-memory"
  | "creative-note"
  | "working-draft"
  | "hypothesis"
  | "open-thread"
  | "visual-identity"
  | "production-memory"
  | "publishing-memory"
  | "marketing-memory"
  | "generated-alternative";

export type MemoryAuthority = "proposed" | "working" | "verified" | "authoritative" | "superseded" | "archived";

export interface MemoryProvenance {
  readonly kind: "source" | "author" | "system";
  readonly reference: string;
  readonly recordedAt: string;
}

export interface MemoryRecord {
  readonly id: string;
  readonly projectId: string;
  readonly class: MemoryClass;
  readonly authority: MemoryAuthority;
  readonly summary: string;
  readonly content: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly provenance: readonly MemoryProvenance[];
  readonly supersedes?: string;
  readonly relatedMemoryIds: readonly string[];
  readonly relevanceTags: readonly string[];
}

export interface MemoryQuery {
  readonly projectId?: string;
  readonly class?: MemoryClass;
  readonly authority?: MemoryAuthority;
  readonly authoritativeOnly?: boolean;
  readonly relatedMemoryId?: string;
  readonly relevanceTags?: readonly string[];
  readonly changedSince?: string;
  readonly limit?: number;
}

export function createMemoryRecord(input: {
  id: string;
  projectId: string;
  class: MemoryClass;
  authority: MemoryAuthority;
  summary: string;
  content: string;
  provenance?: readonly MemoryProvenance[];
  supersedes?: string;
  relatedMemoryIds?: readonly string[];
  relevanceTags?: readonly string[];
  now?: string;
}): MemoryRecord {
  if (!input.id.trim()) throw new Error("Memory id is required.");
  if (!input.projectId.trim()) throw new Error("Memory project id is required.");
  if (!input.summary.trim()) throw new Error("Memory summary is required.");
  if (!input.content.trim()) throw new Error("Memory content is required.");
  if (input.supersedes === input.id) throw new Error("Memory cannot supersede itself.");

  const provenance = normalizeProvenance(input.provenance ?? []);
  if (input.authority === "authoritative" && provenance.length === 0) {
    throw new Error("Authoritative memory requires provenance.");
  }

  const now = input.now ?? new Date().toISOString();
  return {
    id: input.id,
    projectId: input.projectId,
    class: input.class,
    authority: input.authority,
    summary: input.summary.trim(),
    content: input.content.trim(),
    createdAt: now,
    updatedAt: now,
    provenance,
    ...(input.supersedes ? { supersedes: input.supersedes } : {}),
    relatedMemoryIds: normalizeStrings(input.relatedMemoryIds ?? []),
    relevanceTags: normalizeStrings(input.relevanceTags ?? [])
  };
}

function normalizeProvenance(provenance: readonly MemoryProvenance[]): readonly MemoryProvenance[] {
  return provenance.map((item) => {
    if (!item.reference.trim()) throw new Error("Memory provenance reference is required.");
    if (!item.recordedAt.trim()) throw new Error("Memory provenance timestamp is required.");
    return { ...item, reference: item.reference.trim() };
  });
}

function normalizeStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

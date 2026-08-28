export declare const MEMORY_FORMAT_VERSION: 1;
export type MemoryClass = "author-memory" | "project-memory" | "story-canon" | "character-memory" | "relationship-memory" | "location-memory" | "timeline-memory" | "style-memory" | "research-memory" | "creative-note" | "working-draft" | "hypothesis" | "open-thread" | "visual-identity" | "production-memory" | "publishing-memory" | "marketing-memory" | "generated-alternative" | "decision-memory";
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
    readonly supersededBy?: string;
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
export declare function createMemoryRecord(input: {
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
}): MemoryRecord;

import type { ProjectState } from "./project";
import { CharacterBibleService } from "../application/character-bible";

export const CONTEXT_ASSEMBLY_FORMAT_VERSION = 3 as const;
export const CONTEXT_INCLUSION_MODES = ["full", "brief", "extended", "custom", "off"] as const;
export type ContextInclusionMode = typeof CONTEXT_INCLUSION_MODES[number];
export interface ContextSectionPolicy { readonly key: string; readonly mode: ContextInclusionMode; readonly maxWords?: number; }
export interface ContextAssemblyRequest {
  readonly projectId: string;
  readonly policies?: readonly ContextSectionPolicy[];
  readonly query?: string;
  readonly characterIds?: readonly string[];
  readonly characterAsOf?: string;
  readonly characterMemoryLimit?: number;
}
export interface ContextSelectionEvidence { readonly sourceId: string; readonly sectionKey: string; readonly reasons: readonly string[]; }
export interface ContextSection { readonly key: string; readonly title: string; readonly mode: ContextInclusionMode; readonly text: string; readonly sourceIds: readonly string[]; readonly wordCount: number; }
export interface AssembledWritingContext { readonly formatVersion: typeof CONTEXT_ASSEMBLY_FORMAT_VERSION; readonly projectId: string; readonly sections: readonly ContextSection[]; readonly totalWords: number; readonly sourceIds: readonly string[]; readonly evidence: readonly ContextSelectionEvidence[]; }
const DEFAULT_POLICIES: readonly ContextSectionPolicy[] = [
  { key: "canon", mode: "full" }, { key: "characters", mode: "extended" }, { key: "relationships", mode: "extended" },
  { key: "timeline", mode: "brief" }, { key: "research", mode: "brief" }, { key: "voice", mode: "full" }, { key: "unresolved-threads", mode: "full" },
];
interface SelectedRecord { readonly id: string; readonly text: string; readonly reasons: readonly string[]; }
export function assembleWritingContext(project: ProjectState, request: ContextAssemblyRequest): AssembledWritingContext {
  if (request.projectId !== project.metadata.id) throw new Error("Context assembly belongs to another project.");
  const built = (request.policies ?? DEFAULT_POLICIES).map((policy) => buildSection(project, policy, request)).filter((entry): entry is { section: ContextSection; evidence: readonly ContextSelectionEvidence[] } => entry !== null);
  const sections = built.map((entry) => entry.section);
  const sourceIds = [...new Set(sections.flatMap((section) => section.sourceIds))];
  return { formatVersion: CONTEXT_ASSEMBLY_FORMAT_VERSION, projectId: project.metadata.id, sections, totalWords: sections.reduce((total, section) => total + section.wordCount, 0), sourceIds, evidence: built.flatMap((entry) => entry.evidence) };
}
function buildSection(project: ProjectState, policy: ContextSectionPolicy, request: ContextAssemblyRequest): { section: ContextSection; evidence: readonly ContextSelectionEvidence[] } | null {
  if (!CONTEXT_INCLUSION_MODES.includes(policy.mode)) throw new Error(`Invalid context inclusion mode: ${policy.mode}.`);
  if (policy.mode === "off") return null;
  const records = selectRecords(project, policy.key, request);
  const raw = records.map((record) => record.text).filter(Boolean).join("\n\n");
  if (!raw) return null;
  const maxWords = policy.maxWords ?? (policy.mode === "brief" ? 450 : policy.mode === "extended" ? 1000 : policy.mode === "custom" ? 500 : Number.MAX_SAFE_INTEGER);
  const text = truncateWords(raw, maxWords);
  return {
    section: { key: policy.key, title: titleFor(policy.key), mode: policy.mode, text, sourceIds: records.map((record) => record.id), wordCount: countWords(text) },
    evidence: records.map((record) => ({ sourceId: record.id, sectionKey: policy.key, reasons: record.reasons })),
  };
}
function selectRecords(project: ProjectState, key: string, request: ContextAssemblyRequest): SelectedRecord[] {
  const queryTerms = tokenizeQuery(request.query);
  const memories = (className: string) => project.memories
    .filter((memory) => memory.class === className && memory.authority !== "archived" && memory.authority !== "superseded")
    .map((memory) => ({ memory, matchedTerms: matchedQueryTerms(`${memory.summary} ${memory.content} ${memory.relevanceTags.join(" ")}`, queryTerms) }))
    .filter(({ matchedTerms }) => queryTerms.length === 0 || matchedTerms.length > 0)
    .sort((a, b) => b.matchedTerms.length - a.matchedTerms.length || authorityWeight(b.memory.authority) - authorityWeight(a.memory.authority) || b.memory.updatedAt.localeCompare(a.memory.updatedAt) || a.memory.id.localeCompare(b.memory.id))
    .map(({ memory, matchedTerms }) => ({ id: memory.id, text: `${memory.summary}\n${memory.content}`, reasons: [memory.authority === "authoritative" ? "authoritative" : `authority:${memory.authority}`, ...(matchedTerms.length ? [`terms:${matchedTerms.join(",")}`] : ["section-default"])] }));
  if (key === "canon") return memories("story-canon");
  if (key === "relationships") return memories("relationship-memory");
  if (key === "timeline") return memories("timeline-memory");
  if (key === "research") return memories("research-memory");
  if (key === "unresolved-threads") return memories("open-thread");
  if (key === "voice") return memories("style-memory");
  if (key === "characters") return selectCharacterMemory(project, request);
  return [];
}
function selectCharacterMemory(project: ProjectState, request: ContextAssemblyRequest): SelectedRecord[] {
  const characters = project.characters ?? [];
  if (!characters.length) return [];
  const service = new CharacterBibleService();
  service.restoreProject(project.metadata.id, characters);
  const hits = service.memory({
    projectId: project.metadata.id,
    characterIds: request.characterIds,
    asOf: request.characterAsOf,
    queryTerms: tokenizeQuery(request.query),
    limit: request.characterMemoryLimit ?? 8,
  });
  return hits.map((hit) => ({
    id: hit.characterId,
    text: [
      `Character: ${hit.characterName}`,
      `Relevance: ${hit.score}`,
      ...(hit.evidence.length ? [`Evidence: ${hit.evidence.join("; ")}`] : []),
      JSON.stringify(hit.profile, null, 2),
    ].join("\n"),
    reasons: hit.evidence.length ? hit.evidence : ["character-selection"],
  }));
}
function tokenizeQuery(query: string | undefined): string[] {
  if (!query) return [];
  return [...new Set(query.toLowerCase().split(/[^\p{L}\p{N}]+/u).map((term) => term.trim()).filter((term) => term.length >= 3))].slice(0, 16);
}
function matchedQueryTerms(value: string, queryTerms: readonly string[]): string[] {
  if (!queryTerms.length) return [];
  const searchable = value.toLowerCase();
  return queryTerms.filter((term) => searchable.includes(term));
}
function authorityWeight(authority: ProjectState["memories"][number]["authority"]): number {
  switch (authority) {
    case "authoritative": return 40;
    case "verified": return 24;
    case "working": return 14;
    case "proposed": return 8;
    case "archived": return 2;
    case "superseded": return 0;
  }
}
function countWords(value: string): number { return value.trim() ? value.trim().split(/\s+/).length : 0; }
function truncateWords(value: string, maxWords: number): string { const words = value.trim().split(/\s+/); return words.length <= maxWords ? value.trim() : `${words.slice(0, maxWords).join(" ")}…`; }
function titleFor(key: string): string { return key.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }

import type { ProjectState } from "./project";
import type { MemoryClass } from "./memory";
import { CharacterBibleService } from "../application/character-bible";
import { selectSalientMemories } from "./memory-saliency";

export const CONTEXT_ASSEMBLY_FORMAT_VERSION = 4 as const;
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
  readonly memoryLimitPerSection?: number;
}
export interface ContextSelectionEvidence { readonly sourceId: string; readonly sectionKey: string; readonly reasons: readonly string[]; }
export interface ContextSection { readonly key: string; readonly title: string; readonly mode: ContextInclusionMode; readonly text: string; readonly sourceIds: readonly string[]; readonly wordCount: number; }
export interface AssembledWritingContext { readonly formatVersion: typeof CONTEXT_ASSEMBLY_FORMAT_VERSION; readonly projectId: string; readonly sections: readonly ContextSection[]; readonly totalWords: number; readonly sourceIds: readonly string[]; readonly evidence: readonly ContextSelectionEvidence[]; }
const DEFAULT_POLICIES: readonly ContextSectionPolicy[] = [
  { key: "canon", mode: "full" }, { key: "characters", mode: "extended" }, { key: "relationships", mode: "extended" },
  { key: "timeline", mode: "brief" }, { key: "research", mode: "brief" }, { key: "voice", mode: "full" }, { key: "unresolved-threads", mode: "full" },
];
interface SelectedRecord { readonly id: string; readonly text: string; readonly reasons: readonly string[]; }
const MEMORY_SECTION_CLASSES: Readonly<Record<string, MemoryClass>> = {
  canon: "story-canon",
  relationships: "relationship-memory",
  timeline: "timeline-memory",
  research: "research-memory",
  voice: "style-memory",
  "unresolved-threads": "open-thread",
};
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
  if (key === "characters") return selectCharacterMemory(project, request);
  const className = MEMORY_SECTION_CLASSES[key];
  if (!className) return [];
  return selectSalientMemories(project.memories, {
    projectId: project.metadata.id,
    class: className,
    queryTerms: tokenizeQuery(request.query),
    limit: request.memoryLimitPerSection ?? 8,
  }).map((hit) => ({ id: hit.memory.id, text: `${hit.memory.summary}\n${hit.memory.content}`, reasons: hit.reasons }));
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
  return [...new Set(tokenizeText(query))].slice(0, 16);
}
function tokenizeText(value: string): string[] {
  return value.toLowerCase().split(/[^\p{L}\p{N}]+/u).map((term) => term.trim()).filter((term) => term.length >= 3);
}
function countWords(value: string): number { return value.trim() ? value.trim().split(/\s+/).length : 0; }
function truncateWords(value: string, maxWords: number): string { const words = value.trim().split(/\s+/); return words.length <= maxWords ? value.trim() : `${words.slice(0, maxWords).join(" ")}…`; }
function titleFor(key: string): string { return key.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }

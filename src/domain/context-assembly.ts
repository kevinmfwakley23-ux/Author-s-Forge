import type { ProjectState } from "./project";

export const CONTEXT_ASSEMBLY_FORMAT_VERSION = 1 as const;
export const CONTEXT_INCLUSION_MODES = ["full", "brief", "extended", "custom", "off"] as const;
export type ContextInclusionMode = typeof CONTEXT_INCLUSION_MODES[number];

export interface ContextSectionPolicy {
  readonly key: string;
  readonly mode: ContextInclusionMode;
  readonly maxWords?: number;
}

export interface ContextAssemblyRequest {
  readonly projectId: string;
  readonly policies?: readonly ContextSectionPolicy[];
  readonly query?: string;
  readonly characterIds?: readonly string[];
  readonly memoryClasses?: readonly string[];
}

export interface ContextSection {
  readonly key: string;
  readonly title: string;
  readonly mode: ContextInclusionMode;
  readonly text: string;
  readonly sourceIds: readonly string[];
  readonly wordCount: number;
}

export interface AssembledWritingContext {
  readonly formatVersion: typeof CONTEXT_ASSEMBLY_FORMAT_VERSION;
  readonly projectId: string;
  readonly sections: readonly ContextSection[];
  readonly totalWords: number;
  readonly sourceIds: readonly string[];
}

const DEFAULT_POLICIES: readonly ContextSectionPolicy[] = [
  { key: "canon", mode: "full" },
  { key: "characters", mode: "extended" },
  { key: "relationships", mode: "extended" },
  { key: "timeline", mode: "brief" },
  { key: "research", mode: "brief" },
  { key: "voice", mode: "full" },
  { key: "unresolved-threads", mode: "full" },
];

export function assembleWritingContext(project: ProjectState, request: ContextAssemblyRequest): AssembledWritingContext {
  if (request.projectId !== project.metadata.id) throw new Error("Context assembly belongs to another project.");
  const policies = request.policies ?? DEFAULT_POLICIES;
  const sections = policies.map((policy) => buildSection(project, policy, request)).filter((section): section is ContextSection => section !== null);
  const sourceIds = [...new Set(sections.flatMap((section) => section.sourceIds))];
  return {
    formatVersion: CONTEXT_ASSEMBLY_FORMAT_VERSION,
    projectId: project.metadata.id,
    sections,
    totalWords: sections.reduce((total, section) => total + section.wordCount, 0),
    sourceIds,
  };
}

function buildSection(project: ProjectState, policy: ContextSectionPolicy, request: ContextAssemblyRequest): ContextSection | null {
  if (!CONTEXT_INCLUSION_MODES.includes(policy.mode)) throw new Error(`Invalid context inclusion mode: ${policy.mode}.`);
  if (policy.mode === "off") return null;
  const records = selectRecords(project, policy.key, request);
  const raw = records.map((record) => record.text).filter(Boolean).join("\n\n");
  if (!raw) return null;
  const maxWords = policy.maxWords ?? (policy.mode === "brief" ? 450 : policy.mode === "extended" ? 1000 : policy.mode === "custom" ? 500 : Number.MAX_SAFE_INTEGER);
  const text = truncateWords(raw, maxWords);
  return {
    key: policy.key,
    title: titleFor(policy.key),
    mode: policy.mode,
    text,
    sourceIds: records.map((record) => record.id),
    wordCount: countWords(text),
  };
}

function selectRecords(project: ProjectState, key: string, request: ContextAssemblyRequest): Array<{ id: string; text: string }> {
  const query = request.query?.trim().toLowerCase();
  if (key === "canon") return project.memories.filter((memory) => memory.class === "story-canon" && memory.authority !== "archived").filter((memory) => matches(memory.summary + " " + memory.content, query)).map((memory) => ({ id: memory.id, text: `${memory.summary}\n${memory.content}` }));
  if (key === "relationships") return project.memories.filter((memory) => memory.class === "relationship-memory" && memory.authority !== "archived").filter((memory) => matches(memory.summary + " " + memory.content, query)).map((memory) => ({ id: memory.id, text: `${memory.summary}\n${memory.content}` }));
  if (key === "timeline") return project.memories.filter((memory) => memory.class === "timeline-memory" && memory.authority !== "archived").filter((memory) => matches(memory.summary + " " + memory.content, query)).map((memory) => ({ id: memory.id, text: `${memory.summary}\n${memory.content}` }));
  if (key === "research") return project.memories.filter((memory) => memory.class === "research-memory" && memory.authority !== "archived").filter((memory) => matches(memory.summary + " " + memory.content, query)).map((memory) => ({ id: memory.id, text: `${memory.summary}\n${memory.content}` }));
  if (key === "unresolved-threads") return project.memories.filter((memory) => memory.class === "open-thread" && memory.authority !== "archived").filter((memory) => matches(memory.summary + " " + memory.content, query)).map((memory) => ({ id: memory.id, text: `${memory.summary}\n${memory.content}` }));
  if (key === "voice") return (project.memories.filter((memory) => memory.class === "style-memory" && memory.authority !== "archived").filter((memory) => matches(memory.summary + " " + memory.content, query)).map((memory) => ({ id: memory.id, text: `${memory.summary}\n${memory.content}` })));
  if (key === "characters") return (project.characters ?? []).filter((character) => request.characterIds?.length ? request.characterIds.includes(character.id) : true).filter((character) => matches(character.profile.name, query)).map((character) => ({ id: character.id, text: character.profile.name }));
  return [];
}

function matches(value: string, query: string | undefined): boolean { return !query || value.toLowerCase().includes(query); }
function countWords(value: string): number { return value.trim() ? value.trim().split(/\s+/).length : 0; }
function truncateWords(value: string, maxWords: number): string { const words = value.trim().split(/\s+/); return words.length <= maxWords ? value.trim() : `${words.slice(0, maxWords).join(" ")}…`; }
function titleFor(key: string): string { return key.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }

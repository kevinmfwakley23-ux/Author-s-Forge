import { RESEARCH_DOMAINS, type ResearchDomain } from "./research";
import type { MemoryRecord } from "./memory";

export const KNOWLEDGE_GAP_RADAR_FORMAT_VERSION = 1 as const;

export type KnowledgeGapKind = "unsupported-claim" | "open-question" | "weak-evidence" | "conflicting-evidence";
export type KnowledgeGapSeverity = "info" | "watch" | "high";

export interface KnowledgeGapSignal {
  readonly id: string;
  readonly projectId: string;
  readonly kind: KnowledgeGapKind;
  readonly severity: KnowledgeGapSeverity;
  readonly summary: string;
  readonly rationale: string;
  readonly sourceMemoryIds: readonly string[];
  readonly evidenceMemoryIds: readonly string[];
  readonly suggestedQuestion: string;
  readonly suggestedDomain: ResearchDomain;
  readonly relevanceTags: readonly string[];
}

export interface KnowledgeGapRadarReport {
  readonly formatVersion: typeof KNOWLEDGE_GAP_RADAR_FORMAT_VERSION;
  readonly projectId: string;
  readonly generatedAt: string;
  readonly signals: readonly KnowledgeGapSignal[];
}

/**
 * Builds author-visible research candidates from durable project memory.
 *
 * The radar never asserts that a candidate is false. It asks whether a working
 * claim/open thread has source-backed research, whether existing research is
 * weak, or whether source-backed claims conflict. Archived/superseded memories
 * are ignored so obsolete state does not create false alarms.
 */
export function createKnowledgeGapRadarReport(input: {
  readonly projectId: string;
  readonly memories: readonly MemoryRecord[];
  readonly now?: string;
}): KnowledgeGapRadarReport {
  const projectId = input.projectId.trim();
  if (!projectId) throw new Error("Knowledge Gap Radar project id is required.");
  const memories = input.memories.filter((memory) => memory.projectId === projectId && memory.authority !== "archived" && memory.authority !== "superseded");
  if (input.memories.some((memory) => memory.projectId !== projectId)) throw new Error("Knowledge Gap Radar cannot mix memories from different projects.");

  const research = memories.filter((memory) => memory.class === "research-memory");
  const candidates = memories.filter((memory) => ["hypothesis", "open-thread", "working-draft", "creative-note", "project-memory", "story-canon"].includes(memory.class));
  const signals: KnowledgeGapSignal[] = [];

  for (const memory of candidates) {
    const evidence = research.filter((item) => relatedByIdOrTags(memory, item));
    const tags = normalizedTags(memory.relevanceTags);
    const domain = inferResearchDomain(tags);
    if (memory.class === "open-thread") {
      signals.push(signal({
        memory,
        kind: "open-question",
        severity: evidence.length ? "info" : "watch",
        rationale: evidence.length ? "This open question has research attached but still remains unresolved." : "This durable open question has no source-backed research attached yet.",
        evidence,
        domain,
        suggestedQuestion: questionFrom(memory, "What evidence resolves this open question?"),
      }));
      continue;
    }
    if (!evidence.length && memory.authority !== "authoritative") {
      signals.push(signal({
        memory,
        kind: "unsupported-claim",
        severity: memory.class === "hypothesis" ? "high" : "watch",
        rationale: "This working project statement has no related source-backed research memory.",
        evidence,
        domain,
        suggestedQuestion: questionFrom(memory, "What reliable evidence supports or disproves this statement?"),
      }));
      continue;
    }
    if (evidence.length && evidence.every((item) => item.authority === "proposed" || item.authority === "working")) {
      signals.push(signal({
        memory,
        kind: "weak-evidence",
        severity: "watch",
        rationale: "Related research exists, but none of it has been promoted beyond proposed/working authority.",
        evidence,
        domain,
        suggestedQuestion: questionFrom(memory, "What stronger or independently corroborating evidence is available?"),
      }));
    }
  }

  const byTag = new Map<string, MemoryRecord[]>();
  for (const memory of research) for (const tag of normalizedTags(memory.relevanceTags)) {
    const bucket = byTag.get(tag) ?? [];
    bucket.push(memory);
    byTag.set(tag, bucket);
  }
  for (const [tag, bucket] of byTag) {
    const summaries = new Set(bucket.map((memory) => normalizeText(memory.summary)));
    if (bucket.length < 2 || summaries.size < 2 || !looksConflicting(bucket)) continue;
    const ids = bucket.map((memory) => memory.id).sort();
    signals.push({
      id: `gap:conflict:${slug(tag)}:${stableId(ids)}`,
      projectId,
      kind: "conflicting-evidence",
      severity: "high",
      summary: `Conflicting research evidence for ${tag}`,
      rationale: "Source-backed research tied to the same project topic contains opposing claim language and should be reconciled before it is treated as settled context.",
      sourceMemoryIds: [],
      evidenceMemoryIds: ids,
      suggestedQuestion: `Which source-backed claim about ${tag} is best supported, and why do the sources disagree?`,
      suggestedDomain: inferResearchDomain([tag]),
      relevanceTags: [tag],
    });
  }

  return {
    formatVersion: KNOWLEDGE_GAP_RADAR_FORMAT_VERSION,
    projectId,
    generatedAt: input.now ?? new Date().toISOString(),
    signals: dedupeSignals(signals).sort(compareSignals).map(cloneSignal),
  };
}

function signal(input: { memory: MemoryRecord; kind: KnowledgeGapKind; severity: KnowledgeGapSeverity; rationale: string; evidence: readonly MemoryRecord[]; domain: ResearchDomain; suggestedQuestion: string }): KnowledgeGapSignal {
  return {
    id: `gap:${input.kind}:${input.memory.id}`,
    projectId: input.memory.projectId,
    kind: input.kind,
    severity: input.severity,
    summary: input.memory.summary,
    rationale: input.rationale,
    sourceMemoryIds: [input.memory.id],
    evidenceMemoryIds: input.evidence.map((item) => item.id).sort(),
    suggestedQuestion: input.suggestedQuestion,
    suggestedDomain: input.domain,
    relevanceTags: normalizedTags(input.memory.relevanceTags),
  };
}

function relatedByIdOrTags(candidate: MemoryRecord, research: MemoryRecord): boolean {
  if (research.relatedMemoryIds.includes(candidate.id) || candidate.relatedMemoryIds.includes(research.id)) return true;
  const candidateTags = new Set(normalizedTags(candidate.relevanceTags));
  return normalizedTags(research.relevanceTags).some((tag) => candidateTags.has(tag));
}

function inferResearchDomain(tags: readonly string[]): ResearchDomain {
  for (const tag of tags) {
    const normalized = tag.toLowerCase().replace(/^domain:/, "");
    if ((RESEARCH_DOMAINS as readonly string[]).includes(normalized)) return normalized as ResearchDomain;
  }
  if (tags.some((tag) => /location|place|city|region/i.test(tag))) return "real-world-location";
  if (tags.some((tag) => /history|historical|period/i.test(tag))) return "historical-period";
  if (tags.some((tag) => /medical|science|injury|disease/i.test(tag))) return "medical-scientific";
  if (tags.some((tag) => /legal|law/i.test(tag))) return "legal-environmental";
  if (tags.some((tag) => /market|reader|genre/i.test(tag))) return "reader-expectation";
  return "terminology";
}

function questionFrom(memory: MemoryRecord, fallback: string): string {
  const content = memory.content.trim();
  if (memory.class === "open-thread" && content.endsWith("?")) return content;
  return `${fallback} Topic: ${memory.summary}`;
}

function looksConflicting(memories: readonly MemoryRecord[]): boolean {
  const positives = memories.some((memory) => /\b(?:is|was|did|does|can|will|has|true|yes)\b/i.test(memory.summary));
  const negatives = memories.some((memory) => /\b(?:not|never|no|cannot|can't|didn't|doesn't|false|without)\b/i.test(memory.summary));
  return positives && negatives;
}

function normalizedTags(values: readonly string[]): string[] { return [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))].sort(); }
function normalizeText(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function slug(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "topic"; }
function stableId(values: readonly string[]): string { let hash = 2166136261; for (const char of values.join("|")) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(16); }
function severityRank(value: KnowledgeGapSeverity): number { return value === "high" ? 0 : value === "watch" ? 1 : 2; }
function compareSignals(a: KnowledgeGapSignal, b: KnowledgeGapSignal): number { return severityRank(a.severity) - severityRank(b.severity) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id); }
function dedupeSignals(values: readonly KnowledgeGapSignal[]): KnowledgeGapSignal[] { return [...new Map(values.map((value) => [value.id, value])).values()]; }
function cloneSignal(value: KnowledgeGapSignal): KnowledgeGapSignal { return { ...value, sourceMemoryIds: [...value.sourceMemoryIds], evidenceMemoryIds: [...value.evidenceMemoryIds], relevanceTags: [...value.relevanceTags] }; }

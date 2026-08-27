export const RESEARCH_FORMAT_VERSION = 1 as const;

export const RESEARCH_DOMAINS = [
  "historical-period", "geography", "real-world-location", "travel-distance", "weather", "architecture",
  "clothing", "technology", "occupation", "political-environment", "cultural-practice", "terminology",
  "historical-event", "local-landmark", "regional-speech", "legal-environmental", "medical-scientific",
  "publishing", "market", "genre-trend", "reader-expectation", "comparable-book"
] as const;
export type ResearchDomain = typeof RESEARCH_DOMAINS[number];
export type ResearchConfidence = "low" | "medium" | "high";
export type ResearchRelevance = "low" | "medium" | "high";

export interface ResearchSource {
  readonly source: string;
  readonly date: string;
  readonly url: string;
}

export interface ResearchClaim extends ResearchSource {
  readonly id: string;
  readonly claim: string;
  readonly confidence: ResearchConfidence;
  readonly relevance: ResearchRelevance;
  readonly projectId: string;
  readonly bookId?: string;
  readonly chapterId?: string;
  readonly sceneId?: string;
  readonly domain: ResearchDomain;
  readonly researchQuestion: string;
  readonly researchedBecause: string;
  readonly createdAt: string;
}

export interface ResearchRecord {
  readonly id: string;
  readonly projectId: string;
  readonly question: string;
  readonly researchedBecause: string;
  readonly domain: ResearchDomain;
  readonly claims: readonly ResearchClaim[];
  readonly createdAt: string;
}

export function createResearchClaim(input: Omit<ResearchClaim, "createdAt"> & { now?: string }): ResearchClaim {
  requireText(input.id, "Research claim id"); requireText(input.projectId, "Research project id");
  requireText(input.source, "Research source"); requireText(input.url, "Research URL"); requireText(input.date, "Research date");
  requireText(input.claim, "Research claim"); requireText(input.researchQuestion, "Research question"); requireText(input.researchedBecause, "Research rationale");
  if (!/^https?:\/\//i.test(input.url)) throw new Error("Research URL must use http or https.");
  if (Number.isNaN(Date.parse(input.date))) throw new Error("Research date must be a valid date.");
  return { ...input, createdAt: input.now ?? new Date().toISOString() };
}

export function createResearchRecord(input: Omit<ResearchRecord, "createdAt"> & { now?: string }): ResearchRecord {
  requireText(input.id, "Research record id"); requireText(input.projectId, "Research project id"); requireText(input.question, "Research question"); requireText(input.researchedBecause, "Research rationale");
  if (!input.claims.length) throw new Error("Research record requires at least one claim.");
  const claims = input.claims.map((claim) => createResearchClaim({ ...claim, projectId: input.projectId, domain: input.domain }));
  if (claims.some((claim) => claim.projectId !== input.projectId)) throw new Error("Research claim belongs to another project.");
  return { id: input.id, projectId: input.projectId, question: input.question.trim(), researchedBecause: input.researchedBecause.trim(), domain: input.domain, claims, createdAt: input.now ?? new Date().toISOString() };
}

function requireText(value: string, label: string): void { if (!value.trim()) throw new Error(`${label} is required.`); }

export const KDP_MARKET_INTELLIGENCE_FORMAT_VERSION = 1 as const;

export const MARKET_INTELLIGENCE_TOPICS = [
  "genre", "subgenre", "niche", "categories", "competing-titles", "publication-frequency",
  "reader-expectations", "pricing", "cover-conventions", "title-conventions", "keyword-opportunities",
  "emerging-niches", "underserved-niches", "comparable-books"
] as const;
export type MarketIntelligenceTopic = typeof MARKET_INTELLIGENCE_TOPICS[number];
export type SignalDirection = "positive" | "negative" | "mixed" | "neutral";
export type EvidenceStrength = "weak" | "moderate" | "strong";
export type OpportunityLevel = "low" | "moderate" | "promising" | "high";

export interface MarketEvidence {
  readonly id: string;
  readonly source: string;
  readonly url?: string;
  readonly observedAt: string;
  readonly publishedAt?: string;
  readonly observation: string;
  readonly strength: EvidenceStrength;
}

export interface MarketSignal {
  readonly id: string;
  readonly topic: MarketIntelligenceTopic;
  readonly label: string;
  readonly observation: string;
  readonly direction: SignalDirection;
  readonly evidenceIds: readonly string[];
}

export interface ComparableTitle {
  readonly title: string;
  readonly author?: string;
  readonly genre?: string;
  readonly price?: number;
  readonly currency?: string;
  readonly publishedDate?: string;
  readonly sourceUrl?: string;
  readonly observedAt: string;
}

export interface MarketKeywordRecommendation {
  readonly phrase: string;
  readonly score: number;
  readonly rationale: string;
  readonly evidenceIds: readonly string[];
  readonly recommendedForKdpSlot: boolean;
  readonly complianceNotes: readonly string[];
}

export interface MarketNicheOpportunity {
  readonly niche: string;
  readonly score: number;
  readonly demandSignal: "low" | "moderate" | "high" | "unknown";
  readonly competitionSignal: "low" | "moderate" | "high" | "unknown";
  readonly rationale: string;
  readonly evidenceIds: readonly string[];
}

export interface MarketOpportunityAssessment {
  readonly level: OpportunityLevel;
  readonly rationale: string;
  readonly signals: readonly string[];
  readonly limitations: readonly string[];
  readonly disclaimer: string;
}

export interface KdpMarketIntelligenceReport {
  readonly formatVersion: typeof KDP_MARKET_INTELLIGENCE_FORMAT_VERSION;
  readonly id: string;
  readonly projectId: string;
  readonly bookId?: string;
  readonly question: string;
  readonly market: string;
  readonly researchedAt: string;
  readonly evidence: readonly MarketEvidence[];
  readonly signals: readonly MarketSignal[];
  readonly comparableTitles: readonly ComparableTitle[];
  readonly keywordRecommendations?: readonly MarketKeywordRecommendation[];
  readonly nicheOpportunities?: readonly MarketNicheOpportunity[];
  readonly assessment: MarketOpportunityAssessment;
}

export interface CreateMarketIntelligenceReportInput {
  readonly id: string;
  readonly projectId: string;
  readonly bookId?: string;
  readonly question: string;
  readonly market: string;
  readonly researchedAt?: string;
  readonly evidence: readonly MarketEvidence[];
  readonly signals: readonly MarketSignal[];
  readonly comparableTitles?: readonly ComparableTitle[];
  readonly keywordRecommendations?: readonly MarketKeywordRecommendation[];
  readonly nicheOpportunities?: readonly MarketNicheOpportunity[];
  readonly assessment: MarketOpportunityAssessment;
}

const DISCLAIMER = "This report describes observable market signals and research evidence. It is not a guarantee, forecast, or promise of sales, rankings, revenue, or commercial performance.";
const FORBIDDEN_KEYWORD_PATTERNS = [
  /\bbestsell(?:er|ing)\b/i, /\bfree\b/i, /\bon\s+sale\b/i, /\bkindle\s+unlimited\b/i,
  /\bkdp\s+select\b/i, /<[^>]+>/, /https?:\/\//i, /\bamazon\b/i,
];

export function createKdpMarketIntelligenceReport(input: CreateMarketIntelligenceReportInput): KdpMarketIntelligenceReport {
  const report: KdpMarketIntelligenceReport = {
    formatVersion: KDP_MARKET_INTELLIGENCE_FORMAT_VERSION,
    id: required(input.id, "Market intelligence id"),
    projectId: required(input.projectId, "Market intelligence project id"),
    ...(input.bookId ? { bookId: required(input.bookId, "Market intelligence book id") } : {}),
    question: required(input.question, "Market intelligence question"),
    market: required(input.market, "Market"),
    researchedAt: input.researchedAt ?? new Date().toISOString(),
    evidence: input.evidence.map(validateEvidence),
    signals: input.signals.map(validateSignal),
    comparableTitles: (input.comparableTitles ?? []).map(validateComparable),
    ...(input.keywordRecommendations ? { keywordRecommendations: input.keywordRecommendations.map(validateKeywordRecommendation) } : {}),
    ...(input.nicheOpportunities ? { nicheOpportunities: input.nicheOpportunities.map(validateNicheOpportunity) } : {}),
    assessment: validateAssessment(input.assessment)
  };
  return validateKdpMarketIntelligenceReport(report);
}

export function validateKdpMarketIntelligenceReport(report: KdpMarketIntelligenceReport): KdpMarketIntelligenceReport {
  if (report.formatVersion !== KDP_MARKET_INTELLIGENCE_FORMAT_VERSION) throw new Error("Unsupported KDP market intelligence format version.");
  required(report.id, "Market intelligence id");
  required(report.projectId, "Market intelligence project id");
  required(report.question, "Market intelligence question");
  required(report.market, "Market");
  if (!isIsoDate(report.researchedAt)) throw new Error("Market intelligence researchedAt must be an ISO timestamp.");
  const evidence = report.evidence.map(validateEvidence);
  const evidenceIds = new Set<string>();
  for (const item of evidence) { if (evidenceIds.has(item.id)) throw new Error(`Duplicate market evidence id "${item.id}".`); evidenceIds.add(item.id); }
  const signals = report.signals.map(validateSignal);
  const signalIds = new Set<string>();
  for (const signal of signals) {
    if (signalIds.has(signal.id)) throw new Error(`Duplicate market signal id "${signal.id}".`);
    signalIds.add(signal.id);
    ensureEvidenceRefs(signal.evidenceIds, evidenceIds, `Market signal "${signal.id}"`);
  }
  const comparableTitles = report.comparableTitles.map(validateComparable);
  const keywordRecommendations = (report.keywordRecommendations ?? []).map(validateKeywordRecommendation);
  if (keywordRecommendations.length > 25) throw new Error("Market intelligence may retain at most 25 keyword candidates.");
  if (keywordRecommendations.filter((item) => item.recommendedForKdpSlot).length > 7) throw new Error("At most seven keyword recommendations may be marked for KDP keyword slots.");
  const keywordKeys = new Set<string>();
  for (const keyword of keywordRecommendations) {
    const key = keyword.phrase.toLocaleLowerCase();
    if (keywordKeys.has(key)) throw new Error(`Duplicate market keyword recommendation "${keyword.phrase}".`);
    keywordKeys.add(key);
    ensureEvidenceRefs(keyword.evidenceIds, evidenceIds, `Market keyword "${keyword.phrase}"`);
  }
  const nicheOpportunities = (report.nicheOpportunities ?? []).map(validateNicheOpportunity);
  if (nicheOpportunities.length > 25) throw new Error("Market intelligence may retain at most 25 niche opportunities.");
  const nicheKeys = new Set<string>();
  for (const niche of nicheOpportunities) {
    const key = niche.niche.toLocaleLowerCase();
    if (nicheKeys.has(key)) throw new Error(`Duplicate market niche opportunity "${niche.niche}".`);
    nicheKeys.add(key);
    ensureEvidenceRefs(niche.evidenceIds, evidenceIds, `Market niche "${niche.niche}"`);
  }
  const assessment = validateAssessment(report.assessment);
  if (assessment.disclaimer !== DISCLAIMER) throw new Error("Market opportunity assessment must use the required non-guarantee disclaimer.");
  return JSON.parse(JSON.stringify({ ...report, evidence, signals, comparableTitles, ...(keywordRecommendations.length ? { keywordRecommendations } : {}), ...(nicheOpportunities.length ? { nicheOpportunities } : {}), assessment })) as KdpMarketIntelligenceReport;
}

export function summarizeMarketIntelligence(report: KdpMarketIntelligenceReport): string {
  const validated = validateKdpMarketIntelligenceReport(report);
  const attention = validated.assessment.limitations.length;
  const recommendedKeywords = validated.keywordRecommendations?.filter((item) => item.recommendedForKdpSlot).length ?? 0;
  const niches = validated.nicheOpportunities?.length ?? 0;
  const suffix = [recommendedKeywords ? `${recommendedKeywords} KDP keyword candidate(s)` : "", niches ? `${niches} niche opportunity assessment(s)` : ""].filter(Boolean).join("; ");
  return `${validated.assessment.level === "promising" || validated.assessment.level === "high" ? "Promising market signals" : "Market signals identified"}: ${validated.assessment.rationale}${suffix ? ` ${suffix}.` : ""} ${attention ? `${attention} limitation(s) apply.` : ""}`.trim();
}

function validateEvidence(value: MarketEvidence): MarketEvidence {
  required(value.id, "Market evidence id"); required(value.source, "Market evidence source"); required(value.observation, "Market evidence observation");
  if (!isIsoDate(value.observedAt)) throw new Error(`Market evidence "${value.id}" has an invalid observedAt timestamp.`);
  if (value.publishedAt !== undefined && !isIsoDate(value.publishedAt)) throw new Error(`Market evidence "${value.id}" has an invalid publishedAt timestamp.`);
  if (!["weak", "moderate", "strong"].includes(value.strength)) throw new Error(`Market evidence "${value.id}" has an invalid strength.`);
  if (value.url !== undefined) validateHttpUrl(value.url, `Market evidence "${value.id}" URL`);
  return { ...value };
}
function validateSignal(value: MarketSignal): MarketSignal {
  required(value.id, "Market signal id"); required(value.label, "Market signal label"); required(value.observation, "Market signal observation");
  if (!MARKET_INTELLIGENCE_TOPICS.includes(value.topic)) throw new Error(`Unsupported market intelligence topic "${value.topic}".`);
  if (!["positive", "negative", "mixed", "neutral"].includes(value.direction)) throw new Error(`Market signal "${value.id}" has an invalid direction.`);
  if (!Array.isArray(value.evidenceIds) || !value.evidenceIds.length) throw new Error(`Market signal "${value.id}" requires evidence.`);
  return { ...value, evidenceIds: uniqueStrings(value.evidenceIds, `Market signal "${value.id}" evidence`) };
}
function validateComparable(value: ComparableTitle): ComparableTitle {
  required(value.title, "Comparable title"); required(value.observedAt, "Comparable title observedAt");
  if (!isIsoDate(value.observedAt)) throw new Error(`Comparable title "${value.title}" has an invalid observedAt timestamp.`);
  if (value.price !== undefined && (!Number.isFinite(value.price) || value.price < 0)) throw new Error(`Comparable title "${value.title}" has an invalid price.`);
  if (value.sourceUrl !== undefined) validateHttpUrl(value.sourceUrl, `Comparable title "${value.title}" source URL`);
  return { ...value };
}
function validateKeywordRecommendation(value: MarketKeywordRecommendation): MarketKeywordRecommendation {
  const phrase = required(value.phrase, "Market keyword phrase");
  if (phrase.length > 100) throw new Error(`Market keyword "${phrase}" is too long.`);
  if (FORBIDDEN_KEYWORD_PATTERNS.some((pattern) => pattern.test(phrase))) throw new Error(`Market keyword "${phrase}" contains prohibited or promotional metadata.`);
  if (!Number.isFinite(value.score) || value.score < 0 || value.score > 100) throw new Error(`Market keyword "${phrase}" score must be between 0 and 100.`);
  required(value.rationale, `Market keyword "${phrase}" rationale`);
  if (!Array.isArray(value.evidenceIds) || !value.evidenceIds.length) throw new Error(`Market keyword "${phrase}" requires evidence.`);
  if (!Array.isArray(value.complianceNotes)) throw new Error(`Market keyword "${phrase}" compliance notes must be an array.`);
  return { ...value, phrase, evidenceIds: uniqueStrings(value.evidenceIds, `Market keyword "${phrase}" evidence`), complianceNotes: uniqueStrings(value.complianceNotes, `Market keyword "${phrase}" compliance notes`) };
}
function validateNicheOpportunity(value: MarketNicheOpportunity): MarketNicheOpportunity {
  const niche = required(value.niche, "Market niche");
  if (!Number.isFinite(value.score) || value.score < 0 || value.score > 100) throw new Error(`Market niche "${niche}" score must be between 0 and 100.`);
  if (!["low", "moderate", "high", "unknown"].includes(value.demandSignal)) throw new Error(`Market niche "${niche}" demand signal is invalid.`);
  if (!["low", "moderate", "high", "unknown"].includes(value.competitionSignal)) throw new Error(`Market niche "${niche}" competition signal is invalid.`);
  required(value.rationale, `Market niche "${niche}" rationale`);
  if (!Array.isArray(value.evidenceIds) || !value.evidenceIds.length) throw new Error(`Market niche "${niche}" requires evidence.`);
  return { ...value, niche, evidenceIds: uniqueStrings(value.evidenceIds, `Market niche "${niche}" evidence`) };
}
function validateAssessment(value: MarketOpportunityAssessment): MarketOpportunityAssessment {
  required(value.rationale, "Opportunity rationale");
  if (!["low", "moderate", "promising", "high"].includes(value.level)) throw new Error("Invalid opportunity level.");
  if (!Array.isArray(value.signals) || !Array.isArray(value.limitations)) throw new Error("Opportunity assessment signals and limitations must be arrays.");
  return { ...value, signals: uniqueStrings(value.signals, "Opportunity signals"), limitations: uniqueStrings(value.limitations, "Opportunity limitations"), disclaimer: value.disclaimer ?? DISCLAIMER };
}
function ensureEvidenceRefs(values: readonly string[], known: ReadonlySet<string>, label: string): void { for (const id of values) if (!known.has(id)) throw new Error(`${label} references missing evidence "${id}".`); }
function uniqueStrings(values: readonly string[], label: string): string[] { if (!Array.isArray(values)) throw new Error(`${label} must be an array.`); const normalized = values.map((value) => required(value, label)); return [...new Set(normalized)]; }
function validateHttpUrl(value: string, label: string): string { let url: URL; try { url = new URL(value); } catch { throw new Error(`${label} must be a valid URL.`); } if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error(`${label} must use HTTP or HTTPS.`); return url.toString(); }
function required(value: string | undefined, label: string): string { if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`); return value.trim(); }
function isIsoDate(value: string): boolean { return typeof value === "string" && Number.isFinite(Date.parse(value)); }
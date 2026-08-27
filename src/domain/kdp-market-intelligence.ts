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
  readonly assessment: MarketOpportunityAssessment;
}

const DISCLAIMER = "This report describes observable market signals and research evidence. It is not a guarantee, forecast, or promise of sales, rankings, revenue, or commercial performance.";

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
    for (const id of signal.evidenceIds) if (!evidenceIds.has(id)) throw new Error(`Market signal "${signal.id}" references missing evidence "${id}".`);
  }
  const comparableTitles = report.comparableTitles.map(validateComparable);
  const assessment = validateAssessment(report.assessment);
  if (assessment.disclaimer !== DISCLAIMER) throw new Error("Market opportunity assessment must use the required non-guarantee disclaimer.");
  return JSON.parse(JSON.stringify({ ...report, evidence, signals, comparableTitles, assessment })) as KdpMarketIntelligenceReport;
}

export function summarizeMarketIntelligence(report: KdpMarketIntelligenceReport): string {
  const validated = validateKdpMarketIntelligenceReport(report);
  const attention = validated.assessment.limitations.length;
  return `${validated.assessment.level === "promising" || validated.assessment.level === "high" ? "Promising market signals" : "Market signals identified"}: ${validated.assessment.rationale} ${attention ? `${attention} limitation(s) apply.` : ""}`.trim();
}

function validateEvidence(value: MarketEvidence): MarketEvidence {
  required(value.id, "Market evidence id"); required(value.source, "Market evidence source"); required(value.observation, "Market evidence observation");
  if (!isIsoDate(value.observedAt)) throw new Error(`Market evidence "${value.id}" has an invalid observedAt timestamp.`);
  if (!["weak", "moderate", "strong"].includes(value.strength)) throw new Error(`Market evidence "${value.id}" has an invalid strength.`);
  if (value.url !== undefined) required(value.url, "Market evidence URL");
  return { ...value };
}
function validateSignal(value: MarketSignal): MarketSignal {
  required(value.id, "Market signal id"); required(value.label, "Market signal label"); required(value.observation, "Market signal observation");
  if (!MARKET_INTELLIGENCE_TOPICS.includes(value.topic)) throw new Error(`Unsupported market intelligence topic "${value.topic}".`);
  if (!["positive", "negative", "mixed", "neutral"].includes(value.direction)) throw new Error(`Market signal "${value.id}" has an invalid direction.`);
  return { ...value, evidenceIds: [...value.evidenceIds] };
}
function validateComparable(value: ComparableTitle): ComparableTitle {
  required(value.title, "Comparable title"); required(value.observedAt, "Comparable title observedAt");
  if (!isIsoDate(value.observedAt)) throw new Error(`Comparable title "${value.title}" has an invalid observedAt timestamp.`);
  if (value.price !== undefined && (!Number.isFinite(value.price) || value.price < 0)) throw new Error(`Comparable title "${value.title}" has an invalid price.`);
  return { ...value };
}
function validateAssessment(value: MarketOpportunityAssessment): MarketOpportunityAssessment {
  required(value.rationale, "Opportunity rationale");
  if (!["low", "moderate", "promising", "high"].includes(value.level)) throw new Error("Invalid opportunity level.");
  if (!Array.isArray(value.signals) || !Array.isArray(value.limitations)) throw new Error("Opportunity assessment signals and limitations must be arrays.");
  return { ...value, signals: [...value.signals], limitations: [...value.limitations], disclaimer: value.disclaimer ?? DISCLAIMER };
}
function required(value: string | undefined, label: string): string { if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`); return value.trim(); }
function isIsoDate(value: string): boolean { return typeof value === "string" && Number.isFinite(Date.parse(value)); }

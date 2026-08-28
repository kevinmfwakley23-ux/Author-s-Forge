export declare const KDP_MARKET_INTELLIGENCE_FORMAT_VERSION: 1;
export declare const MARKET_INTELLIGENCE_TOPICS: readonly ["genre", "subgenre", "niche", "categories", "competing-titles", "publication-frequency", "reader-expectations", "pricing", "cover-conventions", "title-conventions", "keyword-opportunities", "emerging-niches", "underserved-niches", "comparable-books"];
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
export declare function createKdpMarketIntelligenceReport(input: CreateMarketIntelligenceReportInput): KdpMarketIntelligenceReport;
export declare function validateKdpMarketIntelligenceReport(report: KdpMarketIntelligenceReport): KdpMarketIntelligenceReport;
export declare function summarizeMarketIntelligence(report: KdpMarketIntelligenceReport): string;

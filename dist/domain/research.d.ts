export declare const RESEARCH_FORMAT_VERSION: 1;
export declare const RESEARCH_DOMAINS: readonly ["historical-period", "geography", "real-world-location", "travel-distance", "weather", "architecture", "clothing", "technology", "occupation", "political-environment", "cultural-practice", "terminology", "historical-event", "local-landmark", "regional-speech", "legal-environmental", "medical-scientific", "publishing", "market", "genre-trend", "reader-expectation", "comparable-book"];
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
export declare function createResearchClaim(input: Omit<ResearchClaim, "createdAt"> & {
    now?: string;
}): ResearchClaim;
export declare function createResearchRecord(input: Omit<ResearchRecord, "createdAt"> & {
    now?: string;
}): ResearchRecord;

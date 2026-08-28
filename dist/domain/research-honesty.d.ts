export declare const RESEARCH_HONESTY_FORMAT_VERSION: 1;
export declare const RESEARCH_HONESTY_CLASSES: readonly ["known-fact", "source-supported", "likely-inference", "creative-fiction", "uncertain"];
export type ResearchHonestyClass = typeof RESEARCH_HONESTY_CLASSES[number];
export type EvidenceStrength = "none" | "indirect" | "direct";
export interface ResearchHonestyAssessment {
    readonly id: string;
    readonly claimId: string;
    readonly classification: ResearchHonestyClass;
    readonly evidenceStrength: EvidenceStrength;
    readonly explanation: string;
    readonly sourceBacked: boolean;
    readonly canonEligible: boolean;
    readonly assessedAt: string;
}
export interface ResearchHonestyRecord extends ResearchHonestyAssessment {
    readonly projectId: string;
    readonly assessment: ResearchHonestyAssessment;
}
export interface ResearchHonestyInput {
    readonly id: string;
    readonly projectId: string;
    readonly claimId: string;
    readonly classification: ResearchHonestyClass;
    readonly evidenceStrength: EvidenceStrength;
    readonly explanation: string;
    readonly sourceBacked?: boolean;
    readonly now?: string;
}
export declare function createResearchHonestyRecord(input: ResearchHonestyInput): ResearchHonestyRecord;
export declare function isResearchHonest(record: ResearchHonestyRecord): boolean;
export declare function assertResearchHonest(record: ResearchHonestyRecord): void;

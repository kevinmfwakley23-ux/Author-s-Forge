import { ProjectMemoryStore } from "./project-memory-store";
import { type ResearchHonestyClass, type ResearchHonestyRecord, type EvidenceStrength } from "../domain/research-honesty";
export interface ResearchHonestyQuery {
    readonly projectId: string;
    readonly claimId?: string;
    readonly classification?: ResearchHonestyClass;
    readonly canonEligible?: boolean;
    readonly limit?: number;
}
export interface ResearchHonestySummary {
    readonly projectId: string;
    readonly total: number;
    readonly byClassification: Readonly<Record<ResearchHonestyClass, number>>;
    readonly canonEligible: number;
    readonly nonCanonEligible: number;
}
export declare class ResearchHonestyService {
    private readonly memoryStore;
    constructor(memoryStore: ProjectMemoryStore);
    assess(input: {
        readonly id: string;
        readonly projectId: string;
        readonly claimId: string;
        readonly classification: ResearchHonestyClass;
        readonly evidenceStrength: EvidenceStrength;
        readonly explanation: string;
        readonly sourceBacked?: boolean;
        readonly now?: string;
    }): ResearchHonestyRecord;
    get(query: ResearchHonestyQuery): ResearchHonestyRecord[];
    summarize(projectId: string): ResearchHonestySummary;
}

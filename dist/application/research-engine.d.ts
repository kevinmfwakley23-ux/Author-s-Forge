import { type MemoryRecord } from "../domain/memory";
import { ProjectMemoryStore } from "./project-memory-store";
import { type ResearchClaim, type ResearchDomain, type ResearchRecord } from "../domain/research";
export interface ResearchRequest {
    readonly id: string;
    readonly projectId: string;
    readonly question: string;
    readonly researchedBecause: string;
    readonly domain: ResearchDomain;
    readonly bookId?: string;
    readonly chapterId?: string;
    readonly sceneId?: string;
}
export interface ResearchProviderRequest {
    readonly question: string;
    readonly domain: ResearchDomain;
    readonly projectId: string;
}
export interface ResearchProvider {
    research(request: ResearchProviderRequest): Promise<readonly ResearchProviderResult[]>;
}
export interface ResearchProviderResult {
    readonly source: string;
    readonly date: string;
    readonly url: string;
    readonly claim: string;
    readonly confidence: ResearchClaim["confidence"];
    readonly relevance: ResearchClaim["relevance"];
}
export interface ResearchSearchResult {
    readonly record: ResearchRecord;
    readonly memories: readonly MemoryRecord[];
}
export declare class ResearchEngine {
    private readonly provider;
    private readonly memoryStore;
    constructor(provider: ResearchProvider, memoryStore: ProjectMemoryStore);
    research(request: ResearchRequest): Promise<ResearchSearchResult>;
    retrieve(projectId: string, options?: {
        readonly domain?: ResearchDomain;
        readonly bookId?: string;
        readonly chapterId?: string;
        readonly sceneId?: string;
        readonly limit?: number;
    }): ResearchClaim[];
    listProjectResearch(projectId: string): ResearchClaim[];
}
export declare class StaticResearchProvider implements ResearchProvider {
    private readonly results;
    constructor(results: readonly ResearchProviderResult[]);
    research(_request: ResearchProviderRequest): Promise<readonly ResearchProviderResult[]>;
}

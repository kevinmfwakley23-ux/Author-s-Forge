import { type KdpMarketIntelligenceReport, type MarketEvidence, type MarketSignal, type ComparableTitle, type MarketOpportunityAssessment } from "../domain/kdp-market-intelligence";
export interface KdpMarketIntelligenceRequest {
    readonly id: string;
    readonly projectId: string;
    readonly bookId?: string;
    readonly question: string;
    readonly market: string;
}
export interface KdpMarketIntelligenceProviderRequest {
    readonly question: string;
    readonly market: string;
    readonly projectId: string;
    readonly bookId?: string;
}
export interface KdpMarketIntelligenceProviderResult {
    readonly evidence: readonly MarketEvidence[];
    readonly signals: readonly MarketSignal[];
    readonly comparableTitles?: readonly ComparableTitle[];
    readonly assessment: MarketOpportunityAssessment;
}
export interface KdpMarketIntelligenceProvider {
    research(request: KdpMarketIntelligenceProviderRequest): Promise<KdpMarketIntelligenceProviderResult>;
}
export declare class KdpMarketIntelligenceService {
    private readonly provider;
    constructor(provider: KdpMarketIntelligenceProvider);
    research(request: KdpMarketIntelligenceRequest): Promise<KdpMarketIntelligenceReport>;
}
export declare class StaticKdpMarketIntelligenceProvider implements KdpMarketIntelligenceProvider {
    private readonly result;
    constructor(result: KdpMarketIntelligenceProviderResult);
    research(_request: KdpMarketIntelligenceProviderRequest): Promise<KdpMarketIntelligenceProviderResult>;
}

import { createKdpMarketIntelligenceReport, type KdpMarketIntelligenceReport, type MarketEvidence, type MarketSignal, type ComparableTitle, type MarketOpportunityAssessment } from "../domain/kdp-market-intelligence";

export interface KdpMarketIntelligenceRequest {
  readonly id: string;
  readonly projectId: string;
  readonly bookId?: string;
  readonly question: string;
  readonly market: string;
}
export interface KdpMarketIntelligenceProviderRequest { readonly question: string; readonly market: string; readonly projectId: string; readonly bookId?: string; }
export interface KdpMarketIntelligenceProviderResult {
  readonly evidence: readonly MarketEvidence[];
  readonly signals: readonly MarketSignal[];
  readonly comparableTitles?: readonly ComparableTitle[];
  readonly assessment: MarketOpportunityAssessment;
}
export interface KdpMarketIntelligenceProvider { research(request: KdpMarketIntelligenceProviderRequest): Promise<KdpMarketIntelligenceProviderResult>; }

export class KdpMarketIntelligenceService {
  constructor(private readonly provider: KdpMarketIntelligenceProvider) {}
  async research(request: KdpMarketIntelligenceRequest): Promise<KdpMarketIntelligenceReport> {
    validateRequest(request);
    const result = await this.provider.research({ projectId: request.projectId, bookId: request.bookId, question: request.question.trim(), market: request.market.trim() });
    if (!result.evidence.length) throw new Error("KDP market intelligence provider returned no evidence.");
    return createKdpMarketIntelligenceReport({ ...request, evidence: result.evidence, signals: result.signals, comparableTitles: result.comparableTitles, assessment: result.assessment });
  }
}

export class StaticKdpMarketIntelligenceProvider implements KdpMarketIntelligenceProvider {
  constructor(private readonly result: KdpMarketIntelligenceProviderResult) {}
  async research(_request: KdpMarketIntelligenceProviderRequest): Promise<KdpMarketIntelligenceProviderResult> {
    return JSON.parse(JSON.stringify(this.result)) as KdpMarketIntelligenceProviderResult;
  }
}

function validateRequest(request: KdpMarketIntelligenceRequest): void {
  for (const [value, label] of [[request.id, "Market intelligence id"], [request.projectId, "Market intelligence project id"], [request.question, "Market intelligence question"], [request.market, "Market"]] as const) {
    if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  }
}

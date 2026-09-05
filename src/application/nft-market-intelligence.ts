import type { NftCollection } from "../domain/nft-creation";
import type { FileProjectStore } from "../infrastructure/file-project-store";
import { StudioLiveResearchService } from "./studio-live-research";

export interface NftMarketSignalReport {
  readonly formatVersion: 1;
  readonly collectionId: string;
  readonly generatedAt: string;
  readonly sourceBacked: true;
  readonly authority: "working";
  readonly demandPrediction: false;
  readonly investmentAdvice: false;
  readonly researchRecordId: string;
  readonly persistedMemoryIds: readonly string[];
  readonly claims: readonly {
    readonly source: string;
    readonly date: string;
    readonly url: string;
    readonly claim: string;
    readonly confidence: string;
    readonly relevance: string;
  }[];
  readonly positioningQuestions: readonly string[];
  readonly note: string;
}

/**
 * Live NFT market/audience research reuses Forge's governed web-research path.
 * It produces evidence and positioning questions, never a price/demand forecast.
 */
export class NftMarketIntelligenceService {
  private readonly liveResearch: StudioLiveResearchService;

  constructor(store: FileProjectStore, liveResearch?: StudioLiveResearchService) {
    this.liveResearch = liveResearch ?? new StudioLiveResearchService(store);
  }

  async research(collection: NftCollection, focus?: string): Promise<NftMarketSignalReport> {
    const focusText = typeof focus === "string" && focus.trim() ? focus.trim().slice(0, 4000) : "overall audience fit, comparable public collections, visual/category trends, marketplace mechanics, launch patterns, collector communication, and visible demand signals";
    const question = [
      `Research current public NFT/digital-collectible market signals relevant to an ORIGINAL collection named "${collection.title}".`,
      `Collection type: ${collection.collectionType}. Standard: ${collection.tokenStandard}. Chain: ${collection.chain}. Supply: ${collection.supply}.`,
      collection.audience ? `Intended audience hypothesis: ${collection.audience}.` : "The artist has not finalized the collector/audience hypothesis.",
      collection.artisticThesis ? `Artistic thesis: ${collection.artisticThesis}.` : "The artistic thesis is still being developed.",
      `Research focus: ${focusText}.`,
      "Use dated source-backed facts. Include current marketplace/creator-tool mechanics where relevant, public comparable-category signals without recommending imitation, and observable audience/launch patterns.",
      "Distinguish evidence from inference. Do not predict token price, investment returns, guaranteed sell-through, or guaranteed demand. Do not treat social follower counts or rarity alone as proof of durable demand.",
    ].join(" ");
    const result = await this.liveResearch.research(collection.forgeProjectId, {
      question,
      researchedBecause: `The author is preparing NFT collection ${collection.id} and wants current source-backed market/audience evidence before finalizing positioning and launch decisions.`,
      domain: "market",
    });
    return Object.freeze({
      formatVersion: 1 as const,
      collectionId: collection.id,
      generatedAt: new Date().toISOString(),
      sourceBacked: true as const,
      authority: "working" as const,
      demandPrediction: false as const,
      investmentAdvice: false as const,
      researchRecordId: result.record.id,
      persistedMemoryIds: Object.freeze([...result.persistedMemoryIds]),
      claims: Object.freeze(result.record.claims.map((claim) => Object.freeze({
        source: claim.source,
        date: claim.date,
        url: claim.url,
        claim: claim.claim,
        confidence: claim.confidence,
        relevance: claim.relevance,
      }))),
      positioningQuestions: Object.freeze([
        `Which source-backed audience signal most strongly overlaps with ${collection.title}'s actual artistic thesis?`,
        "Which apparent trend is already crowded enough that following it would weaken originality?",
        "What can be tested before minting—landing-page interest, waitlist conversion, community responses, or art preference—without implying future financial value?",
        "Which marketplace, metadata, reveal, and allowlist mechanics are current requirements versus optional launch choices?",
        "What evidence would make the artist reduce supply, change positioning, or postpone launch rather than manufacture urgency?",
      ]),
      note: "Market Signal Lab supplies evidence for creative and launch decisions. It does not guarantee demand, sales, liquidity, price appreciation, or investment returns.",
    });
  }
}

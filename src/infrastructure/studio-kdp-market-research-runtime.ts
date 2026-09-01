import { StudioKdpMarketResearchService } from "../application/studio-kdp-market-research";
import { FileProjectStore } from "./file-project-store";
import { OpenAiWebKdpMarketIntelligenceProvider } from "./openai-kdp-market-intelligence-provider";

/**
 * Production composition root for current-market research. No static/demo
 * provider is used here; missing provider credentials fail honestly.
 */
export function createConfiguredStudioKdpMarketResearch(store: FileProjectStore): StudioKdpMarketResearchService {
  return new StudioKdpMarketResearchService(store, new OpenAiWebKdpMarketIntelligenceProvider());
}

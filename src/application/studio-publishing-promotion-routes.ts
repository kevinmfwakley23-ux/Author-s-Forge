import type { IncomingMessage, ServerResponse } from "node:http";
import { FileProjectStore } from "../infrastructure/file-project-store";
import { createStudioAuthorCraftRoutes } from "./studio-author-craft-routes";
import { createStudioImageLabRoutes } from "./studio-image-lab-routes";
import { createStudioKnowledgeGapRoutes } from "./studio-knowledge-gap-routes";
import { createStudioLiveResearchRoutes } from "./studio-live-research-routes";
import { createStudioMarketPromotionRoutes } from "./studio-market-promotion-routes";
import { createStudioPublishingRoutes } from "./studio-publishing-routes";

export type StudioPublishingPromotionRouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL, projectId: string) => Promise<boolean>;

/**
 * Modular Studio extension boundary. Historical name is retained to avoid
 * destabilizing the server entrypoint while author-craft, research, image,
 * publishing, market and promotion routes remain independently implemented/testable.
 */
export function createStudioPublishingPromotionRoutes(store: FileProjectStore): StudioPublishingPromotionRouteHandler {
  const authorCraft = createStudioAuthorCraftRoutes(store);
  const knowledgeGaps = createStudioKnowledgeGapRoutes(store);
  const liveResearch = createStudioLiveResearchRoutes(store);
  const imageLab = createStudioImageLabRoutes(store);
  const publishing = createStudioPublishingRoutes(store);
  const marketPromotion = createStudioMarketPromotionRoutes(store);

  return async (req, res, url, projectId) => {
    if (await authorCraft(req, res, url, projectId)) return true;
    if (await knowledgeGaps(req, res, url, projectId)) return true;
    if (await liveResearch(req, res, url, projectId)) return true;
    if (await imageLab(req, res, url, projectId)) return true;
    if (await publishing(req, res, url, projectId)) return true;
    return marketPromotion(req, res, url, projectId);
  };
}

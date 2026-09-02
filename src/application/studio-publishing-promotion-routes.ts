import type { IncomingMessage, ServerResponse } from "node:http";
import { FileProjectStore } from "../infrastructure/file-project-store";
import { createStudioArchitectureAiRoutes } from "./studio-architecture-ai-routes";
import { createStudioImageLabRoutes } from "./studio-image-lab-routes";
import { createStudioMarketPromotionRoutes } from "./studio-market-promotion-routes";
import { createStudioPublishingRoutes } from "./studio-publishing-routes";

export type StudioPublishingPromotionRouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL, projectId: string) => Promise<boolean>;

/**
 * Mounted modular Studio routes. The historical function name is retained so the
 * server integration remains backward compatible while legacy inline endpoints
 * are migrated behind tested application boundaries one at a time.
 */
export function createStudioPublishingPromotionRoutes(store: FileProjectStore): StudioPublishingPromotionRouteHandler {
  const architectureAi = createStudioArchitectureAiRoutes(store);
  const imageLab = createStudioImageLabRoutes(store);
  const publishing = createStudioPublishingRoutes(store);
  const marketPromotion = createStudioMarketPromotionRoutes(store);

  return async (req, res, url, projectId) => {
    if (await architectureAi(req, res, url, projectId)) return true;
    if (await imageLab(req, res, url, projectId)) return true;
    if (await publishing(req, res, url, projectId)) return true;
    return marketPromotion(req, res, url, projectId);
  };
}

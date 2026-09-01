import type { IncomingMessage, ServerResponse } from "node:http";
import { FileProjectStore } from "../infrastructure/file-project-store";
import { createStudioImageLabRoutes } from "./studio-image-lab-routes";
import { createStudioMarketPromotionRoutes } from "./studio-market-promotion-routes";
import { createStudioPublishingRoutes } from "./studio-publishing-routes";

export type StudioPublishingPromotionRouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL, projectId: string) => Promise<boolean>;

export function createStudioPublishingPromotionRoutes(store: FileProjectStore): StudioPublishingPromotionRouteHandler {
  const imageLab = createStudioImageLabRoutes(store);
  const publishing = createStudioPublishingRoutes(store);
  const marketPromotion = createStudioMarketPromotionRoutes(store);

  return async (req, res, url, projectId) => {
    if (await imageLab(req, res, url, projectId)) return true;
    if (await publishing(req, res, url, projectId)) return true;
    return marketPromotion(req, res, url, projectId);
  };
}

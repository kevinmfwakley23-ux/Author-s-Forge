import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import { FileProjectStore } from "../infrastructure/file-project-store";
import { FileAiProposalStore } from "../infrastructure/file-ai-proposal-store";
import { FileForgeRecipeStore } from "../infrastructure/file-forge-recipe-store";
import { createStudioArchitectureAiRoutes } from "./studio-architecture-ai-routes";
import { createStudioAuthorCraftRoutes } from "./studio-author-craft-routes";
import { createStudioChapterCardWorkflowRoutes } from "./studio-chapter-card-workflow-routes";
import { createStudioForgeRecipeRoutes } from "./studio-forge-recipe-routes";
import { createStudioImageLabRoutes } from "./studio-image-lab-routes";
import { createStudioKnowledgeGapRoutes } from "./studio-knowledge-gap-routes";
import { createStudioLiveResearchRoutes } from "./studio-live-research-routes";
import { createStudioManuscriptImportRoutes } from "./studio-manuscript-import-routes";
import { createStudioMarketPromotionRoutes } from "./studio-market-promotion-routes";
import { createStudioPublishingRoutes } from "./studio-publishing-routes";
import { createStudioSceneCardWorkflowRoutes } from "./studio-scene-card-workflow-routes";
import { createStudioSeriesRoutes } from "./studio-series-routes";
import { createStudioStoryArchitectureRoutes } from "./studio-story-architecture-routes";
import { createStudioStoryMapRoutes } from "./studio-story-map-routes";

export type StudioPublishingPromotionRouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL, projectId: string) => Promise<boolean>;

/**
 * Modular Studio extension boundary. Historical name is retained to avoid
 * destabilizing the server entrypoint while architecture planning, author-craft,
 * reusable Forge Recipes, Chapter Card, Scene Card, manuscript intake, Series,
 * Story Map, research, image, publishing, market and promotion routes remain
 * independently implemented and testable.
 */
export function createStudioPublishingPromotionRoutes(store: FileProjectStore): StudioPublishingPromotionRouteHandler {
  const dataRoot = process.env.FORGE_DATA_DIR ?? join(process.cwd(), ".forge-data");
  const recipeStore = new FileForgeRecipeStore(join(dataRoot, "forge-recipes.json"));
  const sharedProposalStore = new FileAiProposalStore(join(dataRoot, "ai-proposals.json"));
  const storyArchitecture = createStudioStoryArchitectureRoutes(store);
  const architectureAi = createStudioArchitectureAiRoutes(store);
  const authorCraft = createStudioAuthorCraftRoutes(store);
  const forgeRecipes = createStudioForgeRecipeRoutes(store, recipeStore, sharedProposalStore);
  const chapterCards = createStudioChapterCardWorkflowRoutes(store);
  const sceneCards = createStudioSceneCardWorkflowRoutes(store);
  const manuscriptImport = createStudioManuscriptImportRoutes(store);
  const series = createStudioSeriesRoutes(store);
  const storyMap = createStudioStoryMapRoutes(store);
  const knowledgeGaps = createStudioKnowledgeGapRoutes(store);
  const liveResearch = createStudioLiveResearchRoutes(store);
  const imageLab = createStudioImageLabRoutes(store);
  const publishing = createStudioPublishingRoutes(store);
  const marketPromotion = createStudioMarketPromotionRoutes(store);

  return async (req, res, url, projectId) => {
    if (await storyArchitecture(req, res, url, projectId)) return true;
    if (await architectureAi(req, res, url, projectId)) return true;
    if (await authorCraft(req, res, url, projectId)) return true;
    if (await forgeRecipes(req, res, url, projectId)) return true;
    if (await chapterCards(req, res, url, projectId)) return true;
    if (await sceneCards(req, res, url, projectId)) return true;
    if (await manuscriptImport(req, res, url, projectId)) return true;
    if (await series(req, res, url, projectId)) return true;
    if (await storyMap(req, res, url, projectId)) return true;
    if (await knowledgeGaps(req, res, url, projectId)) return true;
    if (await liveResearch(req, res, url, projectId)) return true;
    if (await imageLab(req, res, url, projectId)) return true;
    if (await publishing(req, res, url, projectId)) return true;
    return marketPromotion(req, res, url, projectId);
  };
}

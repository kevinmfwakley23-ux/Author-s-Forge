import type { IncomingMessage, ServerResponse } from "node:http";
import { calculateMarketSampleStatistics, validateKdpMarketIntelligenceReport } from "../domain/kdp-market-intelligence";
import type { MarketingCampaign } from "../domain/marketing-campaign";
import { createPromotionReadinessReport } from "../domain/promotion-readiness";
import type { PromotionPerformanceMetrics, PromotionPerformanceSource } from "../domain/promotion-performance";
import { FileProjectStore } from "../infrastructure/file-project-store";
import { OpenAiWebKdpMarketIntelligenceProvider } from "../infrastructure/openai-kdp-market-intelligence-provider";
import { StudioKdpMarketResearchService } from "./studio-kdp-market-research";
import { StudioMarketingCampaignService } from "./studio-marketing-campaign";
import { StudioPromotionPerformanceService } from "./studio-promotion-performance";
import { StudioPromotionPlannerService } from "./studio-promotion-planner";
import { StudioPublishingMetadataService } from "./studio-publishing-metadata";

export type StudioMarketPromotionRouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL, projectId: string) => Promise<boolean>;

export function createStudioMarketPromotionRoutes(store: FileProjectStore): StudioMarketPromotionRouteHandler {
  const publishing = new StudioPublishingMetadataService(store);
  const campaigns = new StudioMarketingCampaignService(store);
  const promotionPlanner = new StudioPromotionPlannerService(store);
  const promotionPerformance = new StudioPromotionPerformanceService(store);

  return async (req, res, url, projectId) => {
    const root = `/api/projects/${projectId}`;

    if (url.pathname === `${root}/market-research` && req.method === "GET") {
      const project = await requireProject(store, projectId);
      const bookId = optionalText(url.searchParams.get("bookId"));
      const reports = (project.kdpMarketIntelligenceReports ?? [])
        .filter((report) => !bookId || report.bookId === bookId)
        .map(validateKdpMarketIntelligenceReport)
        .sort((a, b) => b.researchedAt.localeCompare(a.researchedAt))
        .map((report) => ({ report, statistics: calculateMarketSampleStatistics(report) }));
      respond(res, 200, { projectId, bookId, reports });
      return true;
    }
    if (url.pathname === `${root}/market-research` && req.method === "POST") {
      const input = await body(req);
      const service = new StudioKdpMarketResearchService(store, new OpenAiWebKdpMarketIntelligenceProvider());
      const report = await service.run(projectId, {
        bookId: optionalText(input.bookId),
        question: required(input.question, "Market research question"),
        market: required(input.market, "Market"),
        reportId: optionalText(input.reportId),
      });
      respond(res, 201, { report, statistics: calculateMarketSampleStatistics(report) });
      return true;
    }
    if (url.pathname === `${root}/market-research/apply-keywords` && req.method === "POST") {
      const input = await body(req);
      if (input.authorApproved !== true) throw new Error("Explicit author approval is required before applying researched keywords.");
      const project = await requireProject(store, projectId);
      const reportId = required(input.reportId, "Market research report id");
      const report = project.kdpMarketIntelligenceReports?.find((item) => item.id === reportId);
      if (!report) throw new Error(`Market research report "${reportId}" was not found.`);
      const result = await publishing.applyMarketKeywords(projectId, required(input.bookId, "Book id"), validateKdpMarketIntelligenceReport(report), {
        authorApproved: true,
        ...(input.phrases === undefined ? {} : { phrases: textArray(input.phrases, "Keyword phrase") }),
      });
      respond(res, 200, result);
      return true;
    }

    if (url.pathname === `${root}/promotion/campaigns` && req.method === "GET") {
      const bookId = required(url.searchParams.get("bookId"), "Book id");
      respond(res, 200, { projectId, bookId, campaigns: await campaigns.list(projectId, bookId) });
      return true;
    }
    if (url.pathname === `${root}/promotion/campaigns` && req.method === "POST") {
      const input = await body(req);
      const bookId = required(input.bookId, "Book id");
      respond(res, 201, await campaigns.save(projectId, bookId, objectValue(input.campaign, "Marketing campaign") as unknown as MarketingCampaign, { reference: "promotion-office" }));
      return true;
    }
    if (url.pathname === `${root}/promotion/generate` && req.method === "POST") {
      const input = await body(req);
      respond(res, 201, await promotionPlanner.generateCampaign(projectId, {
        bookId: required(input.bookId, "Book id"),
        objective: required(input.objective, "Promotion objective"),
        audience: required(input.audience, "Promotion audience"),
        readerPromise: required(input.readerPromise, "Reader promise"),
        channels: textArray(input.channels, "Promotion channel") as never,
        marketplace: optionalText(input.marketplace),
        launchDate: optionalText(input.launchDate),
        campaignId: optionalText(input.campaignId),
        marketResearchReportId: optionalText(input.marketResearchReportId),
      }));
      return true;
    }

    const assetAction = url.pathname.match(new RegExp(`^${escapeRegex(root)}/promotion/campaigns/([^/]+)/assets/([^/]+)/(approve|reject|schedule|publish)$`));
    if (assetAction && req.method === "POST") {
      const input = await body(req);
      const campaignId = decodeURIComponent(assetAction[1]);
      const assetId = decodeURIComponent(assetAction[2]);
      const action = assetAction[3];
      const bookId = required(input.bookId, "Book id");
      if (action === "approve") respond(res, 200, await campaigns.approveAsset(projectId, bookId, campaignId, assetId, optionalText(input.now)));
      else if (action === "reject") respond(res, 200, await campaigns.rejectAsset(projectId, bookId, campaignId, assetId, optionalText(input.now)));
      else if (action === "schedule") respond(res, 200, await campaigns.scheduleAsset(projectId, bookId, campaignId, assetId, required(input.when, "Schedule time"), optionalText(input.now)));
      else respond(res, 200, await campaigns.publishAsset(projectId, bookId, campaignId, assetId, { authorApproved: input.authorApproved === true, now: optionalText(input.now), externalReference: optionalText(input.externalReference) }));
      return true;
    }

    if (url.pathname === `${root}/promotion/readiness` && req.method === "GET") {
      const bookId = required(url.searchParams.get("bookId"), "Book id");
      const campaignId = required(url.searchParams.get("campaignId"), "Campaign id");
      const campaign = (await campaigns.get(projectId, bookId, campaignId)).campaign;
      respond(res, 200, createPromotionReadinessReport({ id: `promotion-readiness-${campaignId}`, projectId, bookId, campaign }));
      return true;
    }

    if (url.pathname === `${root}/promotion/performance` && req.method === "GET") {
      const bookId = required(url.searchParams.get("bookId"), "Book id");
      const campaignId = required(url.searchParams.get("campaignId"), "Campaign id");
      const assetId = optionalText(url.searchParams.get("assetId"));
      respond(res, 200, await promotionPerformance.summary(projectId, bookId, campaignId, assetId));
      return true;
    }
    if (url.pathname === `${root}/promotion/performance` && req.method === "POST") {
      const input = await body(req);
      const bookId = required(input.bookId, "Book id");
      const campaignId = required(input.campaignId, "Campaign id");
      const metrics = objectValue(input.metrics, "Promotion performance metrics") as unknown as PromotionPerformanceMetrics;
      const state = await promotionPerformance.record(projectId, bookId, campaignId, {
        id: optionalText(input.id),
        assetId: optionalText(input.assetId),
        source: required(input.source, "Promotion performance source") as PromotionPerformanceSource,
        periodStart: required(input.periodStart, "Promotion performance period start"),
        periodEnd: required(input.periodEnd, "Promotion performance period end"),
        observedAt: optionalText(input.observedAt) ?? new Date().toISOString(),
        currency: optionalText(input.currency),
        sourceReference: required(input.sourceReference, "Promotion performance source reference"),
        sourceUrl: optionalText(input.sourceUrl),
        notes: optionalText(input.notes),
        metrics,
      });
      respond(res, 201, state);
      return true;
    }

    return false;
  };
}

async function requireProject(store: FileProjectStore, projectId: string) {
  const project = await store.load(projectId);
  if (!project) throw new Error(`Project "${projectId}" was not found.`);
  return project;
}
async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of req) raw += String(chunk);
  if (raw.length > 8 * 1024 * 1024) throw new Error("Request body exceeds 8 MiB limit.");
  if (!raw.trim()) return {};
  return objectValue(JSON.parse(raw), "JSON body");
}
function respond(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(JSON.stringify(value));
}
function objectValue(value: unknown, label: string): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`); return value as Record<string, unknown>; }
function required(value: unknown, label: string): string { if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`); return value.trim(); }
function optionalText(value: unknown): string | undefined { return typeof value === "string" && value.trim() ? value.trim() : undefined; }
function textArray(value: unknown, label: string): string[] { if (!Array.isArray(value)) throw new Error(`${label} values must be an array.`); return [...new Set(value.map((item) => required(item, label)))]; }
function escapeRegex(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

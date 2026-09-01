import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createKdpMarketIntelligenceReport, calculateMarketSampleStatistics, validateKdpMarketIntelligenceReport } from "../domain/kdp-market-intelligence";
import { createPromotionReadinessReport } from "../domain/promotion-readiness";
import { createPublishingReadinessReport, type PublishingReadinessInput } from "../domain/publishing-readiness";
import { createReleaseGateReport } from "../domain/release-gate";
import { withProjectPublishingReadinessReports } from "../domain/project";
import { getBook, validateStudioWorkspace } from "../domain/studio-workspace";
import { FileProjectStore } from "../infrastructure/file-project-store";
import { OpenAiWebKdpMarketIntelligenceProvider } from "../infrastructure/openai-kdp-market-intelligence-provider";
import type { MarketingCampaign } from "../domain/marketing-campaign";
import type { PublishingMetadata } from "../domain/publishing-metadata";
import { StudioKdpMarketResearchService } from "./studio-kdp-market-research";
import { StudioMarketingCampaignService } from "./studio-marketing-campaign";
import { StudioPromotionPlannerService } from "./studio-promotion-planner";
import { StudioPublishingMetadataService } from "./studio-publishing-metadata";

export type StudioPublishingPromotionRouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL, projectId: string) => Promise<boolean>;

export function createStudioPublishingPromotionRoutes(store: FileProjectStore): StudioPublishingPromotionRouteHandler {
  const publishing = new StudioPublishingMetadataService(store);
  const campaigns = new StudioMarketingCampaignService(store);
  const promotionPlanner = new StudioPromotionPlannerService(store);

  return async (req, res, url, projectId) => {
    const root = `/api/projects/${projectId}`;

    if (url.pathname === `${root}/publishing/metadata` && req.method === "GET") {
      const bookId = required(url.searchParams.get("bookId"), "Book id");
      respond(res, 200, await publishing.get(projectId, bookId));
      return true;
    }
    if (url.pathname === `${root}/publishing/metadata` && req.method === "POST") {
      const input = await body(req);
      const bookId = required(input.bookId, "Book id");
      const metadata = objectValue(input.metadata, "Publishing metadata");
      const editable = stripPublishingEnvelope(metadata) as Omit<PublishingMetadata, "formatVersion" | "projectId" | "bookId" | "updatedAt">;
      respond(res, 201, await publishing.save(projectId, bookId, editable, { reference: "publishing-office" }));
      return true;
    }

    if (url.pathname === `${root}/publishing/readiness` && req.method === "GET") {
      const bookId = required(url.searchParams.get("bookId"), "Book id");
      const project = await requireProject(store, projectId);
      const reports = (project.publishingReadinessReports ?? []).filter((report) => report.bookId === bookId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      respond(res, 200, { projectId, bookId, reports });
      return true;
    }
    if (url.pathname === `${root}/publishing/readiness` && req.method === "POST") {
      const input = await body(req);
      const bookId = required(input.bookId, "Book id");
      const project = await requireProject(store, projectId);
      const workspace = requireWorkspace(project);
      const book = getBook(workspace, bookId);
      const currentMetadata = await publishing.get(projectId, bookId);
      if (!currentMetadata) throw new Error("Save Publishing metadata before running Publishing readiness.");
      const evidence = input.evidence === undefined ? {} : objectValue(input.evidence, "Publishing readiness evidence");
      const manuscriptEvidence = evidence.manuscript === undefined ? {} : objectValue(evidence.manuscript, "Manuscript readiness evidence");
      const coverEvidence = evidence.cover === undefined ? {} : objectValue(evidence.cover, "Cover readiness evidence");
      const latestCover = [...(project.bookCoverPlans ?? [])].filter((plan) => plan.bookId === bookId).sort((a, b) => b.version - a.version)[0];
      const report = createPublishingReadinessReport({
        id: typeof input.id === "string" && input.id.trim() ? input.id.trim() : `publishing-readiness-${bookId}-${randomUUID()}`,
        projectId,
        bookId,
        now: typeof input.now === "string" ? input.now : undefined,
        manuscript: {
          title: book.title,
          author: currentMetadata.metadata.author,
          chapters: book.chapters.map((chapter) => ({ title: chapter.title, number: chapter.number })),
          ...(manuscriptEvidence as PublishingReadinessInput["manuscript"]),
        },
        cover: {
          ...(latestCover ? {
            format: latestCover.format,
            widthInches: latestCover.dimensions.widthInches,
            heightInches: latestCover.dimensions.heightInches,
            hasBarcodeSafeArea: Boolean(latestCover.zones.barcodeSafeArea),
            hasBleed: latestCover.publishing.bleedInches > 0,
            hasTrim: true,
            hasSafeMargins: latestCover.zones.safeMarginInches > 0,
            validated: latestCover.approvalStatus === "approved" && Boolean(latestCover.outputUri),
            fileType: latestCover.outputUri ? latestCover.outputFormat : undefined,
            hasFront: Boolean(latestCover.outputUri),
            hasBack: latestCover.format === "ebook" ? true : Boolean(latestCover.outputUri),
            hasSpine: latestCover.format === "ebook" ? true : Boolean(latestCover.outputUri),
          } : {}),
          ...(coverEvidence as PublishingReadinessInput["cover"]),
        },
        metadata: {
          title: currentMetadata.metadata.title,
          author: currentMetadata.metadata.author,
          description: currentMetadata.metadata.description,
          keywords: currentMetadata.metadata.keywords,
          categories: currentMetadata.metadata.categories,
        },
        formatting: evidence.formatting as PublishingReadinessInput["formatting"],
        images: evidence.images as PublishingReadinessInput["images"],
        production: evidence.production as PublishingReadinessInput["production"],
      });
      await store.save(withProjectPublishingReadinessReports(project, [...(project.publishingReadinessReports ?? []), report], report.createdAt));
      respond(res, 201, report);
      return true;
    }

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

    if (url.pathname === `${root}/release-gate` && req.method === "GET") {
      const bookId = required(url.searchParams.get("bookId"), "Book id");
      const campaignId = optionalText(url.searchParams.get("campaignId"));
      const project = await requireProject(store, projectId);
      const publishingReadiness = (project.publishingReadinessReports ?? []).filter((report) => report.bookId === bookId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      if (!publishingReadiness) throw new Error("Run Publishing readiness for this book before checking the release gate.");
      const campaign = campaignId ? (await campaigns.get(projectId, bookId, campaignId)).campaign : undefined;
      const promotionReadiness = campaign ? createPromotionReadinessReport({ id: `promotion-readiness-${campaign.id}`, projectId, bookId, campaign }) : undefined;
      respond(res, 200, createReleaseGateReport({ id: `release-${bookId}-${randomUUID()}`, projectId, bookId, publishingReadiness, promotionRequired: true, promotionReadiness, marketingCampaign: campaign }));
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
function requireWorkspace(project: Awaited<ReturnType<FileProjectStore["load"]>>) {
  if (!project?.studioWorkspace) throw new Error("Project has no Studio workspace.");
  return validateStudioWorkspace(project.studioWorkspace);
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
function stripPublishingEnvelope(value: Record<string, unknown>): Record<string, unknown> {
  const { formatVersion: _formatVersion, projectId: _projectId, bookId: _bookId, updatedAt: _updatedAt, ...editable } = value;
  return editable;
}
function objectValue(value: unknown, label: string): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`); return value as Record<string, unknown>; }
function required(value: unknown, label: string): string { if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`); return value.trim(); }
function optionalText(value: unknown): string | undefined { return typeof value === "string" && value.trim() ? value.trim() : undefined; }
function textArray(value: unknown, label: string): string[] { if (!Array.isArray(value)) throw new Error(`${label} values must be an array.`); return [...new Set(value.map((item) => required(item, label)))]; }
function escapeRegex(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

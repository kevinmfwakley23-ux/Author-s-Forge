import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createPromotionReadinessReport } from "../domain/promotion-readiness";
import { createPublishingReadinessReport, type PublishingReadinessInput, type PublishingReleaseFormat } from "../domain/publishing-readiness";
import { createReleaseGateReport } from "../domain/release-gate";
import { withProjectPublishingReadinessReports } from "../domain/project";
import { getBook, validateStudioWorkspace } from "../domain/studio-workspace";
import type { PublishingMetadata } from "../domain/publishing-metadata";
import { FileProjectStore } from "../infrastructure/file-project-store";
import { StudioMarketingCampaignService } from "./studio-marketing-campaign";
import { StudioPublishingMetadataService } from "./studio-publishing-metadata";

export type StudioPublishingRouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL, projectId: string) => Promise<boolean>;
const RELEASE_FORMATS: readonly PublishingReleaseFormat[] = ["ebook", "paperback", "hardcover"];

export function createStudioPublishingRoutes(store: FileProjectStore): StudioPublishingRouteHandler {
  const publishing = new StudioPublishingMetadataService(store);
  const campaigns = new StudioMarketingCampaignService(store);

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
      const format = optionalReleaseFormat(url.searchParams.get("format"));
      const project = await requireProject(store, projectId);
      const reports = (project.publishingReadinessReports ?? [])
        .filter((report) => report.bookId === bookId && (!format || report.releaseFormat === format))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      respond(res, 200, { projectId, bookId, format, reports });
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
      const imageEvidence = evidence.images === undefined ? {} : objectValue(evidence.images, "Image readiness evidence");
      const requestedFormat = releaseFormat(input.releaseFormat ?? coverEvidence.format ?? currentMetadata.metadata.formats[0], "Release format");
      if (!currentMetadata.metadata.formats.includes(requestedFormat)) throw new Error(`Publishing metadata does not enable the ${requestedFormat} release format.`);
      const latestCover = [...(project.bookCoverPlans ?? [])]
        .filter((plan) => plan.bookId === bookId && plan.format === requestedFormat)
        .sort((a, b) => b.version - a.version || b.updatedAt.localeCompare(a.updatedAt))[0];
      const bookAssets = (project.illustrationAssetLibrary?.assets ?? []).filter((asset) => asset.bookId === bookId);
      const defaultImagesRequired = book.kind === "childrens-book" || book.kind === "comic-book" || bookAssets.length > 0;
      const imagesRequired = imageEvidence.required === undefined ? defaultImagesRequired : imageEvidence.required === true;
      const report = createPublishingReadinessReport({
        id: optionalText(input.id) ?? `publishing-readiness-${bookId}-${requestedFormat}-${randomUUID()}`,
        projectId,
        bookId,
        releaseFormat: requestedFormat,
        now: optionalText(input.now),
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
          format: requestedFormat,
        },
        metadata: {
          title: currentMetadata.metadata.title,
          author: currentMetadata.metadata.author,
          description: currentMetadata.metadata.description,
          keywords: currentMetadata.metadata.keywords,
          categories: currentMetadata.metadata.categories,
        },
        formatting: evidence.formatting as PublishingReadinessInput["formatting"],
        images: {
          required: imagesRequired,
          count: bookAssets.length,
          allResolved: bookAssets.length > 0 && bookAssets.every((asset) => typeof asset.assetUri === "string" && asset.assetUri.trim().length > 0),
          allApproved: bookAssets.length > 0 && bookAssets.every((asset) => asset.approvalStatus === "approved"),
          resolutionValidated: imageEvidence.resolutionValidated === true,
        },
        production: evidence.production as PublishingReadinessInput["production"],
      });
      const persistenceNow = latestTimestamp(project.metadata.createdAt, project.metadata.updatedAt, report.createdAt);
      await store.save(withProjectPublishingReadinessReports(project, [...(project.publishingReadinessReports ?? []), report], persistenceNow));
      respond(res, 201, report);
      return true;
    }

    if (url.pathname === `${root}/release-gate` && req.method === "GET") {
      const bookId = required(url.searchParams.get("bookId"), "Book id");
      const format = optionalReleaseFormat(url.searchParams.get("format"));
      const campaignId = optionalText(url.searchParams.get("campaignId"));
      const project = await requireProject(store, projectId);
      const publishingReadiness = (project.publishingReadinessReports ?? [])
        .filter((report) => report.bookId === bookId && (!format || report.releaseFormat === format))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      if (!publishingReadiness) throw new Error(`Run Publishing readiness for this book${format ? ` and ${format} format` : ""} before checking the release gate.`);
      const auditedFormat = publishingReadiness.releaseFormat;
      const currentMetadata = await publishing.get(projectId, bookId);
      const matchingCover = [...(project.bookCoverPlans ?? [])]
        .filter((plan) => plan.bookId === bookId && plan.format === auditedFormat)
        .sort((a, b) => b.version - a.version || b.updatedAt.localeCompare(a.updatedAt))[0];
      const staleReasons: string[] = [];
      if (!currentMetadata) staleReasons.push("Publishing metadata is no longer available");
      else if (Date.parse(currentMetadata.metadata.updatedAt) > Date.parse(publishingReadiness.createdAt)) staleReasons.push("Publishing metadata changed after the readiness audit");
      if (matchingCover && Date.parse(matchingCover.updatedAt) > Date.parse(publishingReadiness.createdAt)) staleReasons.push(`the ${auditedFormat} cover changed after the readiness audit`);
      const campaign = campaignId ? (await campaigns.get(projectId, bookId, campaignId)).campaign : undefined;
      const promotionReadiness = campaign ? createPromotionReadinessReport({ id: `promotion-readiness-${campaign.id}`, projectId, bookId, campaign }) : undefined;
      respond(res, 200, createReleaseGateReport({
        id: `release-${bookId}-${auditedFormat}-${randomUUID()}`,
        projectId,
        bookId,
        publishingReadiness,
        publishingReadinessCurrent: staleReasons.length === 0,
        publishingReadinessStaleReasons: staleReasons,
        promotionRequired: true,
        promotionReadiness,
        marketingCampaign: campaign,
      }));
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
function releaseFormat(value: unknown, label: string): PublishingReleaseFormat { const format = required(value, label) as PublishingReleaseFormat; if (!RELEASE_FORMATS.includes(format)) throw new Error(`${label} must be ebook, paperback, or hardcover.`); return format; }
function optionalReleaseFormat(value: unknown): PublishingReleaseFormat | undefined { return value === undefined || value === null || value === "" ? undefined : releaseFormat(value, "Release format"); }
function latestTimestamp(...values: string[]): string {
  let latest = 0;
  for (const value of values) {
    const time = Date.parse(value);
    if (!Number.isFinite(time)) throw new Error("Project persistence timestamp must be valid.");
    latest = Math.max(latest, time);
  }
  return new Date(latest).toISOString();
}

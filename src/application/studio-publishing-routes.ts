import { createHash, randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { coverPlanSha256, type CoverArtifactVerification } from "../domain/cover-artifact-evidence";
import type { BookCoverPlan } from "../domain/book-cover-studio";
import { createPromotionReadinessReport } from "../domain/promotion-readiness";
import { createPublishingReadinessReport, type PublishingReadinessInput, type PublishingReleaseFormat } from "../domain/publishing-readiness";
import { createReleaseGateReport } from "../domain/release-gate";
import { withProjectPublishingReadinessReports, type ProjectState } from "../domain/project";
import { getBook, validateStudioWorkspace } from "../domain/studio-workspace";
import { productionSourceSha256, type ProductionArtifactEvidence, type ProductionArtifactVerification } from "../domain/production-artifact-evidence";
import type { ProductionFormat, ProductionManuscript, ProductionOptions } from "../domain/manuscript-production";
import type { PublishingMetadata } from "../domain/publishing-metadata";
import { FileCoverArtifactVault } from "../infrastructure/file-cover-artifact-vault";
import { FileProjectStore } from "../infrastructure/file-project-store";
import { FileProductionArtifactVault } from "../infrastructure/file-production-artifact-vault";
import { StudioMarketingCampaignService } from "./studio-marketing-campaign";
import { StudioPublishingMetadataService } from "./studio-publishing-metadata";

export type StudioPublishingRouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL, projectId: string) => Promise<boolean>;
const RELEASE_FORMATS: readonly PublishingReleaseFormat[] = ["ebook", "paperback", "hardcover"];

type WorkspaceBook = ReturnType<typeof getBook>;

export function createStudioPublishingRoutes(
  store: FileProjectStore,
  productionArtifacts: FileProductionArtifactVault,
  coverArtifacts: FileCoverArtifactVault,
): StudioPublishingRouteHandler {
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
      const formattingEvidence = evidence.formatting === undefined ? {} : objectValue(evidence.formatting, "Formatting readiness evidence");
      const requestedFormat = releaseFormat(input.releaseFormat ?? currentMetadata.metadata.formats[0], "Release format");
      if (!currentMetadata.metadata.formats.includes(requestedFormat)) throw new Error(`Publishing metadata does not enable the ${requestedFormat} release format.`);
      const latestCover = latestCoverPlan(project, bookId, requestedFormat);
      const coverArtifact = latestCover
        ? await latestCurrentCoverArtifact(coverArtifacts, project, latestCover, requestedFormat)
        : undefined;
      const coverEvidence = coverArtifact?.evidence;
      const interiorAssets = (project.illustrationAssetLibrary?.assets ?? []).filter((asset) =>
        asset.bookId === bookId && asset.generationSettings?.purpose === "illustration",
      );
      const imagesRequired = book.kind === "childrens-book" || book.kind === "comic-book" || interiorAssets.length > 0;
      const imageResolutionValidated = !imagesRequired || (interiorAssets.length > 0 && interiorAssets.every((asset) => {
        const dpi = asset.generationSettings?.dpi;
        return typeof dpi === "number" && Number.isFinite(dpi) && dpi >= 300;
      }));
      const productionArtifact = await latestCurrentProductionArtifact(
        productionArtifacts,
        projectId,
        book,
        currentMetadata.metadata.author,
        productionFormatsForRelease(requestedFormat),
      );
      const artifact = productionArtifact?.evidence;
      const artifactFileType = artifact ? baseProductionFileType(artifact.format) : undefined;
      const print = requestedFormat === "paperback" || requestedFormat === "hardcover";
      const printTrimValidated = !print || Boolean(artifact && latestCover && artifactTrimMatchesCover(artifact, latestCover.publishing.trimWidthInches, latestCover.publishing.trimHeightInches));
      const rendererContainsAllRequiredImages = !imagesRequired;
      const finalProductionValidated = Boolean(productionArtifact?.valid) && rendererContainsAllRequiredImages;
      const finalCoverValidated = Boolean(coverArtifact?.valid) && latestCover?.approvalStatus === "approved";
      const report = createPublishingReadinessReport({
        id: optionalText(input.id) ?? `publishing-readiness-${bookId}-${requestedFormat}-${randomUUID()}`,
        projectId,
        bookId,
        releaseFormat: requestedFormat,
        manuscript: {
          ...(manuscriptEvidence as PublishingReadinessInput["manuscript"]),
          title: book.title,
          author: currentMetadata.metadata.author,
          chapters: book.chapters.map((chapter) => ({ title: chapter.title, number: chapter.number })),
          hasTitlePage: Boolean(artifact?.options.includeTitlePage),
          hasCopyrightPage: Boolean(artifact),
          hasTableOfContents: Boolean(artifact?.options.includeToc),
          tableOfContentsRequired: true,
          pageCount: print ? latestCover?.publishing.pageCount : undefined,
        },
        cover: {
          ...(latestCover ? {
            widthInches: coverEvidence?.widthInches ?? latestCover.dimensions.widthInches,
            heightInches: coverEvidence?.heightInches ?? latestCover.dimensions.heightInches,
            hasBarcodeSafeArea: requestedFormat === "ebook" ? true : Boolean(coverEvidence && latestCover.zones.barcodeSafeArea),
            hasBleed: requestedFormat === "ebook" ? true : Boolean(coverEvidence && latestCover.publishing.bleedInches > 0),
            hasTrim: requestedFormat === "ebook" ? true : Boolean(coverEvidence),
            hasSafeMargins: requestedFormat === "ebook" ? true : Boolean(coverEvidence && latestCover.zones.safeMarginInches > 0),
            validated: finalCoverValidated,
            fileType: coverEvidence?.fileFormat,
            hasFront: Boolean(coverEvidence),
            hasBack: requestedFormat === "ebook" ? true : Boolean(coverEvidence),
            hasSpine: requestedFormat === "ebook" ? true : Boolean(coverEvidence),
          } : {}),
          format: requestedFormat,
        },
        metadata: {
          title: currentMetadata.metadata.title,
          author: currentMetadata.metadata.author,
          description: currentMetadata.metadata.description,
          keywords: currentMetadata.metadata.keywords,
          categories: currentMetadata.metadata.categories,
        },
        formatting: {
          fileTypes: artifactFileType ? [artifactFileType] : [],
          validated: finalProductionValidated,
          pageNumbering: requestedFormat === "ebook" ? true : Boolean(artifact?.options.pageNumbers),
          headersFooters: requestedFormat === "ebook" ? true : formattingEvidence.headersFooters === true,
        },
        images: {
          required: imagesRequired,
          count: interiorAssets.length,
          allResolved: interiorAssets.length > 0 && interiorAssets.every((asset) => typeof asset.assetUri === "string" && asset.assetUri.trim().length > 0),
          allApproved: interiorAssets.length > 0 && interiorAssets.every((asset) => asset.approvalStatus === "approved"),
          resolutionValidated: imageResolutionValidated,
        },
        production: {
          trim: requestedFormat === "ebook" ? true : printTrimValidated,
          bleed: requestedFormat === "ebook" ? true : !imagesRequired,
          fileTypes: artifactFileType ? [artifactFileType] : [],
          validated: finalProductionValidated,
        },
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
      const matchingCover = auditedFormat ? latestCoverPlan(project, bookId, auditedFormat) : undefined;
      const staleReasons: string[] = [];
      if (!currentMetadata) staleReasons.push("Publishing metadata is no longer available");
      else if (Date.parse(currentMetadata.metadata.updatedAt) > Date.parse(publishingReadiness.createdAt)) staleReasons.push("Publishing metadata changed after the readiness audit");
      if (matchingCover && Date.parse(matchingCover.updatedAt) > Date.parse(publishingReadiness.createdAt)) staleReasons.push(`the ${auditedFormat} cover plan changed after the readiness audit`);
      if (auditedFormat) {
        if (!matchingCover) {
          staleReasons.push(`no ${auditedFormat} Cover Studio plan is currently available`);
        } else {
          const currentCoverArtifact = await latestCurrentCoverArtifact(coverArtifacts, project, matchingCover, auditedFormat);
          if (!currentCoverArtifact) staleReasons.push(`no verified ${auditedFormat} cover artifact matches the current Cover Studio plan and approved artwork`);
          else if (Date.parse(currentCoverArtifact.evidence.generatedAt) > Date.parse(publishingReadiness.createdAt)) staleReasons.push(`the ${auditedFormat} cover artifact changed after the readiness audit`);
        }
      }
      if (currentMetadata && auditedFormat) {
        const workspace = requireWorkspace(project);
        const book = getBook(workspace, bookId);
        const currentArtifact = await latestCurrentProductionArtifact(
          productionArtifacts,
          projectId,
          book,
          currentMetadata.metadata.author,
          productionFormatsForRelease(auditedFormat),
        );
        if (!currentArtifact) staleReasons.push(`no verified ${auditedFormat} production artifact matches the current manuscript and production settings`);
      }
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

async function latestCurrentProductionArtifact(
  vault: FileProductionArtifactVault,
  projectId: string,
  book: WorkspaceBook,
  author: string,
  formats: readonly ProductionFormat[],
): Promise<ProductionArtifactVerification | undefined> {
  const records = await vault.list(projectId, { bookId: book.id, formats });
  for (const record of records) {
    const verification = await vault.verify(record);
    if (!verification.valid) continue;
    const options = productionOptionsFromEvidence(record);
    const manuscript = productionManuscript(projectId, book, author);
    if (productionSourceSha256(manuscript, options) === record.sourceSha256) return verification;
  }
  return undefined;
}

async function latestCurrentCoverArtifact(
  vault: FileCoverArtifactVault,
  project: ProjectState,
  plan: BookCoverPlan,
  format: PublishingReleaseFormat,
): Promise<CoverArtifactVerification | undefined> {
  const records = await vault.list(project.metadata.id, { bookId: plan.bookId, planId: plan.id });
  const currentPlanSha256 = coverPlanSha256(plan);
  for (const record of records) {
    if (record.coverFormat !== format || record.planVersion !== plan.version || record.planSha256 !== currentPlanSha256) continue;
    const sourceAsset = project.illustrationAssetLibrary?.assets.find((asset) => asset.id === record.sourceAssetId && asset.bookId === plan.bookId);
    if (!sourceAsset || sourceAsset.approvalStatus !== "approved" || sourceAsset.generationSettings?.purpose !== "cover-art") continue;
    const sourceSha256 = embeddedAssetSha256(sourceAsset.assetUri);
    if (!sourceSha256 || sourceSha256 !== record.sourceAssetSha256) continue;
    const verification = await vault.verify(record);
    if (verification.valid) return verification;
  }
  return undefined;
}

function latestCoverPlan(project: ProjectState, bookId: string, format: PublishingReleaseFormat): BookCoverPlan | undefined {
  return [...(project.bookCoverPlans ?? [])]
    .filter((plan) => plan.bookId === bookId && plan.format === format)
    .sort((a, b) => b.version - a.version || b.updatedAt.localeCompare(a.updatedAt))[0];
}

function embeddedAssetSha256(uri: string): string | undefined {
  const match = uri.match(/^data:image\/(?:png|jpeg|jpg);base64,([A-Za-z0-9+/=\r\n]+)$/i);
  if (!match) return undefined;
  const bytes = Buffer.from(match[1].replace(/\s+/g, ""), "base64");
  if (!bytes.length) return undefined;
  return createHash("sha256").update(bytes).digest("hex");
}

function productionManuscript(projectId: string, book: WorkspaceBook, author: string): ProductionManuscript {
  return {
    projectId,
    bookId: book.id,
    title: book.title,
    author,
    chapters: book.chapters.map((chapter) => ({
      id: chapter.id,
      number: chapter.number,
      title: chapter.title,
      scenes: chapter.scenes.map((scene) => ({ id: scene.id, title: scene.title, body: scene.content })),
    })),
    frontMatter: [],
    backMatter: [],
  };
}
function productionOptionsFromEvidence(record: ProductionArtifactEvidence): ProductionOptions {
  return {
    format: record.format,
    pageSize: record.options.pageSize,
    pageNumbers: record.options.pageNumbers,
    includeTitlePage: record.options.includeTitlePage,
    includeToc: record.options.includeToc,
    ...(record.options.runningHeader ? { runningHeader: record.options.runningHeader } : {}),
    ...(record.options.runningFooter ? { runningFooter: record.options.runningFooter } : {}),
  };
}
function artifactTrimMatchesCover(record: ProductionArtifactEvidence, trimWidthInches: number, trimHeightInches: number): boolean {
  const sizes: Record<ProductionArtifactEvidence["options"]["pageSize"], readonly [number, number]> = {
    letter: [8.5, 11],
    a4: [8.2677165354, 11.6929133858],
    "6x9": [6, 9],
    "5x8": [5, 8],
  };
  const [width, height] = sizes[record.options.pageSize];
  return Math.abs(width - trimWidthInches) < 0.001 && Math.abs(height - trimHeightInches) < 0.001;
}
function productionFormatsForRelease(format: PublishingReleaseFormat): readonly ProductionFormat[] {
  if (format === "ebook") return ["epub", "kdp-epub"];
  return ["pdf", "kdp-pdf", "docx", "kdp-docx"];
}
function baseProductionFileType(format: ProductionFormat): "docx" | "pdf" | "epub" {
  if (format.endsWith("docx")) return "docx";
  if (format.endsWith("pdf")) return "pdf";
  return "epub";
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

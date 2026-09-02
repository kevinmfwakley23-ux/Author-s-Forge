import type { IncomingMessage, ServerResponse } from "node:http";
import type { FileProjectStore } from "../infrastructure/file-project-store";
import { StudioImageLabService, type StudioImagePurpose, type StudioImageRightsDeclarationInput } from "./studio-image-lab";
import type { ImageGenerationQuality, ImageGenerationSize } from "../infrastructure/image-provider";
import type { AssetRightsBasis, ModelReleaseStatus } from "../domain/asset-rights-provenance";

export type StudioImageLabRouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL, projectId: string) => Promise<boolean>;

export function createStudioImageLabRoutes(store: FileProjectStore): StudioImageLabRouteHandler {
  const service = new StudioImageLabService(store);
  return async (req, res, url, projectId) => {
    if (url.pathname === `/api/projects/${projectId}/ai/images` && req.method === "GET") {
      const [assets, rightsRecords] = await Promise.all([service.list(projectId), service.rights(projectId)]);
      json(res, 200, { assets, rightsRecords });
      return true;
    }
    if (url.pathname === `/api/projects/${projectId}/ai/image` && req.method === "POST") {
      const input = await body(req);
      const result = await service.generate({
        projectId,
        prompt: String(input.prompt ?? ""),
        style: input.style === undefined ? undefined : String(input.style),
        purpose: input.purpose === undefined ? undefined : String(input.purpose) as StudioImagePurpose,
        size: input.size === undefined ? undefined : String(input.size) as ImageGenerationSize,
        quality: input.quality === undefined ? undefined : String(input.quality) as ImageGenerationQuality,
        referenceImage: input.referenceImage === undefined ? undefined : String(input.referenceImage),
        referenceLabel: input.referenceLabel === undefined ? undefined : String(input.referenceLabel),
        sourceAssetId: input.sourceAssetId === undefined ? undefined : String(input.sourceAssetId),
        referenceRights: input.referenceRights === undefined ? undefined : rightsDeclaration(input.referenceRights),
        externalProcessingConsent: input.externalProcessingConsent === true,
        characterId: input.characterId === undefined ? undefined : String(input.characterId),
        locationId: input.locationId === undefined ? undefined : String(input.locationId),
      });
      json(res, 201, {
        asset: result.asset,
        ...(result.sourceAsset ? { sourceAsset: result.sourceAsset } : {}),
        assetProvenance: result.assetProvenance,
        ...(result.sourceDeclaration ? { sourceDeclaration: result.sourceDeclaration } : {}),
        ...(result.processingConsent ? { processingConsent: result.processingConsent } : {}),
        provider: result.provider,
        model: result.model,
        ...(result.requestId ? { requestId: result.requestId } : {}),
        url: result.url,
      });
      return true;
    }
    const review = url.pathname.match(new RegExp(`^/api/projects/${projectId}/ai/images/([A-Za-z0-9_-]+)/review$`));
    if (review && req.method === "POST") {
      const input = await body(req);
      const decision = input.decision === "approved" || input.decision === "rejected" ? input.decision : undefined;
      if (!decision) throw new Error("Image review decision must be approved or rejected.");
      const result = await service.review({ projectId, assetId: review[1], decision });
      json(res, 200, result.asset);
      return true;
    }
    const rights = url.pathname.match(new RegExp(`^/api/projects/${projectId}/ai/images/([A-Za-z0-9_-]+)/rights$`));
    if (rights && req.method === "POST") {
      const input = await body(req);
      const result = await service.declareRights({ projectId, assetId: rights[1], declaration: rightsDeclaration(input) });
      json(res, 201, result.record);
      return true;
    }
    return false;
  };
}

function rightsDeclaration(value: unknown): StudioImageRightsDeclarationInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Image rights declaration must be an object.");
  const input = value as Record<string, unknown>;
  return {
    rightsBasis: String(input.rightsBasis ?? "unknown") as AssetRightsBasis,
    authorDeclaresPublicationClearance: input.authorDeclaresPublicationClearance === true,
    containsRealPerson: input.containsRealPerson === true,
    modelReleaseStatus: input.modelReleaseStatus === undefined ? undefined : String(input.modelReleaseStatus) as ModelReleaseStatus,
    containsTrademark: input.containsTrademark === true,
    sourceReference: input.sourceReference === undefined ? undefined : String(input.sourceReference),
    licenseUrl: input.licenseUrl === undefined ? undefined : String(input.licenseUrl),
    rightsUsageTerms: input.rightsUsageTerms === undefined ? undefined : String(input.rightsUsageTerms),
    notes: input.notes === undefined ? undefined : String(input.notes),
  };
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of req) {
    raw += String(chunk);
    if (raw.length > 8 * 1024 * 1024) throw new Error("Image Lab request body exceeds 8 MiB limit.");
  }
  if (!raw.trim()) return {};
  const value = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Image Lab JSON object body required.");
  return value as Record<string, unknown>;
}
function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(JSON.stringify(value));
}

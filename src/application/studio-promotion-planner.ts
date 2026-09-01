import { randomUUID } from "node:crypto";
import type { AiGenerationRequest, AiGenerationResult } from "../infrastructure/ai-provider";
import { generateText } from "../infrastructure/ai-provider";
import { assessMarketingAssetCompliance, createMarketingCampaign, MARKETING_ASSET_KINDS, MARKETING_CHANNELS, type MarketingAsset, type MarketingAssetKind, type MarketingCampaign, type MarketingChannel } from "../domain/marketing-campaign";
import { validateKdpMarketIntelligenceReport, type KdpMarketIntelligenceReport } from "../domain/kdp-market-intelligence";
import { getBook, validateStudioWorkspace } from "../domain/studio-workspace";
import { FileProjectStore } from "../infrastructure/file-project-store";
import { StudioPublishingMetadataService } from "./studio-publishing-metadata";
import { StudioMarketingCampaignService, type MarketingCampaignState } from "./studio-marketing-campaign";

export type PromotionTextGenerator = (request: AiGenerationRequest) => Promise<AiGenerationResult>;

export interface GeneratePromotionCampaignInput {
  readonly bookId: string;
  readonly objective: string;
  readonly audience: string;
  readonly readerPromise: string;
  readonly channels: readonly MarketingChannel[];
  readonly marketplace?: string;
  readonly launchDate?: string;
  readonly campaignId?: string;
  readonly marketResearchReportId?: string;
  readonly now?: string;
}

export interface GeneratedPromotionCampaign extends MarketingCampaignState {
  readonly provider: AiGenerationResult["provider"];
  readonly model: string;
  readonly requestId?: string;
  readonly complianceIssues: readonly { readonly assetId: string; readonly issues: ReturnType<typeof assessMarketingAssetCompliance> }[];
}

export class StudioPromotionPlannerService {
  private readonly publishing: StudioPublishingMetadataService;
  private readonly campaigns: StudioMarketingCampaignService;

  public constructor(
    private readonly store: FileProjectStore,
    private readonly generate: PromotionTextGenerator = generateText,
    publishing = new StudioPublishingMetadataService(store),
    campaigns = new StudioMarketingCampaignService(store),
  ) {
    this.publishing = publishing;
    this.campaigns = campaigns;
  }

  public async generateCampaign(projectId: string, input: GeneratePromotionCampaignInput): Promise<GeneratedPromotionCampaign> {
    const project = await this.store.load(required(projectId, "Project id"));
    if (!project) throw new Error(`Project "${projectId}" was not found.`);
    if (!project.studioWorkspace) throw new Error("Project has no Studio workspace.");
    const book = getBook(validateStudioWorkspace(project.studioWorkspace), required(input.bookId, "Book id"));
    const publishing = await this.publishing.get(projectId, book.id);
    if (!publishing) throw new Error("Save Publishing metadata before generating a promotion campaign.");
    const channels = uniqueChannels(input.channels);
    if (!channels.length) throw new Error("Select at least one promotion channel.");
    const marketReport = this.marketReport(project.kdpMarketIntelligenceReports ?? [], input.marketResearchReportId, book.id);
    const now = input.now ?? new Date().toISOString();
    const campaignId = input.campaignId?.trim() || `campaign-${randomUUID()}`;

    const result = await this.generate({
      system: promotionSystemPrompt(),
      user: JSON.stringify({
        book: { id: book.id, title: book.title, kind: book.kind, description: book.description },
        publishingMetadata: publishing.metadata,
        marketResearch: marketReport ? {
          id: marketReport.id,
          researchedAt: marketReport.researchedAt,
          market: marketReport.market,
          keywords: marketReport.keywordRecommendations ?? [],
          niches: marketReport.nicheOpportunities ?? [],
          assessment: marketReport.assessment,
        } : null,
        campaign: {
          id: campaignId,
          objective: required(input.objective, "Promotion objective"),
          audience: required(input.audience, "Promotion audience"),
          readerPromise: required(input.readerPromise, "Reader promise"),
          channels,
          marketplace: input.marketplace?.trim() || publishing.metadata.primaryMarketplace,
          launchDate: input.launchDate,
        },
      }, null, 2),
      temperature: 0.45,
      maxOutputTokens: 8000,
    });

    const draft = parsePromotionJson(result.text);
    const assets = validateGeneratedAssets(draft.assets, channels, book.id, marketReport);
    const campaign = createMarketingCampaign({
      id: campaignId,
      projectId,
      bookId: book.id,
      objective: required(input.objective, "Promotion objective"),
      audience: required(input.audience, "Promotion audience"),
      readerPromise: required(input.readerPromise, "Reader promise"),
      marketplace: input.marketplace?.trim() || publishing.metadata.primaryMarketplace,
      ...(input.launchDate ? { launchDate: normalizeTimestamp(input.launchDate, "Launch date") } : {}),
      createdAt: now,
      updatedAt: now,
      ...(marketReport ? { researchReportIds: [marketReport.id] } : {}),
      assets,
      amazonAdsPlans: normalizeAdsPlans(draft.amazonAdsPlans, input.marketplace?.trim() || publishing.metadata.primaryMarketplace),
      aPlusContentPlans: normalizeAPlusPlans(draft.aPlusContentPlans, input.marketplace?.trim() || publishing.metadata.primaryMarketplace, assets),
    });
    const saved = await this.campaigns.save(projectId, book.id, campaign, { now, reference: `ai-promotion:${result.provider}/${result.model}` });
    return {
      ...saved,
      provider: result.provider,
      model: result.model,
      ...(result.requestId ? { requestId: result.requestId } : {}),
      complianceIssues: saved.campaign.assets.map((asset) => ({ assetId: asset.id, issues: assessMarketingAssetCompliance(asset) })).filter((entry) => entry.issues.length > 0),
    };
  }

  private marketReport(reports: readonly KdpMarketIntelligenceReport[], requestedId: string | undefined, bookId: string): KdpMarketIntelligenceReport | undefined {
    const scoped = reports.filter((report) => !report.bookId || report.bookId === bookId).map(validateKdpMarketIntelligenceReport);
    if (requestedId?.trim()) {
      const exact = scoped.find((report) => report.id === requestedId.trim());
      if (!exact) throw new Error(`Market research report "${requestedId.trim()}" was not found for this book.`);
      return exact;
    }
    return scoped.sort((left, right) => right.researchedAt.localeCompare(left.researchedAt))[0];
  }
}

type GeneratedPromotionJson = {
  readonly assets?: unknown;
  readonly amazonAdsPlans?: unknown;
  readonly aPlusContentPlans?: unknown;
};

function promotionSystemPrompt(): string {
  return `You are Author's Forge Promotion Office. Create substantive launch/promotion assets from the supplied real book metadata and optional saved market research. Return JSON only. Every generated asset is a DRAFT requiring author approval. Do not claim bestseller status, rankings, awards, reviews, sales, popularity, medical/educational outcomes, or other facts not explicitly supplied. Do not invent prices, discounts, availability, ASINs, URLs, endorsements, or customer reviews.\n\nReturn {"assets":[{"id":"stable-id","channel":"author-site|email|social|reader-community|ads|press|retailer|amazon-ads|a-plus","kind":"social-post|email|author-site-copy|press-release|ad-headline|ad-copy|a-plus-module|retailer-copy|launch-graphic-brief|reader-community-post|campaign-note","title":"specific title","body":"complete usable copy","audience":"optional audience","callToAction":"optional CTA"}],"amazonAdsPlans":[{"campaignType":"sponsored-products|sponsored-brands","targeting":"keyword|product|automatic|mixed","keywordTargets":["relevant phrase"],"productTargets":[],"negativeKeywords":[],"notes":["specific setup note"]}],"aPlusContentPlans":[{"language":"English","contentName":"specific evergreen name","asinTargets":[],"moduleAssetIds":["id of generated a-plus asset"]}]}.\n\nCreate at least one substantive asset for every requested channel. Amazon Ads custom text must be accurate and must not contain price/discount/customer-review/unsubstantiated superlative language. A+ content must be evergreen and informational: no price, promotion, discount, free bonus, buy-now language, customer reviews, time-sensitive/new/latest/holiday/KU language, URLs/contact/QR codes, or competitor comparisons. Do not mark anything approved, scheduled, or published; status is controlled by Forge.`;
}

function parsePromotionJson(raw: string): GeneratedPromotionJson {
  const trimmed = raw.trim();
  const source = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1] ?? trimmed;
  let parsed: unknown;
  try { parsed = JSON.parse(source); } catch { throw new Error("Promotion AI did not return valid JSON."); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Promotion AI JSON must be an object.");
  return parsed as GeneratedPromotionJson;
}

function validateGeneratedAssets(value: unknown, requestedChannels: readonly MarketingChannel[], bookId: string, marketReport?: KdpMarketIntelligenceReport): MarketingAsset[] {
  if (!Array.isArray(value) || !value.length) throw new Error("Promotion AI returned no usable assets.");
  const ids = new Set<string>();
  const assets = value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`Promotion asset ${index + 1} must be an object.`);
    const row = entry as Record<string, unknown>;
    const id = required(row.id, `Promotion asset ${index + 1} id`);
    if (ids.has(id)) throw new Error(`Promotion AI returned duplicate asset id "${id}".`);
    ids.add(id);
    const channel = enumValue(row.channel, MARKETING_CHANNELS, `Promotion asset ${id} channel`);
    if (!requestedChannels.includes(channel)) throw new Error(`Promotion AI returned unrequested channel "${channel}".`);
    const kind = enumValue(row.kind, MARKETING_ASSET_KINDS, `Promotion asset ${id} kind`);
    const evidence = [
      { source: `book:${bookId}`, claim: "Creative promotional copy derived from the selected book and its approved publishing metadata.", confidence: "creative" as const },
      ...(marketReport ? [{ source: `market-research:${marketReport.id}`, claim: "Promotion positioning was informed by a saved, dated market-research report.", confidence: "source-supported" as const, observedAt: marketReport.researchedAt }] : []),
    ];
    return {
      id,
      channel,
      kind,
      title: required(row.title, `Promotion asset ${id} title`),
      body: required(row.body, `Promotion asset ${id} body`),
      status: "draft" as const,
      evidence,
      ...(typeof row.audience === "string" && row.audience.trim() ? { audience: row.audience.trim() } : {}),
      ...(typeof row.callToAction === "string" && row.callToAction.trim() ? { callToAction: row.callToAction.trim() } : {}),
      ...(marketReport ? { sourceResearchIds: [marketReport.id] } : {}),
    };
  });
  for (const channel of requestedChannels) if (!assets.some((asset) => asset.channel === channel)) throw new Error(`Promotion AI omitted requested channel "${channel}".`);
  return assets;
}

function normalizeAdsPlans(value: unknown, marketplace: string) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error("Promotion AI Amazon Ads plans must be an array.");
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`Amazon Ads plan ${index + 1} must be an object.`);
    const row = entry as Record<string, unknown>;
    return {
      marketplace,
      campaignType: enumValue(row.campaignType, ["sponsored-products", "sponsored-brands"] as const, `Amazon Ads plan ${index + 1} campaign type`),
      targeting: enumValue(row.targeting, ["keyword", "product", "automatic", "mixed"] as const, `Amazon Ads plan ${index + 1} targeting`),
      keywordTargets: textArray(row.keywordTargets ?? [], `Amazon Ads plan ${index + 1} keyword targets`),
      productTargets: textArray(row.productTargets ?? [], `Amazon Ads plan ${index + 1} product targets`),
      negativeKeywords: textArray(row.negativeKeywords ?? [], `Amazon Ads plan ${index + 1} negative keywords`),
      notes: textArray(row.notes ?? [], `Amazon Ads plan ${index + 1} notes`),
    };
  });
}

function normalizeAPlusPlans(value: unknown, marketplace: string, assets: readonly MarketingAsset[]) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error("Promotion AI A+ plans must be an array.");
  const aPlusIds = new Set(assets.filter((asset) => asset.channel === "a-plus").map((asset) => asset.id));
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`A+ plan ${index + 1} must be an object.`);
    const row = entry as Record<string, unknown>;
    const moduleAssetIds = textArray(row.moduleAssetIds ?? [], `A+ plan ${index + 1} module assets`);
    for (const id of moduleAssetIds) if (!aPlusIds.has(id)) throw new Error(`A+ plan references non-A+ or missing asset "${id}".`);
    return {
      marketplace,
      language: required(row.language, `A+ plan ${index + 1} language`),
      contentName: required(row.contentName, `A+ plan ${index + 1} content name`),
      asinTargets: [],
      moduleAssetIds,
    };
  });
}

function uniqueChannels(values: readonly MarketingChannel[]): MarketingChannel[] {
  if (!Array.isArray(values)) throw new Error("Promotion channels must be an array.");
  return [...new Set(values.map((value) => enumValue(value, MARKETING_CHANNELS, "Promotion channel")))];
}
function textArray(value: unknown, label: string): string[] { if (!Array.isArray(value)) throw new Error(`${label} must be an array.`); return [...new Set(value.map((item) => required(item, label)))]; }
function required(value: unknown, label: string): string { if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`); return value.trim(); }
function enumValue<const T extends readonly string[]>(value: unknown, allowed: T, label: string): T[number] { if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) throw new Error(`${label} is invalid.`); return value as T[number]; }
function normalizeTimestamp(value: string, label: string): string { const parsed = Date.parse(value); if (!Number.isFinite(parsed)) throw new Error(`${label} must be a valid timestamp.`); return new Date(parsed).toISOString(); }

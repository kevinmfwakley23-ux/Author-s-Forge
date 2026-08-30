export const LAUNCH_CAMPAIGN_FORMAT_VERSION = 1 as const;

export type CampaignChannel = "store" | "social" | "email" | "ad" | "author-site" | "reader-group" | "press";
export type CampaignAssetKind = "announcement" | "excerpt" | "quote-card" | "short-video" | "newsletter" | "ad-copy" | "blog" | "launch-page";
export type CampaignAssetStatus = "draft" | "approved" | "scheduled" | "published" | "retired";

export interface CampaignEvidence {
  readonly id: string;
  readonly claim: string;
  readonly source: string;
  readonly confidence: "observed" | "source-supported" | "inference" | "creative" | "uncertain";
}

export interface LaunchCampaignAsset {
  readonly id: string;
  readonly kind: CampaignAssetKind;
  readonly channel: CampaignChannel;
  readonly title: string;
  readonly copy: string;
  readonly audience: string;
  readonly callToAction?: string;
  readonly evidenceIds: readonly string[];
  readonly status: CampaignAssetStatus;
  readonly scheduledFor?: string;
}

export interface LaunchCampaign {
  readonly formatVersion: typeof LAUNCH_CAMPAIGN_FORMAT_VERSION;
  readonly id: string;
  readonly projectId: string;
  readonly bookId: string;
  readonly objective: string;
  readonly audience: string;
  readonly corePromise: string;
  readonly positioningReference?: string;
  readonly evidence: readonly CampaignEvidence[];
  readonly assets: readonly LaunchCampaignAsset[];
  readonly launchDate?: string;
  readonly guardrails: readonly string[];
  readonly updatedAt: string;
}

export interface CreateLaunchCampaignInput {
  readonly id: string;
  readonly projectId: string;
  readonly bookId: string;
  readonly objective: string;
  readonly audience: string;
  readonly corePromise: string;
  readonly positioningReference?: string;
  readonly evidence?: readonly CampaignEvidence[];
  readonly assets?: readonly LaunchCampaignAsset[];
  readonly launchDate?: string;
  readonly guardrails?: readonly string[];
  readonly now?: string;
}

export function createLaunchCampaign(input: CreateLaunchCampaignInput): LaunchCampaign {
  text(input.id, "Campaign id"); text(input.projectId, "Campaign project id"); text(input.bookId, "Campaign book id");
  text(input.objective, "Campaign objective"); text(input.audience, "Campaign audience"); text(input.corePromise, "Campaign core promise");
  const evidence = normalizeEvidence(input.evidence ?? []);
  const evidenceIds = new Set(evidence.map((item) => item.id));
  const assets = (input.assets ?? []).map((asset) => normalizeAsset(asset, evidenceIds));
  return Object.freeze({
    formatVersion: LAUNCH_CAMPAIGN_FORMAT_VERSION,
    id: input.id.trim(), projectId: input.projectId.trim(), bookId: input.bookId.trim(),
    objective: input.objective.trim(), audience: input.audience.trim(), corePromise: input.corePromise.trim(),
    ...(input.positioningReference ? { positioningReference: input.positioningReference.trim() } : {}),
    evidence: Object.freeze(evidence), assets: Object.freeze(assets),
    ...(input.launchDate ? { launchDate: validDate(input.launchDate, "launch date") } : {}),
    guardrails: Object.freeze(uniqueStrings(input.guardrails ?? [
      "Do not present estimates or inferences as observed market facts.",
      "Do not promise sales, rankings, reviews, or commercial outcomes.",
      "Do not publish an asset until the author approves it.",
    ])),
    updatedAt: input.now ?? new Date().toISOString(),
  });
}

export function approveCampaignAsset(campaign: LaunchCampaign, assetId: string): LaunchCampaign {
  const asset = campaign.assets.find((item) => item.id === assetId);
  if (!asset) throw new Error(`Campaign asset "${assetId}" not found.`);
  if (asset.status === "published" || asset.status === "retired") throw new Error(`Campaign asset "${assetId}" cannot be approved from ${asset.status}.`);
  return createLaunchCampaign({ ...campaign, evidence: campaign.evidence, assets: campaign.assets.map((item) => item.id === assetId ? { ...item, status: "approved" } : item), now: new Date().toISOString() });
}

export function scheduleCampaignAsset(campaign: LaunchCampaign, assetId: string, scheduledFor: string): LaunchCampaign {
  const asset = campaign.assets.find((item) => item.id === assetId);
  if (!asset) throw new Error(`Campaign asset "${assetId}" not found.`);
  if (asset.status !== "approved") throw new Error("Only author-approved campaign assets may be scheduled.");
  return createLaunchCampaign({ ...campaign, evidence: campaign.evidence, assets: campaign.assets.map((item) => item.id === assetId ? { ...item, status: "scheduled", scheduledFor } : item), now: new Date().toISOString() });
}

function normalizeEvidence(items: readonly CampaignEvidence[]): CampaignEvidence[] {
  const seen = new Set<string>();
  return items.map((item) => {
    text(item.id, "Campaign evidence id"); text(item.claim, "Campaign evidence claim"); text(item.source, "Campaign evidence source");
    if (seen.has(item.id)) throw new Error(`Duplicate campaign evidence id "${item.id}".`);
    seen.add(item.id); return Object.freeze({ ...item });
  });
}

function normalizeAsset(asset: LaunchCampaignAsset, evidenceIds: Set<string>): LaunchCampaignAsset {
  text(asset.id, "Campaign asset id"); text(asset.title, "Campaign asset title"); text(asset.copy, "Campaign asset copy"); text(asset.audience, "Campaign asset audience");
  for (const id of asset.evidenceIds) if (!evidenceIds.has(id)) throw new Error(`Campaign asset "${asset.id}" references missing evidence "${id}".`);
  if (asset.scheduledFor) validDate(asset.scheduledFor, "scheduled time");
  return Object.freeze({ ...asset, evidenceIds: Object.freeze(uniqueStrings(asset.evidenceIds)) });
}

function validDate(value: string, label: string): string { const parsed = Date.parse(value); if (!Number.isFinite(parsed)) throw new Error(`${label} must be a valid ISO timestamp.`); return new Date(parsed).toISOString(); }
function uniqueStrings(values: readonly string[]): string[] { const seen = new Set<string>(); return values.map((v) => v.trim()).filter((v) => v && !seen.has(v) && (seen.add(v), true)); }
function text(value: string, label: string): string { if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`); return value.trim(); }

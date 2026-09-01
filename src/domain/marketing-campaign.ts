export const MARKETING_CHANNELS = ["author-site", "email", "social", "reader-community", "ads", "press", "retailer", "amazon-ads", "a-plus"] as const;
export type MarketingChannel = typeof MARKETING_CHANNELS[number];
export type MarketingAssetStatus = "draft" | "approved" | "scheduled" | "published" | "rejected";
export const MARKETING_ASSET_KINDS = ["social-post", "email", "author-site-copy", "press-release", "ad-headline", "ad-copy", "a-plus-module", "retailer-copy", "launch-graphic-brief", "reader-community-post", "campaign-note"] as const;
export type MarketingAssetKind = typeof MARKETING_ASSET_KINDS[number];
export type MarketingEvidenceConfidence = "known" | "source-supported" | "inference" | "creative";

export interface MarketingEvidence {
  readonly source: string;
  readonly claim: string;
  readonly confidence: MarketingEvidenceConfidence;
  readonly url?: string;
  readonly observedAt?: string;
}

export interface MarketingAsset {
  readonly id: string;
  readonly channel: MarketingChannel;
  readonly kind?: MarketingAssetKind;
  readonly title: string;
  readonly body: string;
  readonly status: MarketingAssetStatus;
  readonly evidence: readonly MarketingEvidence[];
  readonly audience?: string;
  readonly callToAction?: string;
  readonly scheduledFor?: string;
  readonly approvedAt?: string;
  readonly publishedAt?: string;
  readonly externalReference?: string;
  readonly sourceResearchIds?: readonly string[];
}

export interface AmazonAdsPlan {
  readonly marketplace: string;
  readonly campaignType: "sponsored-products" | "sponsored-brands";
  readonly dailyBudget?: number;
  readonly targeting: "keyword" | "product" | "automatic" | "mixed";
  readonly keywordTargets: readonly string[];
  readonly productTargets: readonly string[];
  readonly negativeKeywords: readonly string[];
  readonly notes: readonly string[];
}

export interface APlusContentPlan {
  readonly marketplace: string;
  readonly language: string;
  readonly contentName: string;
  readonly asinTargets: readonly string[];
  readonly moduleAssetIds: readonly string[];
}

export interface MarketingCampaign {
  readonly id: string;
  readonly projectId: string;
  readonly bookId: string;
  readonly objective: string;
  readonly audience: string;
  readonly readerPromise: string;
  readonly assets: readonly MarketingAsset[];
  readonly marketplace?: string;
  readonly launchDate?: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  readonly researchReportIds?: readonly string[];
  readonly amazonAdsPlans?: readonly AmazonAdsPlan[];
  readonly aPlusContentPlans?: readonly APlusContentPlan[];
}

export interface MarketingComplianceIssue {
  readonly id: string;
  readonly severity: "error" | "warning";
  readonly message: string;
  readonly remediation: string;
}

const required = (value: string, label: string): string => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
};

export function createMarketingCampaign(input: MarketingCampaign): MarketingCampaign {
  required(input.id, "Campaign id");
  required(input.projectId, "Project id");
  required(input.bookId, "Book id");
  required(input.objective, "Objective");
  required(input.audience, "Audience");
  required(input.readerPromise, "Reader promise");
  if (input.launchDate !== undefined && Number.isNaN(Date.parse(input.launchDate))) throw new Error("Campaign launch date must be a valid timestamp.");
  if (input.createdAt !== undefined && Number.isNaN(Date.parse(input.createdAt))) throw new Error("Campaign createdAt must be a valid timestamp.");
  if (input.updatedAt !== undefined && Number.isNaN(Date.parse(input.updatedAt))) throw new Error("Campaign updatedAt must be a valid timestamp.");

  const ids = new Set<string>();
  const assets = input.assets.map((asset) => validateMarketingAsset(asset, ids));
  const amazonAdsPlans = (input.amazonAdsPlans ?? []).map(validateAmazonAdsPlan);
  const aPlusContentPlans = (input.aPlusContentPlans ?? []).map((plan) => validateAPlusPlan(plan, new Set(assets.map((asset) => asset.id))));
  return structuredClone({
    ...input,
    assets,
    ...(input.researchReportIds ? { researchReportIds: uniqueText(input.researchReportIds, "Research report id") } : {}),
    ...(input.amazonAdsPlans ? { amazonAdsPlans } : {}),
    ...(input.aPlusContentPlans ? { aPlusContentPlans } : {}),
  });
}

export function assessMarketingAssetCompliance(asset: MarketingAsset): readonly MarketingComplianceIssue[] {
  const issues: MarketingComplianceIssue[] = [];
  const body = `${asset.title}\n${asset.body}\n${asset.callToAction ?? ""}`;
  if ((asset.status === "scheduled" || asset.status === "published") && asset.evidence.some((e) => e.confidence === "inference")) {
    issues.push({ id: "inference-claim", severity: "error", message: "Scheduled/published marketing cannot rely on inference-only claims.", remediation: "Remove the claim or support it with current source evidence." });
  }
  if (asset.channel === "amazon-ads") {
    if (/\$\s*\d|\bprice\b|\bon sale\b|\bdiscount\b/i.test(body)) issues.push({ id: "amazon-ads-price", severity: "error", message: "Amazon book ad custom text should not include prices or promotional pricing.", remediation: "Remove price/discount language from ad creative." });
    if (/\bguarantee(?:d)?\b|\b#?1\b|\bbest[- ]?seller\b|\btop[- ]?rated\b/i.test(body) && !hasSupportingEvidence(asset)) issues.push({ id: "amazon-ads-unsubstantiated", severity: "error", message: "Amazon ad copy contains a claim requiring substantiation.", remediation: "Remove the claim or attach authoritative evidence and verify current ad-policy eligibility." });
    if (/\bcustomer review\b|\bstars?\b/i.test(body)) issues.push({ id: "amazon-ads-reviews", severity: "error", message: "Customer-review language should not be placed in Amazon book ad custom text.", remediation: "Use accurate book-focused creative instead." });
  }
  if (asset.channel === "a-plus") {
    if (/\$\s*\d|\bprice\b|\bdiscount\b|\baffordable\b|\bcheap\b|\bbonus\b|\bfree\b|\bbuy now\b|\badd to cart\b|\bget yours now\b|\bshop with us\b/i.test(body)) issues.push({ id: "a-plus-promotion", severity: "error", message: "A+ Content cannot contain pricing, promotions, discounts, or purchase directives.", remediation: "Remove promotional/pricing language and keep the module informational." });
    if (/\bcustomer review\b|\breviewer said\b|\bverified purchase\b/i.test(body)) issues.push({ id: "a-plus-review", severity: "error", message: "A+ Content cannot contain customer reviews.", remediation: "Remove customer-review material." });
    if (/\bnew\b|\blatest\b|\bon sale now\b|\bkindle unlimited\b|\bholiday\b/i.test(body)) issues.push({ id: "a-plus-time-sensitive", severity: "error", message: "A+ Content cannot use time-sensitive or program-promotion language.", remediation: "Use evergreen descriptive copy." });
    if (/https?:\/\/|\bwww\.|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(body)) issues.push({ id: "a-plus-contact", severity: "error", message: "A+ Content cannot contain web links or off-Amazon contact information.", remediation: "Remove URLs and contact information." });
    if (/\bqr\s*code\b|\bbarcode\b/i.test(body)) issues.push({ id: "a-plus-qr", severity: "error", message: "A+ Content should not contain QR/barcode redirect material.", remediation: "Remove QR/barcode references from the module." });
  }
  return issues;
}

export function approveMarketingAsset(campaign: MarketingCampaign, id: string, now = new Date().toISOString()): MarketingCampaign {
  const validated = createMarketingCampaign(campaign);
  const asset = validated.assets.find((item) => item.id === id);
  if (!asset) throw new Error(`Marketing asset ${id} not found.`);
  if (asset.status === "rejected") throw new Error("Rejected assets must be revised before approval.");
  const errors = assessMarketingAssetCompliance(asset).filter((issue) => issue.severity === "error");
  if (errors.length) throw new Error(`Marketing asset cannot be approved: ${errors.map((issue) => issue.message).join(" ")}`);
  return createMarketingCampaign({ ...validated, updatedAt: now, assets: validated.assets.map((item) => item.id === id ? { ...item, status: "approved", approvedAt: now } : item) });
}

export function rejectMarketingAsset(campaign: MarketingCampaign, id: string, now = new Date().toISOString()): MarketingCampaign {
  const validated = createMarketingCampaign(campaign);
  if (!validated.assets.some((item) => item.id === id)) throw new Error(`Marketing asset ${id} not found.`);
  return createMarketingCampaign({ ...validated, updatedAt: now, assets: validated.assets.map((item) => item.id === id ? { ...item, status: "rejected", scheduledFor: undefined, publishedAt: undefined } : item) });
}

export function scheduleMarketingAsset(campaign: MarketingCampaign, id: string, when: string, now = new Date().toISOString()): MarketingCampaign {
  const validated = createMarketingCampaign(campaign);
  const asset = validated.assets.find((item) => item.id === id);
  if (!asset) throw new Error(`Marketing asset ${id} not found.`);
  if (asset.status !== "approved") throw new Error("Only approved assets may be scheduled.");
  const date = new Date(when);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid marketing schedule time.");
  const errors = assessMarketingAssetCompliance(asset).filter((issue) => issue.severity === "error");
  if (errors.length) throw new Error(`Marketing asset cannot be scheduled: ${errors.map((issue) => issue.message).join(" ")}`);
  return createMarketingCampaign({ ...validated, updatedAt: now, assets: validated.assets.map((item) => item.id === id ? { ...item, status: "scheduled", scheduledFor: date.toISOString() } : item) });
}

export function publishMarketingAsset(campaign: MarketingCampaign, id: string, input: { readonly now?: string; readonly externalReference?: string } = {}): MarketingCampaign {
  const validated = createMarketingCampaign(campaign);
  const asset = validated.assets.find((item) => item.id === id);
  if (!asset) throw new Error(`Marketing asset ${id} not found.`);
  if (asset.status !== "approved" && asset.status !== "scheduled") throw new Error("Only approved or scheduled assets may be marked published.");
  const errors = assessMarketingAssetCompliance(asset).filter((issue) => issue.severity === "error");
  if (errors.length) throw new Error(`Marketing asset cannot be published: ${errors.map((issue) => issue.message).join(" ")}`);
  const now = input.now ?? new Date().toISOString();
  return createMarketingCampaign({ ...validated, updatedAt: now, assets: validated.assets.map((item) => item.id === id ? { ...item, status: "published", publishedAt: now, ...(input.externalReference?.trim() ? { externalReference: input.externalReference.trim() } : {}) } : item) });
}

function validateMarketingAsset(asset: MarketingAsset, ids: Set<string>): MarketingAsset {
  const id = required(asset.id, "Asset id");
  required(asset.title, "Asset title");
  required(asset.body, "Asset body");
  if (ids.has(id)) throw new Error(`Duplicate marketing asset id ${id}.`);
  ids.add(id);
  if (!MARKETING_CHANNELS.includes(asset.channel)) throw new Error(`Unsupported marketing channel ${asset.channel}.`);
  if (asset.kind !== undefined && !MARKETING_ASSET_KINDS.includes(asset.kind)) throw new Error(`Unsupported marketing asset kind ${asset.kind}.`);
  if (!["draft", "approved", "scheduled", "published", "rejected"].includes(asset.status)) throw new Error(`Unsupported marketing asset status ${asset.status}.`);
  if (asset.scheduledFor !== undefined && Number.isNaN(Date.parse(asset.scheduledFor))) throw new Error("Marketing schedule time is invalid.");
  if (asset.approvedAt !== undefined && Number.isNaN(Date.parse(asset.approvedAt))) throw new Error("Marketing approvedAt is invalid.");
  if (asset.publishedAt !== undefined && Number.isNaN(Date.parse(asset.publishedAt))) throw new Error("Marketing publishedAt is invalid.");
  if (asset.status === "scheduled" && !asset.scheduledFor) throw new Error("Scheduled assets require a schedule.");
  if (asset.status === "published" && !asset.publishedAt) throw new Error("Published assets require a publishedAt timestamp.");
  const evidence = asset.evidence.map(validateEvidence);
  if ((asset.status === "scheduled" || asset.status === "published") && evidence.some((item) => item.confidence === "inference")) throw new Error("Inference-only claims cannot be scheduled or published.");
  return { ...asset, id, evidence, ...(asset.sourceResearchIds ? { sourceResearchIds: uniqueText(asset.sourceResearchIds, "Source research id") } : {}) };
}

function validateEvidence(value: MarketingEvidence): MarketingEvidence {
  required(value.source, "Marketing evidence source");
  required(value.claim, "Marketing evidence claim");
  if (!["known", "source-supported", "inference", "creative"].includes(value.confidence)) throw new Error("Marketing evidence confidence is invalid.");
  if (value.url !== undefined) {
    const url = new URL(value.url);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Marketing evidence URL must use HTTP or HTTPS.");
  }
  if (value.observedAt !== undefined && Number.isNaN(Date.parse(value.observedAt))) throw new Error("Marketing evidence observedAt is invalid.");
  return { ...value };
}

function validateAmazonAdsPlan(plan: AmazonAdsPlan): AmazonAdsPlan {
  required(plan.marketplace, "Amazon Ads marketplace");
  if (!["sponsored-products", "sponsored-brands"].includes(plan.campaignType)) throw new Error("Amazon Ads campaign type is invalid.");
  if (!["keyword", "product", "automatic", "mixed"].includes(plan.targeting)) throw new Error("Amazon Ads targeting mode is invalid.");
  if (plan.dailyBudget !== undefined && (!Number.isFinite(plan.dailyBudget) || plan.dailyBudget <= 0)) throw new Error("Amazon Ads daily budget must be positive.");
  return { ...plan, keywordTargets: uniqueText(plan.keywordTargets, "Amazon Ads keyword target"), productTargets: uniqueText(plan.productTargets, "Amazon Ads product target"), negativeKeywords: uniqueText(plan.negativeKeywords, "Amazon Ads negative keyword"), notes: uniqueText(plan.notes, "Amazon Ads note") };
}

function validateAPlusPlan(plan: APlusContentPlan, assetIds: ReadonlySet<string>): APlusContentPlan {
  required(plan.marketplace, "A+ marketplace");
  required(plan.language, "A+ language");
  required(plan.contentName, "A+ content name");
  const moduleAssetIds = uniqueText(plan.moduleAssetIds, "A+ module asset id");
  for (const id of moduleAssetIds) if (!assetIds.has(id)) throw new Error(`A+ plan references missing marketing asset ${id}.`);
  return { ...plan, asinTargets: uniqueText(plan.asinTargets, "A+ ASIN"), moduleAssetIds };
}

function hasSupportingEvidence(asset: MarketingAsset): boolean {
  return asset.evidence.some((item) => item.confidence === "known" || item.confidence === "source-supported");
}

function uniqueText(values: readonly string[], label: string): string[] {
  if (!Array.isArray(values)) throw new Error(`${label} values must be an array.`);
  return [...new Set(values.map((value) => required(value, label)))];
}

import { assessMarketingAssetCompliance, createMarketingCampaign, type MarketingCampaign } from "./marketing-campaign";

export const PROMOTION_READINESS_FORMAT_VERSION = 1 as const;
export type PromotionReadinessStatus = "ready" | "attention";
export type PromotionReadinessSeverity = "error" | "warning";

export interface PromotionReadinessCheck {
  readonly id: string;
  readonly label: string;
  readonly status: "passed" | "attention";
  readonly severity: PromotionReadinessSeverity;
  readonly message: string;
  readonly remediation?: string;
}

export interface PromotionReadinessReport {
  readonly formatVersion: typeof PROMOTION_READINESS_FORMAT_VERSION;
  readonly id: string;
  readonly projectId: string;
  readonly bookId: string;
  readonly campaignId?: string;
  readonly createdAt: string;
  readonly checks: readonly PromotionReadinessCheck[];
  readonly passedCount: number;
  readonly errorCount: number;
  readonly warningCount: number;
  readonly status: PromotionReadinessStatus;
}

export function createPromotionReadinessReport(input: {
  readonly id: string;
  readonly projectId: string;
  readonly bookId: string;
  readonly campaign?: MarketingCampaign;
  readonly now?: string;
}): PromotionReadinessReport {
  const id = required(input.id, "Promotion readiness id");
  const projectId = required(input.projectId, "Project id");
  const bookId = required(input.bookId, "Book id");
  const checks: PromotionReadinessCheck[] = [];
  const campaign = input.campaign ? createMarketingCampaign(input.campaign) : undefined;

  checks.push(check("campaign-present", "Promotion campaign", Boolean(campaign), "A promotion campaign exists.", "Create and review a campaign before launch."));
  if (campaign) {
    checks.push(check("campaign-project", "Campaign project", campaign.projectId === projectId, "Campaign belongs to this project.", "Use the campaign bound to this project."));
    checks.push(check("campaign-book", "Campaign book", campaign.bookId === bookId, "Campaign belongs to this book.", "Use the campaign bound to this book."));
    checks.push(check("assets-present", "Promotion assets", campaign.assets.length > 0, "Campaign contains promotion assets.", "Generate or create at least one real promotion asset."));

    const draftCount = campaign.assets.filter((asset) => asset.status === "draft").length;
    checks.push(check("asset-review", "Asset review", draftCount === 0, "All promotion assets have an author decision.", `Review the ${draftCount} remaining draft asset(s).`));

    const approvedCount = campaign.assets.filter((asset) => asset.status === "approved" || asset.status === "scheduled" || asset.status === "published").length;
    checks.push(check("approved-assets", "Approved promotion", approvedCount > 0, "At least one promotion asset is author-approved.", "Approve at least one compliant launch asset."));

    for (const asset of campaign.assets) {
      const errors = assessMarketingAssetCompliance(asset).filter((issue) => issue.severity === "error");
      checks.push(check(`asset-compliance-${asset.id}`, `Compliance: ${asset.title}`, errors.length === 0, "Asset passes channel compliance checks.", errors.map((issue) => issue.remediation).join(" ")));
    }

    const hasResearch = Boolean(campaign.researchReportIds?.length) || campaign.assets.some((asset) => asset.sourceResearchIds?.length);
    checks.push(check("research-linkage", "Market research linkage", hasResearch, "Campaign is linked to saved market research.", "Run or attach current market research so positioning and keywords remain evidence-aware.", "warning"));

    for (const [index, plan] of (campaign.amazonAdsPlans ?? []).entries()) {
      const targetReady = plan.targeting === "automatic" || plan.keywordTargets.length > 0 || plan.productTargets.length > 0;
      checks.push(check(`amazon-ads-targeting-${index + 1}`, `Amazon Ads targeting ${index + 1}`, targetReady, "Amazon Ads targeting is defined.", "Add keyword/product targets or use automatic targeting."));
      checks.push(check(`amazon-ads-account-eligibility-${index + 1}`, `Amazon Ads account/book eligibility ${index + 1}`, false, "Amazon Ads account and book eligibility must be verified in Amazon before activation.", "Confirm the book is available in the target marketplace and claimed in Author Central, and confirm the Ads account is active/in good standing with a valid payment method.", "warning"));
      if (plan.campaignType === "sponsored-brands") {
        checks.push(check(`sponsored-brands-eligibility-${index + 1}`, `Sponsored Brands author eligibility ${index + 1}`, false, "Sponsored Brands author eligibility must be verified in Amazon.", "Current Amazon author guidance requires at least three eligible book titles under the same pen name claimed in Author Central. Verify that condition in the target marketplace before activation.", "warning"));
      }
    }

    for (const [index, plan] of (campaign.aPlusContentPlans ?? []).entries()) {
      checks.push(check(`a-plus-modules-${index + 1}`, `A+ modules ${index + 1}`, plan.moduleAssetIds.length > 0, "A+ plan references real module assets.", "Add at least one compliant A+ module asset."));
      checks.push(check(`a-plus-asin-${index + 1}`, `A+ ASIN assignment ${index + 1}`, plan.asinTargets.length > 0, "A+ plan has target ASINs.", "Assign eligible live/pre-order KDP ASINs to this A+ project in the target marketplace.", "warning"));
    }
  }

  const passedCount = checks.filter((item) => item.status === "passed").length;
  const errorCount = checks.filter((item) => item.status === "attention" && item.severity === "error").length;
  const warningCount = checks.filter((item) => item.status === "attention" && item.severity === "warning").length;
  return {
    formatVersion: PROMOTION_READINESS_FORMAT_VERSION,
    id,
    projectId,
    bookId,
    ...(campaign ? { campaignId: campaign.id } : {}),
    createdAt: normalizeTimestamp(input.now ?? new Date().toISOString(), "Promotion readiness createdAt"),
    checks,
    passedCount,
    errorCount,
    warningCount,
    status: errorCount === 0 ? "ready" : "attention",
  };
}

export function validatePromotionReadinessReport(report: PromotionReadinessReport): PromotionReadinessReport {
  if (report.formatVersion !== PROMOTION_READINESS_FORMAT_VERSION) throw new Error("Unsupported promotion readiness format version.");
  required(report.id, "Promotion readiness id");
  required(report.projectId, "Project id");
  required(report.bookId, "Book id");
  normalizeTimestamp(report.createdAt, "Promotion readiness createdAt");
  if (!Array.isArray(report.checks) || report.checks.length === 0) throw new Error("Promotion readiness report must contain checks.");
  for (const item of report.checks) {
    required(item.id, "Promotion readiness check id");
    required(item.label, "Promotion readiness check label");
    required(item.message, "Promotion readiness check message");
    if (!["passed", "attention"].includes(item.status)) throw new Error("Promotion readiness check status is invalid.");
    if (!["error", "warning"].includes(item.severity)) throw new Error("Promotion readiness check severity is invalid.");
  }
  const passedCount = report.checks.filter((item) => item.status === "passed").length;
  const errorCount = report.checks.filter((item) => item.status === "attention" && item.severity === "error").length;
  const warningCount = report.checks.filter((item) => item.status === "attention" && item.severity === "warning").length;
  if (report.passedCount !== passedCount || report.errorCount !== errorCount || report.warningCount !== warningCount) throw new Error("Promotion readiness summary is inconsistent.");
  if (report.status !== (errorCount === 0 ? "ready" : "attention")) throw new Error("Promotion readiness status is inconsistent.");
  return structuredClone(report);
}

function check(id: string, label: string, ok: boolean, message: string, remediation: string, severity: PromotionReadinessSeverity = "error"): PromotionReadinessCheck {
  return { id, label, status: ok ? "passed" : "attention", severity, message, ...(!ok ? { remediation } : {}) };
}
function required(value: unknown, label: string): string { if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`); return value.trim(); }
function normalizeTimestamp(value: string, label: string): string { const parsed = Date.parse(value); if (!Number.isFinite(parsed)) throw new Error(`${label} must be a valid timestamp.`); return new Date(parsed).toISOString(); }

import type { MarketingCampaign } from "./marketing-campaign";
import type { PromotionReadinessReport } from "./promotion-readiness";
import type { PublishingReadinessReport } from "./publishing-readiness";

export const RELEASE_GATE_FORMAT_VERSION = 1 as const;
export type ReleaseGateStatus = "blocked" | "ready";
export type ReleaseBlockerKind = "publishing-readiness" | "promotion-readiness" | "marketing-approval" | "marketing-evidence";

export interface ReleaseGateBlocker {
  readonly id: string;
  readonly kind: ReleaseBlockerKind;
  readonly message: string;
  readonly remediation: string;
}

export interface ReleaseGateReport {
  readonly formatVersion: typeof RELEASE_GATE_FORMAT_VERSION;
  readonly id: string;
  readonly projectId: string;
  readonly bookId: string;
  readonly createdAt: string;
  readonly status: ReleaseGateStatus;
  readonly blockers: readonly ReleaseGateBlocker[];
}

export interface ReleaseGateInput {
  readonly id: string;
  readonly projectId: string;
  readonly bookId: string;
  readonly publishingReadiness: PublishingReadinessReport;
  readonly promotionReadiness?: PromotionReadinessReport;
  readonly promotionRequired?: boolean;
  readonly marketingCampaign?: MarketingCampaign;
  readonly now?: string;
}

const required = (value: string, label: string) => {
  if (!value.trim()) throw new Error(`${label} is required.`);
};

export function createReleaseGateReport(input: ReleaseGateInput): ReleaseGateReport {
  required(input.id, "Release gate id");
  required(input.projectId, "Project id");
  required(input.bookId, "Book id");

  const blockers: ReleaseGateBlocker[] = [];
  if (input.publishingReadiness.projectId !== input.projectId) {
    blockers.push({ id: "readiness-project-mismatch", kind: "publishing-readiness", message: "Publishing readiness belongs to a different project.", remediation: "Run publishing readiness for the current project." });
  }
  const publishingErrors = input.publishingReadiness.checks.filter((item) => item.status === "attention" && item.severity === "error");
  if (publishingErrors.length) {
    blockers.push({ id: "publishing-readiness", kind: "publishing-readiness", message: `${publishingErrors.length} release-blocking publishing readiness check(s) require attention.`, remediation: "Resolve every error-severity publishing readiness check before release. Warning-only omissions may remain visible without blocking launch." });
  }

  if (input.promotionRequired && !input.promotionReadiness) {
    blockers.push({ id: "promotion-readiness-missing", kind: "promotion-readiness", message: "Promotion readiness has not been evaluated.", remediation: "Run Promotion readiness for the current book before launch." });
  }
  if (input.promotionReadiness) {
    if (input.promotionReadiness.projectId !== input.projectId || input.promotionReadiness.bookId !== input.bookId) {
      blockers.push({ id: "promotion-identity-mismatch", kind: "promotion-readiness", message: "Promotion readiness belongs to a different project or book.", remediation: "Run Promotion readiness for the current release project and book." });
    }
    if (input.promotionReadiness.errorCount > 0 || input.promotionReadiness.status !== "ready") {
      blockers.push({ id: "promotion-readiness", kind: "promotion-readiness", message: `${input.promotionReadiness.errorCount} release-blocking promotion check(s) require attention.`, remediation: "Review remaining drafts, approvals, evidence, and channel-compliance errors before release." });
    }
  }

  if (input.marketingCampaign) {
    if (input.marketingCampaign.projectId !== input.projectId || input.marketingCampaign.bookId !== input.bookId) {
      blockers.push({ id: "marketing-identity-mismatch", kind: "marketing-approval", message: "Marketing campaign belongs to a different project or book.", remediation: "Use a campaign bound to the release project and book." });
    }
    for (const asset of input.marketingCampaign.assets) {
      if ((asset.status === "scheduled" || asset.status === "published") && asset.evidence.some((e) => e.confidence === "inference")) {
        blockers.push({ id: `marketing-inference-${asset.id}`, kind: "marketing-evidence", message: `Marketing asset ${asset.id} contains an inference-only claim.`, remediation: "Replace the claim with evidence or remove it before release." });
      }
    }
  }

  return {
    formatVersion: RELEASE_GATE_FORMAT_VERSION,
    id: input.id,
    projectId: input.projectId,
    bookId: input.bookId,
    createdAt: input.now ?? new Date().toISOString(),
    status: blockers.length === 0 ? "ready" : "blocked",
    blockers,
  };
}

export function validateReleaseGateReport(report: ReleaseGateReport): ReleaseGateReport {
  if (report.formatVersion !== RELEASE_GATE_FORMAT_VERSION) throw new Error("Unsupported release gate format version.");
  required(report.id, "Release gate id");
  required(report.projectId, "Project id");
  required(report.bookId, "Book id");
  if (!Array.isArray(report.blockers)) throw new Error("Release gate blockers must be an array.");
  if (report.status !== (report.blockers.length === 0 ? "ready" : "blocked")) throw new Error("Release gate status is inconsistent with its blockers.");
  return structuredClone(report);
}
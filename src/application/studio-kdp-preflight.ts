import { randomUUID } from "node:crypto";
import type { BookCoverPlan } from "../domain/book-cover-studio";
import type { KdpCoverFileFacts, KdpInteriorFileFacts, KdpPreflightReport } from "../domain/kdp-preflight";
import type { ProjectState } from "../domain/project";
import { KdpPreflightHistoryService } from "./kdp-preflight-history";

export interface StudioKdpPreflightRequest {
  readonly project: ProjectState;
  readonly coverPlanId?: string;
  readonly bookId?: string;
  readonly interiorHasBleed: boolean;
  readonly interior: KdpInteriorFileFacts;
  readonly cover: KdpCoverFileFacts;
  readonly reportId?: string;
  readonly now?: string;
}

export interface StudioKdpPreflightResult {
  readonly report: KdpPreflightReport;
  readonly coverPlanId: string;
  readonly bookId: string;
  readonly coverPlanVersion: number;
  readonly coverPlanApprovalStatus: BookCoverPlan["approvalStatus"];
}

/**
 * Production-safe KDP boundary.
 *
 * Callers provide measured facts about the actual interior/cover files, but
 * they never provide the publishing geometry used as the expected truth.
 * Trim, binding, page count, bleed, paper/interior choices and calculated
 * cover dimensions are resolved from the durable Cover Studio plan instead.
 */
export class StudioKdpPreflightService {
  constructor(private readonly history: KdpPreflightHistoryService) {}

  async audit(request: StudioKdpPreflightRequest): Promise<StudioKdpPreflightResult> {
    const projectId = requiredId(request.project.metadata.id, "Project id");
    const plan = resolveCoverPlan(request.project, request.coverPlanId, request.bookId);
    const report = await this.history.audit({
      id: optionalId(request.reportId) ?? `kdp-preflight-${randomUUID()}`,
      projectId,
      publishing: plan.publishing,
      interiorHasBleed: request.interiorHasBleed,
      interior: request.interior,
      cover: request.cover,
      ...(request.now === undefined ? {} : { now: request.now }),
    });
    return Object.freeze({
      report,
      coverPlanId: plan.id,
      bookId: plan.bookId,
      coverPlanVersion: plan.version,
      coverPlanApprovalStatus: plan.approvalStatus,
    });
  }

  async list(projectId: string): Promise<readonly KdpPreflightReport[]> {
    return this.history.list(requiredId(projectId, "Project id"));
  }

  async latest(projectId: string): Promise<KdpPreflightReport | undefined> {
    return this.history.latest(requiredId(projectId, "Project id"));
  }
}

export function resolveKdpCoverPlan(project: ProjectState, coverPlanId?: string, bookId?: string): BookCoverPlan {
  return resolveCoverPlan(project, coverPlanId, bookId);
}

function resolveCoverPlan(project: ProjectState, coverPlanId?: string, bookId?: string): BookCoverPlan {
  const projectId = requiredId(project.metadata.id, "Project id");
  const plans = (project.bookCoverPlans ?? []).filter((plan) => plan.projectId === projectId);
  const normalizedCoverPlanId = optionalId(coverPlanId);
  const normalizedBookId = optionalId(bookId);

  if (normalizedCoverPlanId) {
    const exact = plans.find((plan) => plan.id === normalizedCoverPlanId);
    if (!exact) throw new Error(`KDP preflight cover plan "${normalizedCoverPlanId}" was not found.`);
    if (normalizedBookId && exact.bookId !== normalizedBookId) throw new Error("KDP preflight cover plan does not belong to the requested book.");
    if (exact.publishing.platform !== "kdp") throw new Error("KDP preflight requires a KDP publishing configuration.");
    return exact;
  }

  const candidates = normalizedBookId ? plans.filter((plan) => plan.bookId === normalizedBookId) : plans;
  const kdpPlans = candidates.filter((plan) => plan.publishing.platform === "kdp");
  if (!kdpPlans.length) {
    if (normalizedBookId) throw new Error(`No KDP cover plan exists for book "${normalizedBookId}".`);
    throw new Error("Create a KDP cover plan before running production preflight.");
  }

  return [...kdpPlans].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
    || b.version - a.version
    || b.id.localeCompare(a.id),
  )[0];
}

function requiredId(value: string, label: string): string {
  if (typeof value !== "string" || !value.trim() || value !== value.trim()) throw new Error(`${label} is invalid.`);
  return value;
}

function optionalId(value: string | undefined): string | undefined {
  if (value === undefined || !value.trim()) return undefined;
  return requiredId(value, "Identifier");
}

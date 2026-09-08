import type { KdpCoverFileFacts, KdpInteriorFileFacts, KdpPreflightReport } from "../domain/kdp-preflight";
import type { BookCoverPlan } from "../domain/book-cover-studio";
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
}

/**
 * Production KDP preflight boundary. Publishing geometry is never accepted
 * from the request body. Forge resolves the durable Cover Studio plan first
 * and audits the supplied files against that authoritative project state.
 */
export class StudioKdpPreflightService {
  constructor(private readonly history: KdpPreflightHistoryService) {}

  async audit(request: StudioKdpPreflightRequest): Promise<StudioKdpPreflightResult> {
    const plan = resolveCoverPlan(request.project, request.coverPlanId, request.bookId);
    const report = await this.history.audit({
      id: request.reportId?.trim() || `kdp-preflight-${crypto.randomUUID()}`,
      projectId: request.project.metadata.id,
      publishing: plan.publishing,
      interiorHasBleed: request.interiorHasBleed,
      interior: request.interior,
      cover: request.cover,
      ...(request.now === undefined ? {} : { now: request.now }),
    });
    return Object.freeze({ report, coverPlanId: plan.id, bookId: plan.bookId });
  }

  async list(projectId: string): Promise<readonly KdpPreflightReport[]> {
    return this.history.list(projectId);
  }

  async latest(projectId: string): Promise<KdpPreflightReport | undefined> {
    return this.history.latest(projectId);
  }
}

function resolveCoverPlan(project: ProjectState, coverPlanId?: string, bookId?: string): BookCoverPlan {
  const plans = project.bookCoverPlans ?? [];
  const normalizedCoverPlanId = coverPlanId?.trim();
  if (normalizedCoverPlanId) {
    const exact = plans.find((plan) => plan.id === normalizedCoverPlanId);
    if (!exact) throw new Error(`KDP preflight cover plan "${normalizedCoverPlanId}" was not found.`);
    if (bookId?.trim() && exact.bookId !== bookId.trim()) throw new Error("KDP preflight cover plan does not belong to the requested book.");
    if (exact.publishing.platform !== "kdp") throw new Error("KDP preflight requires a KDP publishing configuration.");
    return exact;
  }

  const normalizedBookId = bookId?.trim();
  const candidates = normalizedBookId ? plans.filter((plan) => plan.bookId === normalizedBookId) : plans;
  const kdpPlans = candidates.filter((plan) => plan.publishing.platform === "kdp");
  if (!kdpPlans.length) {
    if (normalizedBookId) throw new Error(`No KDP cover plan exists for book "${normalizedBookId}".`);
    throw new Error("Create a KDP cover plan before running production preflight.");
  }

  if (!normalizedBookId) {
    const bookIds = new Set(kdpPlans.map((plan) => plan.bookId));
    if (bookIds.size > 1) throw new Error("Multiple books have KDP cover plans. Specify bookId or coverPlanId before running preflight.");
  }

  return [...kdpPlans].sort((a, b) => b.version - a.version)[0];
}

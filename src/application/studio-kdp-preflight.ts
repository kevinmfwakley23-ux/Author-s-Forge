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
 * Studio boundary for KDP preflight that refuses caller-supplied publishing
 * geometry. Forge resolves the durable cover plan first, then passes that
 * authoritative publishing configuration into the durable preflight history
 * service. This prevents a request from validating a file against dimensions
 * that disagree with the book's actual Cover Studio state.
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
  return kdpPlans[kdpPlans.length - 1];
}

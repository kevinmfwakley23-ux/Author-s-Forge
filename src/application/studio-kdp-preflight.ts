import type { KdpCoverFileFacts, KdpInteriorFileFacts, KdpPreflightReport } from "../domain/kdp-preflight";
import type { BookCoverPlan, PublishingConfiguration } from "../domain/book-cover-studio";
import { validatePublishingConfiguration } from "../domain/book-cover-studio";
import type { ProjectState } from "../domain/project";
import { KdpPreflightHistoryService } from "./kdp-preflight-history";

export interface StudioKdpPreflightRequest {
  readonly project: ProjectState;
  readonly coverPlanId?: string;
  readonly bookId?: string;
  readonly assertedPublishing?: PublishingConfiguration;
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
  readonly publishing: PublishingConfiguration;
}

/**
 * Production KDP preflight boundary.
 *
 * Publishing geometry is resolved from the durable Cover Studio plan stored on
 * the project. Caller-supplied publishing data is accepted only as an assertion
 * for backwards-compatible clients and is rejected when it disagrees with the
 * authoritative plan. It is never used to calculate the audit.
 */
export class StudioKdpPreflightService {
  public constructor(private readonly history: KdpPreflightHistoryService) {}

  public async audit(request: StudioKdpPreflightRequest): Promise<StudioKdpPreflightResult> {
    const projectId = requiredId(request.project.metadata.id, "Project id");
    const plan = resolveCoverPlan(request.project, request.coverPlanId, request.bookId);
    if (plan.projectId !== projectId) throw new Error(`KDP preflight cover plan "${plan.id}" belongs to another project.`);

    if (request.assertedPublishing !== undefined) {
      validatePublishingConfiguration(request.assertedPublishing);
      assertPublishingMatches(plan.publishing, request.assertedPublishing);
    }

    const report = await this.history.audit({
      id: request.reportId?.trim() || `kdp-preflight-${crypto.randomUUID()}`,
      projectId,
      publishing: plan.publishing,
      interiorHasBleed: request.interiorHasBleed,
      interior: request.interior,
      cover: request.cover,
      ...(request.now === undefined ? {} : { now: request.now }),
    });

    return Object.freeze({ report, coverPlanId: plan.id, bookId: plan.bookId, publishing: plan.publishing });
  }

  public async list(projectId: string): Promise<readonly KdpPreflightReport[]> {
    return this.history.list(requiredId(projectId, "Project id"));
  }

  public async latest(projectId: string): Promise<KdpPreflightReport | undefined> {
    return this.history.latest(requiredId(projectId, "Project id"));
  }
}

export function resolveKdpCoverPlan(project: ProjectState, coverPlanId?: string, bookId?: string): BookCoverPlan {
  return resolveCoverPlan(project, coverPlanId, bookId);
}

function resolveCoverPlan(project: ProjectState, coverPlanId?: string, bookId?: string): BookCoverPlan {
  const plans = project.bookCoverPlans ?? [];
  const normalizedCoverPlanId = optionalId(coverPlanId, "Cover plan id");
  const normalizedBookId = optionalId(bookId, "Book id");

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

  return [...kdpPlans].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt) || a.version - b.version).at(-1)!;
}

function assertPublishingMatches(authoritative: PublishingConfiguration, asserted: PublishingConfiguration): void {
  const fields: ReadonlyArray<keyof PublishingConfiguration> = [
    "platform",
    "binding",
    "interiorType",
    "paperType",
    "trimWidthInches",
    "trimHeightInches",
    "pageCount",
    "bleedInches",
    "readingDirection",
  ];
  const mismatches = fields.filter((field) => authoritative[field] !== asserted[field]);
  if (mismatches.length) {
    throw new Error(`KDP preflight publishing configuration disagrees with the durable Cover Studio plan (${mismatches.join(", ")}). Update Cover Studio first, then run preflight again.`);
  }
}

function requiredId(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim() || value !== value.trim() || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error(`${label} is invalid.`);
  return value;
}

function optionalId(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return requiredId(value, label);
}

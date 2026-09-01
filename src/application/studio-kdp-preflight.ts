import { randomUUID } from "node:crypto";
import { KdpPreflightService } from "./kdp-preflight";
import type { KdpCoverFileFacts, KdpInteriorFileFacts, KdpPreflightReport } from "../domain/kdp-preflight";
import { createMemoryRecord, type MemoryRecord } from "../domain/memory";
import { withProjectMemories, type ProjectState } from "../domain/project";
import type { BookCoverPlan } from "../domain/book-cover-studio";

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
  readonly evidenceMemory: MemoryRecord;
  readonly project: ProjectState;
}

/**
 * Governed Studio application boundary for KDP production preflight.
 *
 * The caller may identify a specific cover plan, or a book. Forge then resolves
 * the authoritative KDP cover plan from durable project state and derives all
 * expected cover geometry from that plan. The resulting audit is persisted as
 * project memory so a production decision does not disappear when Studio is
 * reloaded.
 */
export class StudioKdpPreflightService {
  private readonly preflight = new KdpPreflightService();

  audit(request: StudioKdpPreflightRequest): StudioKdpPreflightResult {
    const projectId = request.project.metadata.id;
    const plan = resolveCoverPlan(request.project, request.coverPlanId, request.bookId);
    const now = request.now ?? new Date().toISOString();
    const report = this.preflight.audit({
      id: request.reportId?.trim() || `kdp-preflight-${randomUUID()}`,
      projectId,
      publishing: plan.publishing,
      interiorHasBleed: request.interiorHasBleed,
      interior: request.interior,
      cover: request.cover,
      now,
    });
    const evidenceMemory = createMemoryRecord({
      id: `memory-${randomUUID()}`,
      projectId,
      class: "production-memory",
      authority: "working",
      summary: `KDP preflight ${report.status}: ${report.errorCount} error(s), ${report.warningCount} warning(s)`,
      content: JSON.stringify({ coverPlanId: plan.id, report }, null, 2),
      provenance: [{ kind: "system", reference: "studio-kdp-preflight", recordedAt: now }],
      relatedMemoryIds: [],
      relevanceTags: ["production", "kdp", "preflight", report.status],
    });
    const project = withProjectMemories(request.project, [...request.project.memories, evidenceMemory], now);
    return Object.freeze({ report, coverPlanId: plan.id, evidenceMemory, project });
  }
}

function resolveCoverPlan(project: ProjectState, coverPlanId?: string, bookId?: string): BookCoverPlan {
  const plans = project.bookCoverPlans ?? [];
  if (coverPlanId?.trim()) {
    const exact = plans.find((plan) => plan.id === coverPlanId.trim());
    if (!exact) throw new Error(`KDP preflight cover plan "${coverPlanId.trim()}" was not found.`);
    if (exact.publishing.platform !== "kdp") throw new Error("KDP preflight requires a KDP publishing configuration.");
    return exact;
  }
  const scoped = bookId?.trim() ? plans.filter((plan) => plan.bookId === bookId.trim()) : plans;
  const kdpPlans = scoped.filter((plan) => plan.publishing.platform === "kdp");
  if (!kdpPlans.length) throw new Error(bookId?.trim() ? `No KDP cover plan exists for book "${bookId.trim()}".` : "Create a KDP cover plan before running production preflight.");
  return kdpPlans[kdpPlans.length - 1];
}

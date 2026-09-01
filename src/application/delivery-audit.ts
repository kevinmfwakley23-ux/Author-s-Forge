import {
  createDeliveryAuditReport,
  validateDeliveryAuditReport,
  type DeliveryAuditCheck,
  type DeliveryAuditReport,
} from "../domain/delivery-audit";
import {
  withProjectDeliveryAudits,
  type ProjectState,
} from "../domain/project";

export interface RecordedDeliveryAudit {
  readonly project: ProjectState;
  readonly report: DeliveryAuditReport;
}

export class DeliveryAuditService {
  public audit(projectId: string, checks: readonly DeliveryAuditCheck[], generatedAt?: string): DeliveryAuditReport {
    return createDeliveryAuditReport({ projectId, checks, generatedAt });
  }

  public record(
    project: ProjectState,
    checks: readonly DeliveryAuditCheck[],
    generatedAt?: string,
    persistedAt?: string,
  ): RecordedDeliveryAudit {
    const report = this.audit(project.metadata.id, checks, generatedAt);
    return this.append(project, report, persistedAt);
  }

  public append(
    project: ProjectState,
    report: DeliveryAuditReport,
    persistedAt?: string,
  ): RecordedDeliveryAudit {
    const validated = validateDeliveryAuditReport(report);
    if (validated.projectId !== project.metadata.id) {
      throw new Error("Delivery audit belongs to another project.");
    }

    const next = withProjectDeliveryAudits(
      project,
      [...(project.deliveryAudits ?? []), validated],
      persistedAt ?? validated.generatedAt,
    );
    return Object.freeze({ project: next, report: validated });
  }
}

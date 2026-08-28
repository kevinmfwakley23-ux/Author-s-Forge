import { type DeliveryAuditCheck, type DeliveryAuditReport } from "../domain/delivery-audit";
export declare class DeliveryAuditService {
    audit(projectId: string, checks: readonly DeliveryAuditCheck[], generatedAt?: string): DeliveryAuditReport;
}

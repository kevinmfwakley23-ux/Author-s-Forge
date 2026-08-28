export declare const DELIVERY_AUDIT_FORMAT_VERSION: 1;
export declare const DELIVERY_AUDIT_CATEGORIES: readonly ["canon", "continuity", "timeline", "character", "pov", "style", "grammar", "formatting", "research", "artwork", "cover", "metadata", "publishing"];
export type DeliveryAuditCategory = typeof DELIVERY_AUDIT_CATEGORIES[number];
export type DeliveryAuditSeverity = "critical" | "warning" | "info";
export interface DeliveryAuditCheck {
    readonly id: string;
    readonly category: DeliveryAuditCategory;
    readonly passed: boolean;
    readonly severity: DeliveryAuditSeverity;
    readonly message: string;
    readonly remediation?: string;
}
export interface DeliveryAuditReport {
    readonly formatVersion: typeof DELIVERY_AUDIT_FORMAT_VERSION;
    readonly projectId: string;
    readonly generatedAt: string;
    readonly checks: readonly DeliveryAuditCheck[];
    readonly status: "ready-for-author-approval" | "attention" | "blocked";
    readonly passedCount: number;
    readonly attentionCount: number;
}
export declare function createDeliveryAuditReport(input: {
    projectId: string;
    checks: readonly DeliveryAuditCheck[];
    generatedAt?: string;
}): DeliveryAuditReport;
export declare function validateDeliveryAuditReport(r: DeliveryAuditReport): DeliveryAuditReport;

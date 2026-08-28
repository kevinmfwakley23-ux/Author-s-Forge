"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DELIVERY_AUDIT_CATEGORIES = exports.DELIVERY_AUDIT_FORMAT_VERSION = void 0;
exports.createDeliveryAuditReport = createDeliveryAuditReport;
exports.validateDeliveryAuditReport = validateDeliveryAuditReport;
exports.DELIVERY_AUDIT_FORMAT_VERSION = 1;
exports.DELIVERY_AUDIT_CATEGORIES = ["canon", "continuity", "timeline", "character", "pov", "style", "grammar", "formatting", "research", "artwork", "cover", "metadata", "publishing"];
function createDeliveryAuditReport(input) { if (!input.projectId.trim())
    throw new Error("Project id is required."); const ids = new Set(); for (const c of input.checks) {
    if (!c.id.trim())
        throw new Error("Audit check id is required.");
    if (ids.has(c.id))
        throw new Error(`Duplicate audit check id "${c.id}".`);
    ids.add(c.id);
    if (!exports.DELIVERY_AUDIT_CATEGORIES.includes(c.category))
        throw new Error(`Unsupported audit category "${c.category}".`);
    if (!c.message.trim())
        throw new Error("Audit check message is required.");
} const checks = input.checks.map(c => Object.freeze({ ...c })); const failed = checks.filter(c => !c.passed); const critical = failed.some(c => c.severity === "critical"); return Object.freeze({ formatVersion: exports.DELIVERY_AUDIT_FORMAT_VERSION, projectId: input.projectId, generatedAt: input.generatedAt ?? new Date().toISOString(), checks, passedCount: checks.filter(c => c.passed).length, attentionCount: failed.length, status: critical ? "blocked" : failed.length ? "attention" : "ready-for-author-approval" }); }
function validateDeliveryAuditReport(r) { const rebuilt = createDeliveryAuditReport({ projectId: r.projectId, checks: r.checks, generatedAt: r.generatedAt }); if (rebuilt.passedCount !== r.passedCount || rebuilt.attentionCount !== r.attentionCount || rebuilt.status !== r.status)
    throw new Error("Delivery audit summary is inconsistent."); return rebuilt; }
//# sourceMappingURL=delivery-audit.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeliveryAuditService = void 0;
const delivery_audit_1 = require("../domain/delivery-audit");
class DeliveryAuditService {
    audit(projectId, checks, generatedAt) { return (0, delivery_audit_1.createDeliveryAuditReport)({ projectId, checks, generatedAt }); }
}
exports.DeliveryAuditService = DeliveryAuditService;
//# sourceMappingURL=delivery-audit.js.map
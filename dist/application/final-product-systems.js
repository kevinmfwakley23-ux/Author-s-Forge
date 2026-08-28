"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinalProductAuditService = exports.BookGenomeService = exports.GovernanceService = exports.CapabilityEscalationService = void 0;
const final_product_systems_1 = require("../domain/final-product-systems");
class CapabilityEscalationService {
    request(input) { return (0, final_product_systems_1.createCapabilityGap)(input); }
    advance(gap, status, note, now) { return (0, final_product_systems_1.advanceCapabilityGap)(gap, status, note, now); }
}
exports.CapabilityEscalationService = CapabilityEscalationService;
class GovernanceService {
    ownershipPolicy() { return (0, final_product_systems_1.defaultOwnershipPolicy)(); }
    accessibilityProfile(overrides) { return { ...(0, final_product_systems_1.defaultAccessibilityProfile)(), ...(overrides ?? {}) }; }
    provenance(input) { if ((input.kind === "real-person" || input.kind === "user-uploaded") && input.consentStatus !== "granted")
        throw new Error("Consent must be granted before processing this creative source."); return (0, final_product_systems_1.createCreativeProvenance)(input); }
    voiceCommand(input) { return (0, final_product_systems_1.createVoiceCommand)(input); }
}
exports.GovernanceService = GovernanceService;
class BookGenomeService {
    create(input) { return (0, final_product_systems_1.createBookGenome)(input); }
    impact(genome, changedNodeId) { return (0, final_product_systems_1.identifyGenomeImpact)(genome, changedNodeId); }
}
exports.BookGenomeService = BookGenomeService;
class FinalProductAuditService {
    run(input) { return (0, final_product_systems_1.createFinalProductAudit)(input); }
}
exports.FinalProductAuditService = FinalProductAuditService;
//# sourceMappingURL=final-product-systems.js.map
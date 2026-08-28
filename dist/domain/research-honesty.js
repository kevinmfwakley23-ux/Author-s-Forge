"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESEARCH_HONESTY_CLASSES = exports.RESEARCH_HONESTY_FORMAT_VERSION = void 0;
exports.createResearchHonestyRecord = createResearchHonestyRecord;
exports.isResearchHonest = isResearchHonest;
exports.assertResearchHonest = assertResearchHonest;
exports.RESEARCH_HONESTY_FORMAT_VERSION = 1;
exports.RESEARCH_HONESTY_CLASSES = ["known-fact", "source-supported", "likely-inference", "creative-fiction", "uncertain"];
function createResearchHonestyRecord(input) {
    required(input.id, "Research honesty id");
    required(input.projectId, "Research honesty project id");
    required(input.claimId, "Research claim id");
    required(input.explanation, "Research honesty explanation");
    if (!exports.RESEARCH_HONESTY_CLASSES.includes(input.classification))
        throw new Error(`Unknown research honesty classification "${input.classification}".`);
    if (!["none", "indirect", "direct"].includes(input.evidenceStrength))
        throw new Error(`Unknown evidence strength "${input.evidenceStrength}".`);
    const sourceBacked = input.sourceBacked ?? input.evidenceStrength === "direct";
    if (input.classification === "known-fact" && (!sourceBacked || input.evidenceStrength !== "direct"))
        throw new Error("Known facts require source-backed evidence.");
    if (input.classification === "source-supported" && (!sourceBacked || input.evidenceStrength !== "direct"))
        throw new Error("Source-supported claims require source-backed evidence.");
    if (input.classification === "likely-inference" && input.evidenceStrength === "none")
        throw new Error("Likely inference requires at least indirect evidence.");
    if (input.classification === "creative-fiction" && sourceBacked)
        throw new Error("Creative fiction cannot be represented as source-backed research.");
    if (input.classification === "uncertain" && input.evidenceStrength === "direct")
        throw new Error("Uncertain claims cannot have direct evidence.");
    const assessedAt = input.now ?? new Date().toISOString();
    if (Number.isNaN(Date.parse(assessedAt)))
        throw new Error("Research assessment date must be a valid date.");
    const assessment = { id: input.id, claimId: input.claimId, classification: input.classification, evidenceStrength: input.evidenceStrength, explanation: input.explanation.trim(), sourceBacked, canonEligible: input.classification === "known-fact" || input.classification === "source-supported", assessedAt };
    return { ...assessment, projectId: input.projectId, assessment };
}
function isResearchHonest(record) { const a = record.assessment; if (a.classification === "known-fact" || a.classification === "source-supported")
    return a.sourceBacked && a.evidenceStrength === "direct"; if (a.classification === "likely-inference")
    return a.evidenceStrength !== "none"; if (a.classification === "creative-fiction")
    return !a.sourceBacked; return a.evidenceStrength !== "direct"; }
function assertResearchHonest(record) { if (!isResearchHonest(record))
    throw new Error(`Research honesty record "${record.id}" violates its evidence classification.`); }
function required(value, label) { if (!value.trim())
    throw new Error(`${label} is required.`); }
//# sourceMappingURL=research-honesty.js.map
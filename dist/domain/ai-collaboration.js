"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AI_COLLABORATION_MODES = exports.AI_COLLABORATION_FORMAT_VERSION = void 0;
exports.createAiCollaborationPolicy = createAiCollaborationPolicy;
exports.validateAiCollaborationPolicy = validateAiCollaborationPolicy;
exports.AI_COLLABORATION_FORMAT_VERSION = 1;
exports.AI_COLLABORATION_MODES = ["co-pilot", "partner", "director", "autonomous", "editor"];
const policies = {
    "co-pilot": { authorApprovalRequiredForMajorDecisions: true, aiMayDraft: true, aiMayRevise: true, aiMayExecuteBulkWork: false, description: "Author does most of the writing; Forge assists." },
    partner: { authorApprovalRequiredForMajorDecisions: true, aiMayDraft: true, aiMayRevise: true, aiMayExecuteBulkWork: true, description: "Author and Forge alternate work." },
    director: { authorApprovalRequiredForMajorDecisions: true, aiMayDraft: true, aiMayRevise: true, aiMayExecuteBulkWork: true, description: "Author directs at a high level; Forge performs most work." },
    autonomous: { authorApprovalRequiredForMajorDecisions: true, aiMayDraft: true, aiMayRevise: true, aiMayExecuteBulkWork: true, description: "Author approves major decisions; Forge performs bulk project work." },
    editor: { authorApprovalRequiredForMajorDecisions: true, aiMayDraft: false, aiMayRevise: true, aiMayExecuteBulkWork: false, description: "Forge primarily analyzes and improves existing work." }
};
function createAiCollaborationPolicy(mode) { if (!exports.AI_COLLABORATION_MODES.includes(mode))
    throw new Error(`Unsupported AI collaboration mode "${mode}".`); return Object.freeze({ mode, ...policies[mode] }); }
function validateAiCollaborationPolicy(p) { return createAiCollaborationPolicy(p.mode); }
//# sourceMappingURL=ai-collaboration.js.map
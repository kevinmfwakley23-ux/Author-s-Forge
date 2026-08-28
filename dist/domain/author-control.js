"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUTHOR_CONTROL_FORMAT_VERSION = void 0;
exports.createAuthorDecision = createAuthorDecision;
exports.validateAuthorDecision = validateAuthorDecision;
exports.applyAuthorOverride = applyAuthorOverride;
exports.lockCanon = lockCanon;
exports.resolveAuthorControl = resolveAuthorControl;
exports.isCanonLocked = isCanonLocked;
exports.AUTHOR_CONTROL_FORMAT_VERSION = 1;
const clone = (v) => JSON.parse(JSON.stringify(v));
const req = (v, n) => { if (typeof v !== "string" || !v.trim())
    throw new Error(`${n} is required.`); return v.trim(); };
function createAuthorDecision(input) { req(input.projectId, "Project id"); req(input.targetId, "Target id"); req(input.content, "Decision content"); req(input.reason, "Decision reason"); return clone({ ...input, id: input.id ?? `decision_${Date.now()}_${Math.random().toString(36).slice(2, 9)}` }); }
function validateAuthorDecision(v) { req(v.id, "Decision id"); req(v.projectId, "Project id"); req(v.targetId, "Target id"); req(v.content, "Decision content"); if (!["ai-suggestion", "ai-draft", "author-approved", "canon-locked", "author-override"].includes(v.status))
    throw new Error("Invalid author decision status."); return clone(v); }
function applyAuthorOverride(decisions, input) { const prior = decisions.filter(d => d.projectId === input.projectId && d.targetId === input.targetId); const latest = prior.at(-1); const next = createAuthorDecision({ id: input.id, projectId: input.projectId, targetId: input.targetId, status: "author-override", content: input.content, reason: input.reason, createdAt: input.createdAt ?? new Date().toISOString(), supersedesId: latest?.id }); return [...decisions.map(validateAuthorDecision), next]; }
function lockCanon(decisions, input) { const next = createAuthorDecision({ id: input.id, projectId: input.projectId, targetId: input.targetId, status: "canon-locked", content: input.content, reason: input.reason ?? "Author locked this state as canon.", createdAt: input.createdAt ?? new Date().toISOString(), supersedesId: decisions.filter(d => d.projectId === input.projectId && d.targetId === input.targetId).at(-1)?.id }); return [...decisions.map(validateAuthorDecision), next]; }
function resolveAuthorControl(decisions, projectId, targetId) { return decisions.filter(d => d.projectId === projectId && d.targetId === targetId).map(validateAuthorDecision).at(-1); }
function isCanonLocked(decisions, projectId, targetId) { return resolveAuthorControl(decisions, projectId, targetId)?.status === "canon-locked"; }
//# sourceMappingURL=author-control.js.map
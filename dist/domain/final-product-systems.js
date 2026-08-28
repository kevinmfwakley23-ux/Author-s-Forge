"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DELIVERY_AUDIT_CATEGORIES = exports.BOOK_GENOME_COMPONENTS = exports.FINAL_PRODUCT_FORMAT_VERSION = void 0;
exports.createCapabilityGap = createCapabilityGap;
exports.advanceCapabilityGap = advanceCapabilityGap;
exports.defaultOwnershipPolicy = defaultOwnershipPolicy;
exports.defaultAccessibilityProfile = defaultAccessibilityProfile;
exports.createVoiceCommand = createVoiceCommand;
exports.createCreativeProvenance = createCreativeProvenance;
exports.createBookGenome = createBookGenome;
exports.identifyGenomeImpact = identifyGenomeImpact;
exports.createFinalProductAudit = createFinalProductAudit;
exports.FINAL_PRODUCT_FORMAT_VERSION = 1;
exports.BOOK_GENOME_COMPONENTS = ["premise", "theme", "genre", "voice", "canon", "characters", "relationships", "locations", "timeline", "events", "scenes", "objects", "clues", "reveals", "conflicts", "motivations", "research", "visual-identities", "art", "cover", "metadata", "publishing-state"];
exports.DELIVERY_AUDIT_CATEGORIES = ["canon", "continuity", "timeline", "characters", "pov", "style", "grammar", "formatting", "research", "artwork", "cover", "metadata", "publishing"];
function requiredText(value, label) { if (typeof value !== "string" || value.trim().length === 0)
    throw new Error(`${label} is required.`); return value.trim(); }
function assertProjectId(value) { return requiredText(value, "Project id"); }
function createCapabilityGap(input) { const now = input.now ?? new Date().toISOString(); return { id: requiredText(input.id, "Capability gap id"), projectId: assertProjectId(input.projectId), capability: requiredText(input.capability, "Capability"), reason: requiredText(input.reason, "Reason"), requestedAt: now, status: "requested", authority: "kings", auditTrail: [`${now}: Forge requested capability escalation.`] }; }
function advanceCapabilityGap(gap, status, note, now = new Date().toISOString()) { const allowed = { requested: ["researching", "rejected"], researching: ["planned", "rejected"], planned: ["building", "rejected"], building: ["testing", "rejected"], testing: ["verified", "building", "rejected"], verified: [], rejected: [] }; if (!allowed[gap.status].includes(status))
    throw new Error(`Invalid capability gap transition ${gap.status} -> ${status}.`); return { ...gap, status, auditTrail: [...gap.auditTrail, `${now}: ${requiredText(note, "Transition note")}`] }; }
function defaultOwnershipPolicy() { return { projectIsolation: true, encryptedAtRest: false, explicitPermissions: true, exportEnabled: true, deleteEnabled: true, auditHistory: true, silentExternalUploads: false, researchConsentRequired: true, imageProcessingConsentRequired: true, providerTransparency: true, localFirst: true }; }
function defaultAccessibilityProfile() { return { keyboard: true, mouse: true, touch: true, voice: true, screenReader: true, largeText: true, highContrast: true }; }
function createVoiceCommand(input) { return { id: requiredText(input.id, "Voice command id"), projectId: assertProjectId(input.projectId), transcript: requiredText(input.transcript, "Transcript"), capturedAt: input.capturedAt ?? new Date().toISOString(), intent: requiredText(input.intent, "Intent"), entities: { ...(input.entities ?? {}) }, source: "voice", originalPreserved: true }; }
function createCreativeProvenance(input) {
    const consentRequired = input.kind === "user-uploaded" || input.kind === "real-person" || input.kind === "trademarked";
    if (consentRequired && input.consentStatus !== "granted")
        throw new Error(`Consent must be granted for ${input.kind} creative provenance before the artifact can be used.`);
    if (input.consentStatus === "denied")
        throw new Error("Consent must be granted before creative provenance can be used.");
    return { id: requiredText(input.id, "Provenance id"), projectId: assertProjectId(input.projectId), artifactId: requiredText(input.artifactId, "Artifact id"), kind: input.kind, source: requiredText(input.source, "Source"), consentStatus: input.consentStatus, recordedAt: input.recordedAt ?? new Date().toISOString(), notes: input.notes?.trim() ?? "" };
}
function createBookGenome(input) { const projectId = assertProjectId(input.projectId); const ids = new Set(); for (const node of input.nodes) {
    requiredText(node.id, "Genome node id");
    if (ids.has(node.id))
        throw new Error(`Duplicate Book Genome node id "${node.id}".`);
    ids.add(node.id);
    if (!exports.BOOK_GENOME_COMPONENTS.includes(node.component))
        throw new Error(`Unsupported Book Genome component: ${node.component}.`);
    requiredText(node.label, "Genome node label");
} return { formatVersion: exports.FINAL_PRODUCT_FORMAT_VERSION, projectId, generatedAt: input.now ?? new Date().toISOString(), nodes: input.nodes.map(n => ({ id: n.id, component: n.component, label: n.label, references: [...n.references], metadata: { ...n.metadata } })) }; }
function identifyGenomeImpact(genome, changedNodeId) { const changed = genome.nodes.find(n => n.id === changedNodeId); if (!changed)
    throw new Error(`Unknown Book Genome node "${changedNodeId}".`); const affected = genome.nodes.filter(n => n.id !== changedNodeId && (n.references.includes(changedNodeId) || n.component !== changed.component && sharesReference(n, changed))); const components = [...new Set(affected.map(n => n.component))]; return { changedNodeId, affectedComponents: components, affectedNodeIds: affected.map(n => n.id), explanation: `Changing ${changed.label} may affect ${affected.length} downstream Book Genome node(s). Review those dependencies before accepting the canon change.`, requiresAuthorApproval: true }; }
function sharesReference(a, b) { return a.references.some(ref => b.references.includes(ref)); }
function createFinalProductAudit(input) { const projectId = assertProjectId(input.projectId); if (input.checks.length !== exports.DELIVERY_AUDIT_CATEGORIES.length)
    throw new Error(`Final product audit requires exactly ${exports.DELIVERY_AUDIT_CATEGORIES.length} audit categories.`); for (const check of input.checks)
    if (!exports.DELIVERY_AUDIT_CATEGORIES.includes(check.category))
        throw new Error(`Unsupported final audit category: ${check.category}.`); const categories = new Set(input.checks.map(c => c.category)); if (categories.size !== exports.DELIVERY_AUDIT_CATEGORIES.length || !exports.DELIVERY_AUDIT_CATEGORIES.every(category => categories.has(category)))
    throw new Error("Final product audit contains duplicate or missing categories."); const passed = input.checks.filter(c => c.passed).length; const attention = input.checks.filter(c => !c.passed && !c.blocking).length; const blocking = input.checks.filter(c => !c.passed && c.blocking).length; return { id: requiredText(input.id, "Audit id"), projectId, generatedAt: input.generatedAt ?? new Date().toISOString(), checks: input.checks.map(c => ({ ...c })), passed, attention, blocking, status: blocking > 0 ? "blocked" : attention > 0 ? "attention-required" : "ready-for-author-approval" }; }
//# sourceMappingURL=final-product-systems.js.map
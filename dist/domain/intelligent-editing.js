"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FINDING_KINDS = exports.EDITOR_ROLES = exports.EDITING_FORMAT_VERSION = void 0;
exports.createEditingDocument = createEditingDocument;
exports.createEditorialFinding = createEditorialFinding;
exports.createEditorialReport = createEditorialReport;
exports.validateEditorialReport = validateEditorialReport;
exports.EDITING_FORMAT_VERSION = 1;
exports.EDITOR_ROLES = ["developmental", "continuity", "line", "copy", "proofreading", "structural", "dialogue", "pacing", "character", "genre"];
exports.FINDING_KINDS = ["pacing", "character-consistency", "plot-hole", "continuity-conflict", "repetition", "weak-scene", "unresolved-thread", "unnecessary-exposition", "dialogue-problem", "pov-violation", "tense-inconsistency", "cliche", "overused-word", "sentence-rhythm", "chapter-balance", "genre-fit"];
function createEditingDocument(input) {
    if (!input.target.projectId.trim())
        throw new Error("Editing project id is required.");
    if (!input.target.manuscriptId.trim())
        throw new Error("Editing manuscript id is required.");
    if (!input.title.trim())
        throw new Error("Editing title is required.");
    if (!input.text.trim())
        throw new Error("Editing document text is required.");
    if (input.pov && !["first", "second", "third"].includes(input.pov))
        throw new Error(`Invalid POV "${input.pov}".`);
    if (input.tense && !["past", "present"].includes(input.tense))
        throw new Error(`Invalid tense "${input.tense}".`);
    return { ...input, title: input.title.trim() };
}
function createEditorialFinding(input) {
    if (!input.id.trim())
        throw new Error("Editorial finding id is required.");
    if (input.start < 0 || input.end < input.start)
        throw new Error("Editorial finding range is invalid.");
    if (input.confidence < 0 || input.confidence > 1)
        throw new Error("Editorial finding confidence must be between 0 and 1.");
    return Object.freeze({ ...input, manuscriptMutationAuthorized: false });
}
function createEditorialReport(input) {
    if (!input.id.trim())
        throw new Error("Editorial report id is required.");
    const ids = new Set();
    for (const finding of input.findings) {
        if (ids.has(finding.id))
            throw new Error(`Duplicate editorial finding identifier "${finding.id}".`);
        ids.add(finding.id);
    }
    return Object.freeze({ ...input, formatVersion: exports.EDITING_FORMAT_VERSION, manuscriptMutated: false });
}
function validateEditorialReport(report, sourceText) {
    if (report.formatVersion !== exports.EDITING_FORMAT_VERSION)
        throw new Error("Unsupported editorial report format version.");
    if (report.manuscriptMutated)
        throw new Error("Editorial analysis cannot mutate the manuscript.");
    const ids = new Set();
    for (const finding of report.findings) {
        if (ids.has(finding.id))
            throw new Error(`Duplicate editorial finding identifier "${finding.id}".`);
        ids.add(finding.id);
        if (finding.start < 0 || finding.end < finding.start || finding.end > sourceText.length)
            throw new Error(`Editorial finding "${finding.id}" has an invalid source range.`);
        if (sourceText.slice(finding.start, finding.end) !== finding.excerpt)
            throw new Error(`Editorial finding "${finding.id}" excerpt does not match source.`);
        if (finding.manuscriptMutationAuthorized !== false)
            throw new Error(`Editorial finding "${finding.id}" illegally authorizes mutation.`);
    }
}
//# sourceMappingURL=intelligent-editing.js.map
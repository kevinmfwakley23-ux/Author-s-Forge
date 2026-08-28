"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROJECT_HEALTH_FORMAT_VERSION = void 0;
exports.createProjectHealthReport = createProjectHealthReport;
exports.validateProjectHealthReport = validateProjectHealthReport;
exports.PROJECT_HEALTH_FORMAT_VERSION = 1;
const pct = (n) => { if (!Number.isFinite(n) || n < 0 || n > 100)
    throw new Error("Percentage must be between 0 and 100."); return n; };
function createProjectHealthReport(input) { if (!input.projectId.trim())
    throw new Error("Project id is required."); const m = input.metrics; if (m.chaptersComplete < 0 || m.chaptersTotal < 0 || m.chaptersComplete > m.chaptersTotal)
    throw new Error("Chapter completion is invalid."); if (m.wordCount < 0 || m.wordCountTarget !== undefined && m.wordCountTarget < 0)
    throw new Error("Word count is invalid."); for (const n of [m.criticalCanonConflicts, m.minorCanonConflicts, m.unresolvedPlotThreads, m.characters, m.locations, m.researchSources, m.illustrations])
    if (!Number.isInteger(n) || n < 0)
        throw new Error("Health counts must be non-negative integers."); pct(m.bookCompletionPercent); pct(m.marketingCompletionPercent); pct(m.publishingReadinessPercent); const status = m.criticalCanonConflicts > 0 ? "blocked" : m.unresolvedPlotThreads > 0 || m.minorCanonConflicts > 0 || m.publishingReadinessPercent < 100 ? "attention" : "healthy"; return Object.freeze({ formatVersion: exports.PROJECT_HEALTH_FORMAT_VERSION, projectId: input.projectId, generatedAt: input.generatedAt ?? new Date().toISOString(), metrics: Object.freeze({ ...m }), status }); }
function validateProjectHealthReport(r) { return createProjectHealthReport({ projectId: r.projectId, metrics: r.metrics, generatedAt: r.generatedAt }); }
//# sourceMappingURL=project-health.js.map
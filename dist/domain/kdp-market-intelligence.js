"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MARKET_INTELLIGENCE_TOPICS = exports.KDP_MARKET_INTELLIGENCE_FORMAT_VERSION = void 0;
exports.createKdpMarketIntelligenceReport = createKdpMarketIntelligenceReport;
exports.validateKdpMarketIntelligenceReport = validateKdpMarketIntelligenceReport;
exports.summarizeMarketIntelligence = summarizeMarketIntelligence;
exports.KDP_MARKET_INTELLIGENCE_FORMAT_VERSION = 1;
exports.MARKET_INTELLIGENCE_TOPICS = [
    "genre", "subgenre", "niche", "categories", "competing-titles", "publication-frequency",
    "reader-expectations", "pricing", "cover-conventions", "title-conventions", "keyword-opportunities",
    "emerging-niches", "underserved-niches", "comparable-books"
];
const DISCLAIMER = "This report describes observable market signals and research evidence. It is not a guarantee, forecast, or promise of sales, rankings, revenue, or commercial performance.";
function createKdpMarketIntelligenceReport(input) {
    const report = {
        formatVersion: exports.KDP_MARKET_INTELLIGENCE_FORMAT_VERSION,
        id: required(input.id, "Market intelligence id"),
        projectId: required(input.projectId, "Market intelligence project id"),
        ...(input.bookId ? { bookId: required(input.bookId, "Market intelligence book id") } : {}),
        question: required(input.question, "Market intelligence question"),
        market: required(input.market, "Market"),
        researchedAt: input.researchedAt ?? new Date().toISOString(),
        evidence: input.evidence.map(validateEvidence),
        signals: input.signals.map(validateSignal),
        comparableTitles: (input.comparableTitles ?? []).map(validateComparable),
        assessment: validateAssessment(input.assessment)
    };
    return validateKdpMarketIntelligenceReport(report);
}
function validateKdpMarketIntelligenceReport(report) {
    if (report.formatVersion !== exports.KDP_MARKET_INTELLIGENCE_FORMAT_VERSION)
        throw new Error("Unsupported KDP market intelligence format version.");
    required(report.id, "Market intelligence id");
    required(report.projectId, "Market intelligence project id");
    required(report.question, "Market intelligence question");
    required(report.market, "Market");
    if (!isIsoDate(report.researchedAt))
        throw new Error("Market intelligence researchedAt must be an ISO timestamp.");
    const evidence = report.evidence.map(validateEvidence);
    const evidenceIds = new Set();
    for (const item of evidence) {
        if (evidenceIds.has(item.id))
            throw new Error(`Duplicate market evidence id "${item.id}".`);
        evidenceIds.add(item.id);
    }
    const signals = report.signals.map(validateSignal);
    const signalIds = new Set();
    for (const signal of signals) {
        if (signalIds.has(signal.id))
            throw new Error(`Duplicate market signal id "${signal.id}".`);
        signalIds.add(signal.id);
        for (const id of signal.evidenceIds)
            if (!evidenceIds.has(id))
                throw new Error(`Market signal "${signal.id}" references missing evidence "${id}".`);
    }
    const comparableTitles = report.comparableTitles.map(validateComparable);
    const assessment = validateAssessment(report.assessment);
    if (assessment.disclaimer !== DISCLAIMER)
        throw new Error("Market opportunity assessment must use the required non-guarantee disclaimer.");
    return JSON.parse(JSON.stringify({ ...report, evidence, signals, comparableTitles, assessment }));
}
function summarizeMarketIntelligence(report) {
    const validated = validateKdpMarketIntelligenceReport(report);
    const attention = validated.assessment.limitations.length;
    return `${validated.assessment.level === "promising" || validated.assessment.level === "high" ? "Promising market signals" : "Market signals identified"}: ${validated.assessment.rationale} ${attention ? `${attention} limitation(s) apply.` : ""}`.trim();
}
function validateEvidence(value) {
    required(value.id, "Market evidence id");
    required(value.source, "Market evidence source");
    required(value.observation, "Market evidence observation");
    if (!isIsoDate(value.observedAt))
        throw new Error(`Market evidence "${value.id}" has an invalid observedAt timestamp.`);
    if (!["weak", "moderate", "strong"].includes(value.strength))
        throw new Error(`Market evidence "${value.id}" has an invalid strength.`);
    if (value.url !== undefined)
        required(value.url, "Market evidence URL");
    return { ...value };
}
function validateSignal(value) {
    required(value.id, "Market signal id");
    required(value.label, "Market signal label");
    required(value.observation, "Market signal observation");
    if (!exports.MARKET_INTELLIGENCE_TOPICS.includes(value.topic))
        throw new Error(`Unsupported market intelligence topic "${value.topic}".`);
    if (!["positive", "negative", "mixed", "neutral"].includes(value.direction))
        throw new Error(`Market signal "${value.id}" has an invalid direction.`);
    return { ...value, evidenceIds: [...value.evidenceIds] };
}
function validateComparable(value) {
    required(value.title, "Comparable title");
    required(value.observedAt, "Comparable title observedAt");
    if (!isIsoDate(value.observedAt))
        throw new Error(`Comparable title "${value.title}" has an invalid observedAt timestamp.`);
    if (value.price !== undefined && (!Number.isFinite(value.price) || value.price < 0))
        throw new Error(`Comparable title "${value.title}" has an invalid price.`);
    return { ...value };
}
function validateAssessment(value) {
    required(value.rationale, "Opportunity rationale");
    if (!["low", "moderate", "promising", "high"].includes(value.level))
        throw new Error("Invalid opportunity level.");
    if (!Array.isArray(value.signals) || !Array.isArray(value.limitations))
        throw new Error("Opportunity assessment signals and limitations must be arrays.");
    return { ...value, signals: [...value.signals], limitations: [...value.limitations], disclaimer: value.disclaimer ?? DISCLAIMER };
}
function required(value, label) { if (typeof value !== "string" || !value.trim())
    throw new Error(`${label} is required.`); return value.trim(); }
function isIsoDate(value) { return typeof value === "string" && Number.isFinite(Date.parse(value)); }
//# sourceMappingURL=kdp-market-intelligence.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESEARCH_DOMAINS = exports.RESEARCH_FORMAT_VERSION = void 0;
exports.createResearchClaim = createResearchClaim;
exports.createResearchRecord = createResearchRecord;
exports.RESEARCH_FORMAT_VERSION = 1;
exports.RESEARCH_DOMAINS = [
    "historical-period", "geography", "real-world-location", "travel-distance", "weather", "architecture",
    "clothing", "technology", "occupation", "political-environment", "cultural-practice", "terminology",
    "historical-event", "local-landmark", "regional-speech", "legal-environmental", "medical-scientific",
    "publishing", "market", "genre-trend", "reader-expectation", "comparable-book"
];
function createResearchClaim(input) {
    requireText(input.id, "Research claim id");
    requireText(input.projectId, "Research project id");
    requireText(input.source, "Research source");
    requireText(input.url, "Research URL");
    requireText(input.date, "Research date");
    requireText(input.claim, "Research claim");
    requireText(input.researchQuestion, "Research question");
    requireText(input.researchedBecause, "Research rationale");
    if (!/^https?:\/\//i.test(input.url))
        throw new Error("Research URL must use http or https.");
    if (Number.isNaN(Date.parse(input.date)))
        throw new Error("Research date must be a valid date.");
    return { ...input, createdAt: input.now ?? new Date().toISOString() };
}
function createResearchRecord(input) {
    requireText(input.id, "Research record id");
    requireText(input.projectId, "Research project id");
    requireText(input.question, "Research question");
    requireText(input.researchedBecause, "Research rationale");
    if (!input.claims.length)
        throw new Error("Research record requires at least one claim.");
    const claims = input.claims.map((claim) => createResearchClaim({ ...claim, projectId: input.projectId, domain: input.domain }));
    if (claims.some((claim) => claim.projectId !== input.projectId))
        throw new Error("Research claim belongs to another project.");
    return { id: input.id, projectId: input.projectId, question: input.question.trim(), researchedBecause: input.researchedBecause.trim(), domain: input.domain, claims, createdAt: input.now ?? new Date().toISOString() };
}
function requireText(value, label) { if (!value.trim())
    throw new Error(`${label} is required.`); }
//# sourceMappingURL=research.js.map
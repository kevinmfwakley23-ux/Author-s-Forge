"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StaticResearchProvider = exports.ResearchEngine = void 0;
const memory_1 = require("../domain/memory");
const research_1 = require("../domain/research");
class ResearchEngine {
    provider;
    memoryStore;
    constructor(provider, memoryStore) {
        this.provider = provider;
        this.memoryStore = memoryStore;
    }
    async research(request) {
        validateRequest(request);
        const results = await this.provider.research({ question: request.question.trim(), domain: request.domain, projectId: request.projectId });
        if (!results.length)
            throw new Error("Research provider returned no results.");
        const now = new Date().toISOString();
        const claims = results.map((result, index) => (0, research_1.createResearchClaim)({
            id: `${request.id}:claim-${index + 1}`, projectId: request.projectId, bookId: request.bookId, chapterId: request.chapterId,
            sceneId: request.sceneId, domain: request.domain, researchQuestion: request.question, researchedBecause: request.researchedBecause,
            source: result.source, date: result.date, url: result.url, claim: result.claim, confidence: result.confidence, relevance: result.relevance, now
        }));
        const record = (0, research_1.createResearchRecord)({ id: request.id, projectId: request.projectId, question: request.question, researchedBecause: request.researchedBecause, domain: request.domain, claims, now });
        const memories = claims.map((claim) => (0, memory_1.createMemoryRecord)({
            id: `research:${claim.id}`, projectId: request.projectId, class: "research-memory", authority: "working",
            summary: claim.claim, content: JSON.stringify(claim), provenance: [{ kind: "source", reference: claim.url, recordedAt: now }],
            relevanceTags: [request.domain, ...(request.bookId ? [`book:${request.bookId}`] : []), ...(request.chapterId ? [`chapter:${request.chapterId}`] : []), ...(request.sceneId ? [`scene:${request.sceneId}`] : [])], now
        }));
        memories.forEach((memory) => this.memoryStore.register(memory));
        return { record: cloneRecord(record), memories: memories.map(cloneMemory) };
    }
    retrieve(projectId, options = {}) {
        if (!projectId.trim())
            throw new Error("Research project id is required.");
        const tags = [options.bookId && `book:${options.bookId}`, options.chapterId && `chapter:${options.chapterId}`, options.sceneId && `scene:${options.sceneId}`].filter((v) => Boolean(v));
        return this.memoryStore.query({ projectId, class: "research-memory", relevanceTags: tags.length ? tags : undefined, limit: options.limit }).map((memory) => JSON.parse(memory.content)).filter((claim) => !options.domain || claim.domain === options.domain);
    }
    listProjectResearch(projectId) { return this.retrieve(projectId); }
}
exports.ResearchEngine = ResearchEngine;
class StaticResearchProvider {
    results;
    constructor(results) {
        this.results = results;
    }
    async research(_request) { return this.results.map((result) => ({ ...result })); }
}
exports.StaticResearchProvider = StaticResearchProvider;
function validateRequest(request) {
    for (const [value, label] of [[request.id, "Research id"], [request.projectId, "Research project id"], [request.question, "Research question"], [request.researchedBecause, "Research rationale"]])
        if (!value.trim())
            throw new Error(`${label} is required.`);
    if (!research_1.RESEARCH_DOMAINS.includes(request.domain))
        throw new Error(`Unsupported research domain "${request.domain}".`);
}
function cloneClaim(c) { return { ...c }; }
function cloneRecord(r) { return { ...r, claims: r.claims.map(cloneClaim) }; }
function cloneMemory(m) { return { ...m, provenance: m.provenance.map((p) => ({ ...p })), relatedMemoryIds: [...m.relatedMemoryIds], relevanceTags: [...m.relevanceTags] }; }
//# sourceMappingURL=research-engine.js.map
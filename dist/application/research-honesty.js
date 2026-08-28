"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResearchHonestyService = void 0;
const memory_1 = require("../domain/memory");
const research_honesty_1 = require("../domain/research-honesty");
class ResearchHonestyService {
    memoryStore;
    constructor(memoryStore) {
        this.memoryStore = memoryStore;
    }
    assess(input) {
        const record = (0, research_honesty_1.createResearchHonestyRecord)(input);
        (0, research_honesty_1.assertResearchHonest)(record);
        const now = record.assessedAt;
        const memory = (0, memory_1.createMemoryRecord)({
            id: `research-honesty:${record.id}`, projectId: record.projectId, class: "research-memory", authority: "working",
            summary: `${record.classification}: ${record.explanation}`, content: JSON.stringify(record),
            provenance: [{ kind: "source", reference: record.claimId, recordedAt: now }],
            relevanceTags: ["research-honesty", `claim:${record.claimId}`, `honesty:${record.classification}`], now,
        });
        this.memoryStore.register(memory);
        return clone(record);
    }
    get(query) {
        if (!query.projectId.trim())
            throw new Error("Research honesty project id is required.");
        return this.memoryStore.query({ projectId: query.projectId, class: "research-memory", relevanceTags: ["research-honesty"], limit: query.limit })
            .map(memory => JSON.parse(memory.content))
            .filter(record => !query.claimId || record.claimId === query.claimId)
            .filter(record => !query.classification || record.classification === query.classification)
            .filter(record => query.canonEligible === undefined || record.canonEligible === query.canonEligible)
            .filter(record => { (0, research_honesty_1.assertResearchHonest)(record); return true; });
    }
    summarize(projectId) {
        const records = this.get({ projectId });
        const byClassification = { "known-fact": 0, "source-supported": 0, "likely-inference": 0, "creative-fiction": 0, "uncertain": 0 };
        for (const record of records)
            byClassification[record.classification] += 1;
        const canonEligible = records.filter(r => r.canonEligible).length;
        return { projectId, total: records.length, byClassification, canonEligible, nonCanonEligible: records.length - canonEligible };
    }
}
exports.ResearchHonestyService = ResearchHonestyService;
function clone(record) { return { ...record }; }
//# sourceMappingURL=research-honesty.js.map
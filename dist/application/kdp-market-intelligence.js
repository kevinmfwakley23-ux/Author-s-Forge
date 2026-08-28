"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StaticKdpMarketIntelligenceProvider = exports.KdpMarketIntelligenceService = void 0;
const kdp_market_intelligence_1 = require("../domain/kdp-market-intelligence");
class KdpMarketIntelligenceService {
    provider;
    constructor(provider) {
        this.provider = provider;
    }
    async research(request) {
        validateRequest(request);
        const result = await this.provider.research({ projectId: request.projectId, bookId: request.bookId, question: request.question.trim(), market: request.market.trim() });
        if (!result.evidence.length)
            throw new Error("KDP market intelligence provider returned no evidence.");
        return (0, kdp_market_intelligence_1.createKdpMarketIntelligenceReport)({ ...request, evidence: result.evidence, signals: result.signals, comparableTitles: result.comparableTitles, assessment: result.assessment });
    }
}
exports.KdpMarketIntelligenceService = KdpMarketIntelligenceService;
class StaticKdpMarketIntelligenceProvider {
    result;
    constructor(result) {
        this.result = result;
    }
    async research(_request) {
        return JSON.parse(JSON.stringify(this.result));
    }
}
exports.StaticKdpMarketIntelligenceProvider = StaticKdpMarketIntelligenceProvider;
function validateRequest(request) {
    for (const [value, label] of [[request.id, "Market intelligence id"], [request.projectId, "Market intelligence project id"], [request.question, "Market intelligence question"], [request.market, "Market"]]) {
        if (typeof value !== "string" || !value.trim())
            throw new Error(`${label} is required.`);
    }
}
//# sourceMappingURL=kdp-market-intelligence.js.map
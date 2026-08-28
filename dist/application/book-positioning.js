"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StaticBookPositioningProvider = exports.BookPositioningService = void 0;
const book_positioning_1 = require("../domain/book-positioning");
class BookPositioningService {
    provider;
    constructor(provider) {
        this.provider = provider;
    }
    async create(request) { validate(request); const result = await this.provider.position({ ...request, projectId: request.projectId.trim(), manuscriptContext: request.manuscriptContext.trim(), comparableBooks: request.comparableBooks ?? [] }); return (0, book_positioning_1.createBookPositioningReport)({ id: request.id, projectId: request.projectId, bookId: request.bookId, positioning: result.positioning, concepts: result.concepts, evidence: result.evidence ?? [], limitations: result.limitations ?? [], disclaimer: "Positioning is a strategic interpretation of supplied manuscript and market evidence. It is not a guarantee of reader response, clicks, rankings, sales, revenue, or commercial performance." }); }
}
exports.BookPositioningService = BookPositioningService;
class StaticBookPositioningProvider {
    result;
    constructor(result) {
        this.result = result;
    }
    async position(_request) { return JSON.parse(JSON.stringify(this.result)); }
}
exports.StaticBookPositioningProvider = StaticBookPositioningProvider;
function validate(r) { for (const [v, l] of [[r.id, "Positioning id"], [r.projectId, "Positioning project id"], [r.manuscriptContext, "Manuscript context"]])
    if (typeof v !== "string" || !v.trim())
        throw new Error(`${l} is required.`); }
//# sourceMappingURL=book-positioning.js.map
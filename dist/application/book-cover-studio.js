"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookCoverStudioService = void 0;
const book_cover_studio_1 = require("../domain/book-cover-studio");
class BookCoverStudioService {
    plans = new Map();
    create(input) { const plan = (0, book_cover_studio_1.createBookCoverPlan)(input); if (this.plans.has(plan.id))
        throw new Error(`Duplicate book cover plan id "${plan.id}".`); this.plans.set(plan.id, plan); return clone(plan); }
    get(id) { const plan = this.plans.get(id); return plan ? clone(plan) : undefined; }
    require(id) { const plan = this.get(id); if (!plan)
        throw new Error(`Book cover plan "${id}" not found.`); return plan; }
    calculate(input) { return (0, book_cover_studio_1.calculateKdpCoverLayout)(input); }
    validate(id, file) { return (0, book_cover_studio_1.validateBookCoverFile)(this.require(id), file); }
    list(projectId) { return [...this.plans.values()].filter((p) => projectId === undefined || p.projectId === projectId).sort((a, b) => a.id.localeCompare(b.id)).map(clone); }
}
exports.BookCoverStudioService = BookCoverStudioService;
function clone(plan) { return { ...plan, publishing: { ...plan.publishing }, dimensions: { ...plan.dimensions }, zones: { ...plan.zones, front: { ...plan.zones.front }, spine: { ...plan.zones.spine }, back: { ...plan.zones.back }, barcodeSafeArea: { ...plan.zones.barcodeSafeArea }, trim: { ...plan.zones.trim } } }; }
//# sourceMappingURL=book-cover-studio.js.map
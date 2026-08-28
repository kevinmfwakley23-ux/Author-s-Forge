"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SERIES_FORMAT_VERSION = void 0;
exports.createSeries = createSeries;
exports.validateSeriesState = validateSeriesState;
exports.addBookToSeries = addBookToSeries;
exports.addSeriesTimelineEvent = addSeriesTimelineEvent;
exports.SERIES_FORMAT_VERSION = 1;
const clone = (v) => JSON.parse(JSON.stringify(v));
const req = (v, n) => { if (typeof v !== "string" || !v.trim())
    throw new Error(`${n} is required.`); return v.trim(); };
const unique = (xs, n) => { const out = [...new Set(xs.map(x => req(x, n)))]; if (out.length !== xs.length)
    throw new Error(`Duplicate ${n.toLowerCase()} in series state.`); return out; };
function createSeries(input) { return clone({ id: input.id ?? `series_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`, projectId: req(input.projectId, "Project id"), name: req(input.name, "Series name"), bookIds: unique(input.bookIds ?? [], "book id"), sharedCharacters: unique(input.sharedCharacters ?? [], "character id"), worldRules: unique(input.worldRules ?? [], "world rule"), visualIdentityIds: unique(input.visualIdentityIds ?? [], "visual identity id"), locations: unique(input.locations ?? [], "location"), terminology: unique(input.terminology ?? [], "term"), history: unique(input.history ?? [], "history item"), unresolvedThreads: unique(input.unresolvedThreads ?? [], "unresolved thread"), timeline: [...(input.timeline ?? [])] }); }
function validateSeriesState(v) { req(v.id, "Series id"); req(v.projectId, "Project id"); req(v.name, "Series name"); unique(v.bookIds, "book id"); unique(v.sharedCharacters, "character id"); unique(v.worldRules, "world rule"); unique(v.visualIdentityIds, "visual identity id"); unique(v.locations, "location"); unique(v.terminology, "term"); unique(v.history, "history item"); unique(v.unresolvedThreads, "unresolved thread"); for (const e of v.timeline) {
    req(e.id, "Timeline event id");
    req(e.bookId, "Timeline book id");
    req(e.date, "Timeline date");
    req(e.description, "Timeline description");
} return clone(v); }
function addBookToSeries(series, bookId) { req(bookId, "Book id"); if (series.bookIds.includes(bookId))
    throw new Error(`Book "${bookId}" is already in the series.`); return validateSeriesState({ ...series, bookIds: [...series.bookIds, bookId] }); }
function addSeriesTimelineEvent(series, event) { if (series.timeline.some(e => e.id === event.id))
    throw new Error(`Timeline event "${event.id}" already exists.`); if (!series.bookIds.includes(event.bookId))
    throw new Error(`Timeline event references book "${event.bookId}" outside the series.`); return validateSeriesState({ ...series, timeline: [...series.timeline, event] }); }
//# sourceMappingURL=series.js.map
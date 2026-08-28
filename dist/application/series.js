"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeriesService = void 0;
const series_1 = require("../domain/series");
class SeriesService {
    projectId;
    state;
    constructor(projectId, state) {
        this.projectId = projectId;
        this.state = state;
        if (state.projectId !== projectId)
            throw new Error("Series belongs to another project.");
        (0, series_1.validateSeriesState)(state);
    }
    getState() { return (0, series_1.validateSeriesState)(this.state); }
    addBook(bookId) { this.state = (0, series_1.addBookToSeries)(this.state, bookId); return this.getState(); }
    addTimelineEvent(event) { this.state = (0, series_1.addSeriesTimelineEvent)(this.state, event); return this.getState(); }
}
exports.SeriesService = SeriesService;
//# sourceMappingURL=series.js.map
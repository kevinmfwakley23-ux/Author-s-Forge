import { type SeriesState, type SeriesTimelineEvent } from "../domain/series";
export declare class SeriesService {
    private readonly projectId;
    private state;
    constructor(projectId: string, state: SeriesState);
    getState(): SeriesState;
    addBook(bookId: string): SeriesState;
    addTimelineEvent(event: SeriesTimelineEvent): SeriesState;
}

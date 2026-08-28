export declare const SERIES_FORMAT_VERSION: 1;
export interface SeriesState {
    readonly id: string;
    readonly projectId: string;
    readonly name: string;
    readonly bookIds: readonly string[];
    readonly sharedCharacters: readonly string[];
    readonly worldRules: readonly string[];
    readonly visualIdentityIds: readonly string[];
    readonly locations: readonly string[];
    readonly terminology: readonly string[];
    readonly history: readonly string[];
    readonly unresolvedThreads: readonly string[];
    readonly timeline: readonly SeriesTimelineEvent[];
}
export interface SeriesTimelineEvent {
    readonly id: string;
    readonly date: string;
    readonly bookId: string;
    readonly description: string;
}
export declare function createSeries(input: {
    id?: string;
    projectId: string;
    name: string;
    bookIds?: readonly string[];
    sharedCharacters?: readonly string[];
    worldRules?: readonly string[];
    visualIdentityIds?: readonly string[];
    locations?: readonly string[];
    terminology?: readonly string[];
    history?: readonly string[];
    unresolvedThreads?: readonly string[];
    timeline?: readonly SeriesTimelineEvent[];
}): SeriesState;
export declare function validateSeriesState(v: SeriesState): SeriesState;
export declare function addBookToSeries(series: SeriesState, bookId: string): SeriesState;
export declare function addSeriesTimelineEvent(series: SeriesState, event: SeriesTimelineEvent): SeriesState;

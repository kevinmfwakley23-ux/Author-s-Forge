export declare const BOOK_POSITIONING_FORMAT_VERSION: 1;
export interface PositioningComparable {
    readonly title: string;
    readonly author?: string;
    readonly reason: string;
}
export interface PositioningAnswer {
    readonly audience: string;
    readonly problemOrDesire: string;
    readonly genre: string;
    readonly shelf: string;
    readonly differentiation: string;
    readonly comparableBooks: readonly PositioningComparable[];
    readonly clickReason: string;
}
export interface PositioningConcepts {
    readonly titles: readonly string[];
    readonly subtitles: readonly string[];
    readonly hooks: readonly string[];
    readonly elevatorPitches: readonly string[];
    readonly backCoverCopy: string;
    readonly amazonDescription: string;
    readonly authorBio: string;
    readonly taglines: readonly string[];
    readonly promotionalHooks: readonly string[];
}
export interface BookPositioningReport {
    readonly formatVersion: typeof BOOK_POSITIONING_FORMAT_VERSION;
    readonly id: string;
    readonly projectId: string;
    readonly bookId?: string;
    readonly createdAt: string;
    readonly positioning: PositioningAnswer;
    readonly concepts: PositioningConcepts;
    readonly evidence: readonly string[];
    readonly limitations: readonly string[];
    readonly disclaimer: string;
}
export interface CreateBookPositioningReportInput extends Omit<BookPositioningReport, "formatVersion" | "createdAt"> {
    readonly createdAt?: string;
}
export declare const BOOK_POSITIONING_DISCLAIMER = "Positioning is a strategic interpretation of supplied manuscript and market evidence. It is not a guarantee of reader response, clicks, rankings, sales, revenue, or commercial performance.";
export declare function createBookPositioningReport(input: CreateBookPositioningReportInput): BookPositioningReport;
export declare function validateBookPositioningReport(report: BookPositioningReport): BookPositioningReport;

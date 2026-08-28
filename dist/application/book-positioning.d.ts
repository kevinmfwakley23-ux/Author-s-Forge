import { type BookPositioningReport, type PositioningComparable, type PositioningAnswer, type PositioningConcepts } from "../domain/book-positioning";
export interface BookPositioningRequest {
    readonly id: string;
    readonly projectId: string;
    readonly bookId?: string;
    readonly manuscriptContext: string;
    readonly marketContext?: string;
    readonly comparableBooks?: readonly PositioningComparable[];
}
export interface BookPositioningProviderRequest {
    readonly projectId: string;
    readonly bookId?: string;
    readonly manuscriptContext: string;
    readonly marketContext?: string;
    readonly comparableBooks: readonly PositioningComparable[];
}
export interface BookPositioningProviderResult {
    readonly positioning: PositioningAnswer;
    readonly concepts: PositioningConcepts;
    readonly evidence?: readonly string[];
    readonly limitations?: readonly string[];
}
export interface BookPositioningProvider {
    position(request: BookPositioningProviderRequest): Promise<BookPositioningProviderResult>;
}
export declare class BookPositioningService {
    private readonly provider;
    constructor(provider: BookPositioningProvider);
    create(request: BookPositioningRequest): Promise<BookPositioningReport>;
}
export declare class StaticBookPositioningProvider implements BookPositioningProvider {
    private readonly result;
    constructor(result: BookPositioningProviderResult);
    position(_request: BookPositioningProviderRequest): Promise<BookPositioningProviderResult>;
}

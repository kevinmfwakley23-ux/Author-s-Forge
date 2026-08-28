export type AuthorInputMode = "typed" | "dictated" | "imported" | "pasted";
export type AuthorInputIntent = "content" | "new-chapter" | "scene-break" | "save-note" | "rewrite" | "expand" | "unknown-command";
export interface TranscriptProvenance {
    readonly provider?: string;
    readonly language?: string;
    readonly capturedAt?: string;
    readonly confidence?: number;
}
export interface AuthorInput {
    readonly id: string;
    readonly mode: AuthorInputMode;
    readonly text: string;
    readonly originalText: string;
    readonly createdAt: string;
    readonly provenance?: TranscriptProvenance;
}
export interface ClassifiedAuthorInput {
    readonly input: AuthorInput;
    readonly intent: AuthorInputIntent;
    readonly commandText?: string;
}
export declare function createAuthorInput(input: {
    id: string;
    mode: AuthorInputMode;
    text: string;
    createdAt?: string;
    provenance?: TranscriptProvenance;
}): AuthorInput;

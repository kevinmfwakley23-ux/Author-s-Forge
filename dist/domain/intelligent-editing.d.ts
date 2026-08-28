export declare const EDITING_FORMAT_VERSION: 1;
export type EditorRole = "developmental" | "continuity" | "line" | "copy" | "proofreading" | "structural" | "dialogue" | "pacing" | "character" | "genre";
export type FindingSeverity = "info" | "suggestion" | "warning" | "critical";
export type FindingKind = "pacing" | "character-consistency" | "plot-hole" | "continuity-conflict" | "repetition" | "weak-scene" | "unresolved-thread" | "unnecessary-exposition" | "dialogue-problem" | "pov-violation" | "tense-inconsistency" | "cliche" | "overused-word" | "sentence-rhythm" | "chapter-balance" | "genre-fit";
export interface EditingTarget {
    readonly projectId: string;
    readonly manuscriptId: string;
    readonly chapterId?: string;
    readonly sceneId?: string;
}
export interface EditingDocument {
    readonly target: EditingTarget;
    readonly title: string;
    readonly text: string;
    readonly pov?: "first" | "second" | "third";
    readonly tense?: "past" | "present";
    readonly expectedCharacterNames?: readonly string[];
    readonly requiredFacts?: readonly string[];
    readonly unresolvedThreads?: readonly string[];
    readonly genreExpectations?: readonly string[];
}
export interface EditorialFinding {
    readonly id: string;
    readonly role: EditorRole;
    readonly kind: FindingKind;
    readonly severity: FindingSeverity;
    readonly message: string;
    readonly recommendation: string;
    readonly start: number;
    readonly end: number;
    readonly excerpt: string;
    readonly confidence: number;
    readonly manuscriptMutationAuthorized: false;
}
export interface EditorialReport {
    readonly formatVersion: typeof EDITING_FORMAT_VERSION;
    readonly id: string;
    readonly target: EditingTarget;
    readonly roles: readonly EditorRole[];
    readonly findings: readonly EditorialFinding[];
    readonly summary: string;
    readonly generatedAt: string;
    readonly manuscriptMutated: false;
}
export declare const EDITOR_ROLES: readonly EditorRole[];
export declare const FINDING_KINDS: readonly FindingKind[];
export declare function createEditingDocument(input: EditingDocument): EditingDocument;
export declare function createEditorialFinding(input: Omit<EditorialFinding, "manuscriptMutationAuthorized">): EditorialFinding;
export declare function createEditorialReport(input: Omit<EditorialReport, "formatVersion" | "manuscriptMutated">): EditorialReport;
export declare function validateEditorialReport(report: EditorialReport, sourceText: string): void;

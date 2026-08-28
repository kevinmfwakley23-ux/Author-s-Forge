export declare const AUTHOR_CONTROL_FORMAT_VERSION: 1;
export type AuthorDecisionStatus = "ai-suggestion" | "ai-draft" | "author-approved" | "canon-locked" | "author-override";
export interface AuthorDecision {
    readonly id: string;
    readonly projectId: string;
    readonly targetId: string;
    readonly status: AuthorDecisionStatus;
    readonly content: string;
    readonly reason: string;
    readonly createdAt: string;
    readonly supersedesId?: string;
}
export declare function createAuthorDecision(input: Omit<AuthorDecision, "id"> & {
    id?: string;
}): AuthorDecision;
export declare function validateAuthorDecision(v: AuthorDecision): AuthorDecision;
export declare function applyAuthorOverride(decisions: readonly AuthorDecision[], input: {
    id?: string;
    projectId: string;
    targetId: string;
    content: string;
    reason: string;
    createdAt?: string;
}): AuthorDecision[];
export declare function lockCanon(decisions: readonly AuthorDecision[], input: {
    id?: string;
    projectId: string;
    targetId: string;
    content: string;
    reason?: string;
    createdAt?: string;
}): AuthorDecision[];
export declare function resolveAuthorControl(decisions: readonly AuthorDecision[], projectId: string, targetId: string): AuthorDecision | undefined;
export declare function isCanonLocked(decisions: readonly AuthorDecision[], projectId: string, targetId: string): boolean;

import { type AuthorDecision } from "../domain/author-control";
export declare class AuthorControlService {
    private readonly projectId;
    private decisions;
    constructor(projectId: string, decisions?: AuthorDecision[]);
    suggest(targetId: string, content: string, reason: string): AuthorDecision;
    draft(targetId: string, content: string, reason: string): AuthorDecision;
    approve(targetId: string, content: string, reason?: string): AuthorDecision;
    override(targetId: string, content: string, reason?: string): AuthorDecision;
    lock(targetId: string, content: string, reason?: string): AuthorDecision;
    resolve(targetId: string): AuthorDecision | undefined;
    history(): readonly AuthorDecision[];
    private add;
}

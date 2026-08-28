import { type BookSnapshot, type BookVersionBranch, type BookVersionComparison, type BookVersionHistory } from "../domain/book-version-control";
export declare class BookVersionControlService {
    private readonly history;
    constructor(history: BookVersionHistory);
    snapshot(v: BookSnapshot): BookSnapshot;
    compare(fromId: string, toId: string): BookVersionComparison;
    restore(versionId: string): BookSnapshot;
    createBranch(name: string, baseVersionId: string): BookVersionBranch;
    merge(targetId: string, sourceId: string, baseId: string): BookSnapshot;
    private find;
}

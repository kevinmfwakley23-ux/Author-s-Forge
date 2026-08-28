export declare const BOOK_VERSION_CONTROL_FORMAT_VERSION: 1;
export type BookVersionLabel = "draft-1" | "draft-2" | "draft-3" | "final" | "published" | "custom";
export interface BookSnapshot {
    readonly id: string;
    readonly projectId: string;
    readonly bookId: string;
    readonly label: BookVersionLabel;
    readonly name: string;
    readonly createdAt: string;
    readonly manuscript: string;
    readonly chapters: Readonly<Record<string, string>>;
    readonly parentId?: string;
}
export interface VersionChange {
    readonly chapterId: string;
    readonly kind: "added" | "removed" | "changed";
    readonly before?: string;
    readonly after?: string;
}
export interface BookVersionComparison {
    readonly fromId: string;
    readonly toId: string;
    readonly changes: readonly VersionChange[];
    readonly changedChapterCount: number;
    readonly identical: boolean;
}
export interface BookVersionBranch {
    readonly id: string;
    readonly projectId: string;
    readonly bookId: string;
    readonly name: string;
    readonly baseVersionId: string;
    readonly headVersionId: string;
    readonly createdAt: string;
}
export interface BookVersionHistory {
    readonly projectId: string;
    readonly bookId: string;
    readonly versions: readonly BookSnapshot[];
    readonly branches: readonly BookVersionBranch[];
}
export declare function createBookSnapshot(input: Omit<BookSnapshot, "id"> & {
    id?: string;
}): BookSnapshot;
export declare function validateBookSnapshot(v: BookSnapshot): BookSnapshot;
export declare function compareBookVersions(from: BookSnapshot, to: BookSnapshot): BookVersionComparison;
export declare function rollbackVersion(history: BookVersionHistory, versionId: string): BookSnapshot;
export declare function branchVersion(history: BookVersionHistory, input: {
    id?: string;
    name: string;
    baseVersionId: string;
    createdAt?: string;
}): BookVersionBranch;
export declare function mergeVersions(target: BookSnapshot, source: BookSnapshot, base: BookSnapshot): BookSnapshot;

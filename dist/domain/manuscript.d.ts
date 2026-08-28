export declare const MANUSCRIPT_FORMAT_VERSION: 1;
export type BookLifecycle = "planned" | "active" | "completed" | "archived";
export type ChapterLifecycle = "planned" | "drafting" | "complete" | "archived";
export type SceneLifecycle = "planned" | "drafting" | "complete" | "archived";
export interface BookRecord {
    readonly id: string;
    readonly projectId: string;
    readonly title: string;
    readonly lifecycle: BookLifecycle;
    readonly chapterIds: readonly string[];
}
export interface ChapterRecord {
    readonly id: string;
    readonly bookId: string;
    readonly number: number;
    readonly title: string;
    readonly lifecycle: ChapterLifecycle;
    readonly sceneIds: readonly string[];
}
export interface SceneRecord {
    readonly id: string;
    readonly chapterId: string;
    readonly order: number;
    readonly title: string;
    readonly lifecycle: SceneLifecycle;
}
export interface ManuscriptState {
    readonly formatVersion: typeof MANUSCRIPT_FORMAT_VERSION;
    readonly books: readonly BookRecord[];
    readonly chapters: readonly ChapterRecord[];
    readonly scenes: readonly SceneRecord[];
}
export declare function createManuscriptState(): ManuscriptState;
export declare function createBook(input: {
    id: string;
    projectId: string;
    title: string;
    lifecycle?: BookLifecycle;
}): BookRecord;
export declare function createChapter(input: {
    id: string;
    bookId: string;
    number: number;
    title: string;
    lifecycle?: ChapterLifecycle;
}): ChapterRecord;
export declare function createScene(input: {
    id: string;
    chapterId: string;
    order: number;
    title: string;
    lifecycle?: SceneLifecycle;
}): SceneRecord;
export declare function addBook(state: ManuscriptState, book: BookRecord): ManuscriptState;
export declare function addChapter(state: ManuscriptState, chapter: ChapterRecord): ManuscriptState;
export declare function addScene(state: ManuscriptState, scene: SceneRecord): ManuscriptState;
export declare const insertChapter: typeof addChapter;
export declare const insertScene: typeof addScene;
export declare function validateManuscriptState(state: ManuscriptState): void;

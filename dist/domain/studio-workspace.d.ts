export declare const STUDIO_WORKSPACE_FORMAT_VERSION: 1;
export type BookKind = "childrens-book" | "memoir" | "psychological-thriller" | "guided-journal" | "comic-book" | "training-manual" | "novel" | "other";
export type WorkspaceLifecycle = "planned" | "active" | "complete" | "archived";
export interface WorkspaceScene {
    readonly id: string;
    readonly number: number;
    readonly title: string;
    readonly lifecycle: WorkspaceLifecycle;
    readonly synopsis: string;
    readonly content: string;
    readonly wordCount: number;
    readonly updatedAt: string;
}
export interface WorkspaceChapter {
    readonly id: string;
    readonly number: number;
    readonly title: string;
    readonly lifecycle: WorkspaceLifecycle;
    readonly synopsis: string;
    readonly scenes: readonly WorkspaceScene[];
    readonly updatedAt: string;
}
export interface WorkspaceBook {
    readonly id: string;
    readonly title: string;
    readonly kind: BookKind;
    readonly lifecycle: WorkspaceLifecycle;
    readonly description: string;
    readonly chapters: readonly WorkspaceChapter[];
    readonly updatedAt: string;
}
export interface StudioWorkspaceState {
    readonly formatVersion: typeof STUDIO_WORKSPACE_FORMAT_VERSION;
    readonly activeBookId: string | null;
    readonly books: readonly WorkspaceBook[];
}
export declare function createStudioWorkspace(): StudioWorkspaceState;
export declare function validateStudioWorkspace(value: unknown): StudioWorkspaceState;
export declare function createWorkspaceBook(input: {
    id: string;
    title: string;
    kind?: BookKind;
    description?: string;
    now?: string;
}): WorkspaceBook;
export declare function addWorkspaceBook(state: StudioWorkspaceState, book: WorkspaceBook): StudioWorkspaceState;
export declare function addWorkspaceChapter(state: StudioWorkspaceState, bookId: string, input: {
    id: string;
    number: number;
    title: string;
    synopsis?: string;
    now?: string;
}): StudioWorkspaceState;
export declare function addWorkspaceScene(state: StudioWorkspaceState, bookId: string, chapterId: string, input: {
    id: string;
    number: number;
    title: string;
    synopsis?: string;
    now?: string;
}): StudioWorkspaceState;
export declare function saveSceneContent(state: StudioWorkspaceState, bookId: string, chapterId: string, sceneId: string, content: string, now?: string): StudioWorkspaceState;
export declare function setActiveBook(state: StudioWorkspaceState, bookId: string): StudioWorkspaceState;
export declare function getBook(state: StudioWorkspaceState, bookId: string): WorkspaceBook;
export declare function getChapter(book: WorkspaceBook, chapterId: string): WorkspaceChapter;
export declare function getScene(book: WorkspaceBook, chapterId: string, sceneId: string): WorkspaceScene;
export declare function countWords(value: string): number;

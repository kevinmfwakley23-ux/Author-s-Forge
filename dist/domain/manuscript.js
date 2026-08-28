"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertScene = exports.insertChapter = exports.MANUSCRIPT_FORMAT_VERSION = void 0;
exports.createManuscriptState = createManuscriptState;
exports.createBook = createBook;
exports.createChapter = createChapter;
exports.createScene = createScene;
exports.addBook = addBook;
exports.addChapter = addChapter;
exports.addScene = addScene;
exports.validateManuscriptState = validateManuscriptState;
exports.MANUSCRIPT_FORMAT_VERSION = 1;
const BOOK_LIFECYCLES = ["planned", "active", "completed", "archived"];
const CHAPTER_LIFECYCLES = ["planned", "drafting", "complete", "archived"];
const SCENE_LIFECYCLES = ["planned", "drafting", "complete", "archived"];
function createManuscriptState() { return { formatVersion: exports.MANUSCRIPT_FORMAT_VERSION, books: [], chapters: [], scenes: [] }; }
function createBook(input) { const lifecycle = input.lifecycle ?? "planned"; return { id: identifier(input.id, "Book id"), projectId: identifier(input.projectId, "Book project id"), title: text(input.title, "Book title"), lifecycle: validLifecycle(lifecycle, BOOK_LIFECYCLES, "book"), chapterIds: [] }; }
function createChapter(input) { const lifecycle = input.lifecycle ?? "planned"; return { id: identifier(input.id, "Chapter id"), bookId: identifier(input.bookId, "Chapter book id"), number: positiveInteger(input.number, "Chapter number"), title: text(input.title, "Chapter title"), lifecycle: validLifecycle(lifecycle, CHAPTER_LIFECYCLES, "chapter"), sceneIds: [] }; }
function createScene(input) { const lifecycle = input.lifecycle ?? "planned"; return { id: identifier(input.id, "Scene id"), chapterId: identifier(input.chapterId, "Scene chapter id"), order: positiveInteger(input.order, "Scene order"), title: text(input.title, "Scene title"), lifecycle: validLifecycle(lifecycle, SCENE_LIFECYCLES, "scene"), }; }
function addBook(state, book) { validateManuscriptState(state); validateBook(book); assertUniqueId(state, book.id); return cloneState({ ...state, books: [...state.books, cloneBook(book)] }); }
function addChapter(state, chapter) { validateManuscriptState(state); validateChapter(chapter); const parent = state.books.find((book) => book.id === chapter.bookId); if (!parent)
    throw new Error(`Unknown book "${chapter.bookId}".`); assertUniqueId(state, chapter.id); if (state.chapters.some((item) => item.bookId === chapter.bookId && item.number === chapter.number))
    throw new Error(`Duplicate chapter number ${chapter.number} in book "${chapter.bookId}".`); const chapters = [...state.chapters, cloneChapter(chapter)]; const books = state.books.map((book) => book.id === chapter.bookId ? { ...book, chapterIds: sortChapterIds([...book.chapterIds, chapter.id], chapters) } : cloneBook(book)); return cloneState({ ...state, books, chapters }); }
function addScene(state, scene) { validateManuscriptState(state); validateScene(scene); const parent = state.chapters.find((chapter) => chapter.id === scene.chapterId); if (!parent)
    throw new Error(`Unknown chapter "${scene.chapterId}".`); assertUniqueId(state, scene.id); if (state.scenes.some((item) => item.chapterId === scene.chapterId && item.order === scene.order))
    throw new Error(`Duplicate scene order ${scene.order} in chapter "${scene.chapterId}".`); const scenes = [...state.scenes, cloneScene(scene)]; const chapters = state.chapters.map((chapter) => chapter.id === scene.chapterId ? { ...chapter, sceneIds: sortSceneIds([...chapter.sceneIds, scene.id], scenes) } : cloneChapter(chapter)); return cloneState({ ...state, chapters, scenes }); }
exports.insertChapter = addChapter;
exports.insertScene = addScene;
function validateManuscriptState(state) {
    if (state.formatVersion !== exports.MANUSCRIPT_FORMAT_VERSION)
        throw new Error("Unsupported manuscript format version.");
    const ids = new Set();
    for (const book of state.books) {
        validateBook(book);
        unique(ids, book.id);
    }
    for (const chapter of state.chapters) {
        validateChapter(chapter);
        unique(ids, chapter.id);
    }
    for (const scene of state.scenes) {
        validateScene(scene);
        unique(ids, scene.id);
    }
    // Validate parent existence before reverse relationship checks so an orphaned
    // child is reported as an unknown parent rather than a generic relationship error.
    for (const chapter of state.chapters) {
        if (!state.books.some((book) => book.id === chapter.bookId))
            throw new Error(`Chapter "${chapter.id}" references unknown book "${chapter.bookId}".`);
    }
    for (const scene of state.scenes) {
        if (!state.chapters.some((chapter) => chapter.id === scene.chapterId))
            throw new Error(`Scene "${scene.id}" references unknown chapter "${scene.chapterId}".`);
    }
    for (const book of state.books) {
        const children = state.chapters.filter((chapter) => chapter.bookId === book.id);
        const childIds = new Set(book.chapterIds);
        if (childIds.size !== book.chapterIds.length)
            throw new Error(`Duplicate chapter reference in book "${book.id}".`);
        const missing = book.chapterIds.find((id) => !state.chapters.some((chapter) => chapter.id === id));
        if (missing)
            throw new Error(`Book "${book.id}" references unknown chapter "${missing}".`);
        const wrongParent = book.chapterIds.find((id) => state.chapters.some((chapter) => chapter.id === id && chapter.bookId !== book.id));
        if (wrongParent)
            throw new Error(`Book "${book.id}" has an invalid chapter relationship.`);
        if (children.length !== book.chapterIds.length || children.some((chapter) => !childIds.has(chapter.id)))
            throw new Error(`Book "${book.id}" has an invalid chapter relationship.`);
        if (!same(book.chapterIds, sortChapterIds(children.map((chapter) => chapter.id), state.chapters)))
            throw new Error(`Book "${book.id}" has non-deterministic chapter ordering.`);
        if (new Set(children.map((chapter) => chapter.number)).size !== children.length)
            throw new Error(`Duplicate chapter number in book "${book.id}".`);
    }
    for (const chapter of state.chapters) {
        const parent = state.books.find((book) => book.id === chapter.bookId);
        if (!parent.chapterIds.includes(chapter.id))
            throw new Error(`Book "${chapter.bookId}" is missing chapter "${chapter.id}".`);
        const children = state.scenes.filter((scene) => scene.chapterId === chapter.id);
        const childIds = new Set(chapter.sceneIds);
        if (childIds.size !== chapter.sceneIds.length)
            throw new Error(`Duplicate scene reference in chapter "${chapter.id}".`);
        const missing = chapter.sceneIds.find((id) => !state.scenes.some((scene) => scene.id === id));
        if (missing)
            throw new Error(`Chapter "${chapter.id}" references unknown scene "${missing}".`);
        const wrongParent = chapter.sceneIds.find((id) => state.scenes.some((scene) => scene.id === id && scene.chapterId !== chapter.id));
        if (wrongParent)
            throw new Error(`Chapter "${chapter.id}" has an invalid scene relationship.`);
        if (children.length !== chapter.sceneIds.length || children.some((scene) => !childIds.has(scene.id)))
            throw new Error(`Chapter "${chapter.id}" has an invalid scene relationship.`);
        if (!same(chapter.sceneIds, sortSceneIds(children.map((scene) => scene.id), state.scenes)))
            throw new Error(`Chapter "${chapter.id}" has non-deterministic scene ordering.`);
        if (new Set(children.map((scene) => scene.order)).size !== children.length)
            throw new Error(`Duplicate scene order in chapter "${chapter.id}".`);
    }
    for (const scene of state.scenes) {
        const parent = state.chapters.find((chapter) => chapter.id === scene.chapterId);
        if (!parent.sceneIds.includes(scene.id))
            throw new Error(`Chapter "${scene.chapterId}" is missing scene "${scene.id}".`);
    }
}
function validateBook(book) { identifier(book.id, "Book id"); identifier(book.projectId, "Book project id"); text(book.title, "Book title"); validLifecycle(book.lifecycle, BOOK_LIFECYCLES, "book"); }
function validateChapter(chapter) { identifier(chapter.id, "Chapter id"); identifier(chapter.bookId, "Chapter book id"); positiveInteger(chapter.number, "Chapter number"); text(chapter.title, "Chapter title"); validLifecycle(chapter.lifecycle, CHAPTER_LIFECYCLES, "chapter"); }
function validateScene(scene) { identifier(scene.id, "Scene id"); identifier(scene.chapterId, "Scene chapter id"); positiveInteger(scene.order, "Scene order"); text(scene.title, "Scene title"); validLifecycle(scene.lifecycle, SCENE_LIFECYCLES, "scene"); }
function identifier(value, label) { if (!value.trim())
    throw new Error(`${label} is required.`); if (value !== value.trim())
    throw new Error(`${label} cannot have leading or trailing whitespace.`); return value; }
function text(value, label) { if (!value.trim())
    throw new Error(`${label} is required.`); return value.trim(); }
function positiveInteger(value, label) { if (!Number.isInteger(value) || value < 1)
    throw new Error(`${label} must be a positive integer.`); return value; }
function validLifecycle(value, allowed, label) { if (!allowed.includes(value))
    throw new Error(`Invalid ${label} lifecycle "${value}".`); return value; }
function assertUniqueId(state, id) { if ([...state.books, ...state.chapters, ...state.scenes].some((item) => item.id === id))
    throw new Error(`Duplicate manuscript identifier "${id}".`); }
function unique(set, id) { if (set.has(id))
    throw new Error(`Duplicate manuscript identifier "${id}".`); set.add(id); }
function sortChapterIds(ids, chapters) { return [...ids].sort((a, b) => { const left = chapters.find((item) => item.id === a); const right = chapters.find((item) => item.id === b); return left.number - right.number || left.id.localeCompare(right.id); }); }
function sortSceneIds(ids, scenes) { return [...ids].sort((a, b) => { const left = scenes.find((item) => item.id === a); const right = scenes.find((item) => item.id === b); return left.order - right.order || left.id.localeCompare(right.id); }); }
function same(left, right) { return left.length === right.length && left.every((value, index) => value === right[index]); }
function cloneBook(book) { return { ...book, chapterIds: [...book.chapterIds] }; }
function cloneChapter(chapter) { return { ...chapter, sceneIds: [...chapter.sceneIds] }; }
function cloneScene(scene) { return { ...scene }; }
function cloneState(state) { return { formatVersion: state.formatVersion, books: state.books.map(cloneBook), chapters: state.chapters.map(cloneChapter), scenes: state.scenes.map(cloneScene) }; }
//# sourceMappingURL=manuscript.js.map
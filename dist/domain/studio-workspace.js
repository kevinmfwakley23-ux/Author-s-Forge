"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STUDIO_WORKSPACE_FORMAT_VERSION = void 0;
exports.createStudioWorkspace = createStudioWorkspace;
exports.validateStudioWorkspace = validateStudioWorkspace;
exports.createWorkspaceBook = createWorkspaceBook;
exports.addWorkspaceBook = addWorkspaceBook;
exports.addWorkspaceChapter = addWorkspaceChapter;
exports.addWorkspaceScene = addWorkspaceScene;
exports.saveSceneContent = saveSceneContent;
exports.setActiveBook = setActiveBook;
exports.getBook = getBook;
exports.getChapter = getChapter;
exports.getScene = getScene;
exports.countWords = countWords;
exports.STUDIO_WORKSPACE_FORMAT_VERSION = 1;
const KINDS = ["childrens-book", "memoir", "psychological-thriller", "guided-journal", "comic-book", "training-manual", "novel", "other"];
const LIFECYCLES = ["planned", "active", "complete", "archived"];
function createStudioWorkspace() { return { formatVersion: exports.STUDIO_WORKSPACE_FORMAT_VERSION, activeBookId: null, books: [] }; }
function validateStudioWorkspace(value) {
    if (!value || typeof value !== "object")
        throw new Error("Invalid studio workspace.");
    const candidate = value;
    if (candidate.formatVersion !== exports.STUDIO_WORKSPACE_FORMAT_VERSION || !Array.isArray(candidate.books))
        throw new Error("Unsupported or corrupt studio workspace.");
    const books = candidate.books.map(validateBook);
    const ids = new Set();
    for (const book of books) {
        if (ids.has(book.id))
            throw new Error(`Duplicate workspace book id \"${book.id}\".`);
        ids.add(book.id);
    }
    const activeBookId = candidate.activeBookId === null || candidate.activeBookId === undefined ? null : identifier(candidate.activeBookId, "Active book id");
    if (activeBookId && !books.some((book) => book.id === activeBookId))
        throw new Error(`Active book \"${activeBookId}\" does not exist.`);
    return { formatVersion: exports.STUDIO_WORKSPACE_FORMAT_VERSION, activeBookId, books };
}
function createWorkspaceBook(input) {
    const now = input.now ?? new Date().toISOString();
    return { id: identifier(input.id, "Book id"), title: text(input.title, "Book title"), kind: valid(input.kind ?? "novel", KINDS, "book kind"), lifecycle: "active", description: String(input.description ?? "").trim(), chapters: [], updatedAt: now };
}
function addWorkspaceBook(state, book) {
    validateStudioWorkspace(state);
    validateBook(book);
    if (state.books.some((item) => item.id === book.id))
        throw new Error(`Workspace book \"${book.id}\" already exists.`);
    return { ...state, activeBookId: state.activeBookId ?? book.id, books: [...state.books, clone(book)] };
}
function addWorkspaceChapter(state, bookId, input) {
    const book = getBook(state, bookId);
    const now = input.now ?? new Date().toISOString();
    if (!Number.isInteger(input.number) || input.number < 1)
        throw new Error("Chapter number must be a positive integer.");
    if (book.chapters.some((chapter) => chapter.number === input.number))
        throw new Error(`Chapter ${input.number} already exists.`);
    const chapter = { id: identifier(input.id, "Chapter id"), number: input.number, title: text(input.title, "Chapter title"), lifecycle: "planned", synopsis: String(input.synopsis ?? "").trim(), scenes: [], updatedAt: now };
    if (book.chapters.some((item) => item.id === chapter.id))
        throw new Error(`Chapter id \"${chapter.id}\" already exists.`);
    return replaceBook(state, { ...book, chapters: [...book.chapters, chapter].sort((a, b) => a.number - b.number), updatedAt: now });
}
function addWorkspaceScene(state, bookId, chapterId, input) {
    const book = getBook(state, bookId);
    const chapter = getChapter(book, chapterId);
    const now = input.now ?? new Date().toISOString();
    if (!Number.isInteger(input.number) || input.number < 1)
        throw new Error("Scene number must be a positive integer.");
    if (chapter.scenes.some((scene) => scene.number === input.number))
        throw new Error(`Scene ${input.number} already exists.`);
    const scene = { id: identifier(input.id, "Scene id"), number: input.number, title: text(input.title, "Scene title"), lifecycle: "planned", synopsis: String(input.synopsis ?? "").trim(), content: "", wordCount: 0, updatedAt: now };
    if (chapter.scenes.some((item) => item.id === scene.id))
        throw new Error(`Scene id \"${scene.id}\" already exists.`);
    return replaceChapter(state, bookId, { ...chapter, scenes: [...chapter.scenes, scene].sort((a, b) => a.number - b.number), lifecycle: chapter.lifecycle === "planned" ? "active" : chapter.lifecycle, updatedAt: now });
}
function saveSceneContent(state, bookId, chapterId, sceneId, content, now = new Date().toISOString()) {
    const book = getBook(state, bookId);
    const chapter = getChapter(book, chapterId);
    const scene = chapter.scenes.find((item) => item.id === sceneId);
    if (!scene)
        throw new Error(`Scene \"${sceneId}\" not found.`);
    const textContent = String(content);
    const updated = { ...scene, content: textContent, wordCount: countWords(textContent), lifecycle: "active", updatedAt: now };
    return replaceChapter(state, bookId, { ...chapter, lifecycle: "active", scenes: chapter.scenes.map((item) => item.id === sceneId ? updated : item), updatedAt: now });
}
function setActiveBook(state, bookId) { getBook(state, bookId); return { ...state, activeBookId: bookId }; }
function getBook(state, bookId) { const book = state.books.find((item) => item.id === bookId); if (!book)
    throw new Error(`Book \"${bookId}\" not found.`); return book; }
function getChapter(book, chapterId) { const chapter = book.chapters.find((item) => item.id === chapterId); if (!chapter)
    throw new Error(`Chapter \"${chapterId}\" not found.`); return chapter; }
function getScene(book, chapterId, sceneId) { return getChapter(book, chapterId).scenes.find((item) => item.id === sceneId) ?? (() => { throw new Error(`Scene \"${sceneId}\" not found.`); })(); }
function countWords(value) { return value.trim() ? value.trim().split(/\s+/u).length : 0; }
function replaceBook(state, book) { return { ...state, books: state.books.map((item) => item.id === book.id ? clone(book) : item) }; }
function replaceChapter(state, bookId, chapter) { const book = getBook(state, bookId); return replaceBook(state, { ...book, chapters: book.chapters.map((item) => item.id === chapter.id ? clone(chapter) : item), updatedAt: chapter.updatedAt }); }
function validateBook(value) { if (!value || typeof value !== "object")
    throw new Error("Invalid workspace book."); const book = value; identifier(book.id, "Book id"); text(book.title, "Book title"); valid(book.kind, KINDS, "book kind"); valid(book.lifecycle, LIFECYCLES, "book lifecycle"); if (!Array.isArray(book.chapters))
    throw new Error(`Book \"${book.id}\" has invalid chapters.`); const chapters = book.chapters.map(validateChapter); return { ...book, description: String(book.description ?? ""), chapters }; }
function validateChapter(value) { if (!value || typeof value !== "object")
    throw new Error("Invalid workspace chapter."); const chapter = value; identifier(chapter.id, "Chapter id"); if (!Number.isInteger(chapter.number) || chapter.number < 1)
    throw new Error("Chapter number must be a positive integer."); text(chapter.title, "Chapter title"); valid(chapter.lifecycle, LIFECYCLES, "chapter lifecycle"); if (!Array.isArray(chapter.scenes))
    throw new Error(`Chapter \"${chapter.id}\" has invalid scenes.`); return { ...chapter, synopsis: String(chapter.synopsis ?? ""), scenes: chapter.scenes.map(validateScene) }; }
function validateScene(value) { if (!value || typeof value !== "object")
    throw new Error("Invalid workspace scene."); const scene = value; identifier(scene.id, "Scene id"); if (!Number.isInteger(scene.number) || scene.number < 1)
    throw new Error("Scene number must be a positive integer."); text(scene.title, "Scene title"); valid(scene.lifecycle, LIFECYCLES, "scene lifecycle"); const content = String(scene.content ?? ""); return { ...scene, synopsis: String(scene.synopsis ?? ""), content, wordCount: countWords(content) }; }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function identifier(value, label) { if (typeof value !== "string" || !value.trim() || value !== value.trim())
    throw new Error(`${label} is required and must be trimmed.`); return value; }
function text(value, label) { if (typeof value !== "string" || !value.trim())
    throw new Error(`${label} is required.`); return value.trim(); }
function valid(value, allowed, label) { if (typeof value !== "string" || !allowed.includes(value))
    throw new Error(`Invalid ${label}.`); return value; }
//# sourceMappingURL=studio-workspace.js.map
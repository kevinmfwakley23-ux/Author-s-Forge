export const MANUSCRIPT_FORMAT_VERSION = 1 as const;

export type BookLifecycle = "planned" | "active" | "completed" | "archived";
export type ChapterLifecycle = "planned" | "drafting" | "complete" | "archived";
export type SceneLifecycle = "planned" | "drafting" | "complete" | "archived";

export interface BookRecord { readonly id: string; readonly projectId: string; readonly title: string; readonly lifecycle: BookLifecycle; readonly chapterIds: readonly string[]; }
export interface ChapterRecord { readonly id: string; readonly bookId: string; readonly number: number; readonly title: string; readonly lifecycle: ChapterLifecycle; readonly sceneIds: readonly string[]; }
export interface SceneRecord { readonly id: string; readonly chapterId: string; readonly order: number; readonly title: string; readonly lifecycle: SceneLifecycle; }
export interface ManuscriptState { readonly formatVersion: typeof MANUSCRIPT_FORMAT_VERSION; readonly books: readonly BookRecord[]; readonly chapters: readonly ChapterRecord[]; readonly scenes: readonly SceneRecord[]; }

const BOOK_LIFECYCLES: readonly BookLifecycle[] = ["planned", "active", "completed", "archived"];
const CHAPTER_LIFECYCLES: readonly ChapterLifecycle[] = ["planned", "drafting", "complete", "archived"];
const SCENE_LIFECYCLES: readonly SceneLifecycle[] = ["planned", "drafting", "complete", "archived"];

export function createManuscriptState(): ManuscriptState {
  return { formatVersion: MANUSCRIPT_FORMAT_VERSION, books: [], chapters: [], scenes: [] };
}

export function createBook(input: { id: string; projectId: string; title: string; lifecycle?: BookLifecycle }): BookRecord {
  const lifecycle = input.lifecycle ?? "planned";
  return { id: identifier(input.id, "Book id"), projectId: identifier(input.projectId, "Book project id"), title: text(input.title, "Book title"), lifecycle: validLifecycle(lifecycle, BOOK_LIFECYCLES, "book"), chapterIds: [] };
}

export function createChapter(input: { id: string; bookId: string; number: number; title: string; lifecycle?: ChapterLifecycle }): ChapterRecord {
  const lifecycle = input.lifecycle ?? "planned";
  return { id: identifier(input.id, "Chapter id"), bookId: identifier(input.bookId, "Chapter book id"), number: positiveInteger(input.number, "Chapter number"), title: text(input.title, "Chapter title"), lifecycle: validLifecycle(lifecycle, CHAPTER_LIFECYCLES, "chapter"), sceneIds: [] };
}

export function createScene(input: { id: string; chapterId: string; order: number; title: string; lifecycle?: SceneLifecycle }): SceneRecord {
  const lifecycle = input.lifecycle ?? "planned";
  return { id: identifier(input.id, "Scene id"), chapterId: identifier(input.chapterId, "Scene chapter id"), order: positiveInteger(input.order, "Scene order"), title: text(input.title, "Scene title"), lifecycle: validLifecycle(lifecycle, SCENE_LIFECYCLES, "scene") };
}

export function addBook(state: ManuscriptState, book: BookRecord): ManuscriptState {
  validateManuscriptState(state);
  validateBook(book);
  assertUniqueId(state, book.id);
  return cloneState({ ...state, books: [...state.books, cloneBook(book)] });
}

export function addChapter(state: ManuscriptState, chapter: ChapterRecord): ManuscriptState {
  validateManuscriptState(state);
  validateChapter(chapter);
  const parent = state.books.find((book) => book.id === chapter.bookId);
  if (!parent) throw new Error(`Unknown book "${chapter.bookId}".`);
  assertUniqueId(state, chapter.id);
  if (state.chapters.some((item) => item.bookId === chapter.bookId && item.number === chapter.number)) throw new Error(`Duplicate chapter number ${chapter.number} in book "${chapter.bookId}".`);
  const chapters = [...state.chapters, cloneChapter(chapter)];
  const books = state.books.map((book) => book.id === chapter.bookId ? { ...book, chapterIds: sortChapterIds([...book.chapterIds, chapter.id], chapters) } : cloneBook(book));
  return cloneState({ ...state, books, chapters });
}

export function addScene(state: ManuscriptState, scene: SceneRecord): ManuscriptState {
  validateManuscriptState(state);
  validateScene(scene);
  const parent = state.chapters.find((chapter) => chapter.id === scene.chapterId);
  if (!parent) throw new Error(`Unknown chapter "${scene.chapterId}".`);
  assertUniqueId(state, scene.id);
  if (state.scenes.some((item) => item.chapterId === scene.chapterId && item.order === scene.order)) throw new Error(`Duplicate scene order ${scene.order} in chapter "${scene.chapterId}".`);
  const scenes = [...state.scenes, cloneScene(scene)];
  const chapters = state.chapters.map((chapter) => chapter.id === scene.chapterId ? { ...chapter, sceneIds: sortSceneIds([...chapter.sceneIds, scene.id], scenes) } : cloneChapter(chapter));
  return cloneState({ ...state, chapters, scenes });
}

export function insertChapter(state: ManuscriptState, chapter: ChapterRecord): ManuscriptState { return addChapter(state, chapter); }
export function insertScene(state: ManuscriptState, scene: SceneRecord): ManuscriptState { return addScene(state, scene); }

export function validateManuscriptState(state: ManuscriptState): void {
  if (state.formatVersion !== MANUSCRIPT_FORMAT_VERSION) throw new Error("Unsupported manuscript format version.");
  const ids = new Set<string>();
  for (const book of state.books) { validateBook(book); unique(ids, book.id); }
  for (const chapter of state.chapters) { validateChapter(chapter); unique(ids, chapter.id); }
  for (const scene of state.scenes) { validateScene(scene); unique(ids, scene.id); }

  for (const book of state.books) {
    const children = state.chapters.filter((chapter) => chapter.bookId === book.id);
    const childIds = new Set(book.chapterIds);
    if (childIds.size !== book.chapterIds.length) throw new Error(`Duplicate chapter reference in book "${book.id}".`);
    if (children.length !== book.chapterIds.length || children.some((chapter) => !childIds.has(chapter.id))) throw new Error(`Book "${book.id}" has an invalid chapter relationship.`);
    if (!same(book.chapterIds, sortChapterIds(children.map((chapter) => chapter.id), state.chapters))) throw new Error(`Book "${book.id}" has non-deterministic chapter ordering.`);
    if (new Set(children.map((chapter) => chapter.number)).size !== children.length) throw new Error(`Duplicate chapter number in book "${book.id}".`);
  }

  for (const chapter of state.chapters) {
    if (!state.books.some((book) => book.id === chapter.bookId)) throw new Error(`Chapter "${chapter.id}" references unknown book "${chapter.bookId}".`);
    const parent = state.books.find((book) => book.id === chapter.bookId)!;
    if (!parent.chapterIds.includes(chapter.id)) throw new Error(`Book "${chapter.bookId}" is missing chapter "${chapter.id}".`);
    const children = state.scenes.filter((scene) => scene.chapterId === chapter.id);
    const childIds = new Set(chapter.sceneIds);
    if (childIds.size !== chapter.sceneIds.length) throw new Error(`Duplicate scene reference in chapter "${chapter.id}".`);
    if (children.length !== chapter.sceneIds.length || children.some((scene) => !childIds.has(scene.id))) throw new Error(`Chapter "${chapter.id}" has an invalid scene relationship.`);
    if (!same(chapter.sceneIds, sortSceneIds(children.map((scene) => scene.id), state.scenes))) throw new Error(`Chapter "${chapter.id}" has non-deterministic scene ordering.`);
    if (new Set(children.map((scene) => scene.order)).size !== children.length) throw new Error(`Duplicate scene order in chapter "${chapter.id}".`);
  }

  for (const scene of state.scenes) {
    if (!state.chapters.some((chapter) => chapter.id === scene.chapterId)) throw new Error(`Scene "${scene.id}" references unknown chapter "${scene.chapterId}".`);
    const parent = state.chapters.find((chapter) => chapter.id === scene.chapterId)!;
    if (!parent.sceneIds.includes(scene.id)) throw new Error(`Chapter "${scene.chapterId}" is missing scene "${scene.id}".`);
  }
}

function validateBook(book: BookRecord): void { identifier(book.id, "Book id"); identifier(book.projectId, "Book project id"); text(book.title, "Book title"); validLifecycle(book.lifecycle, BOOK_LIFECYCLES, "book"); }
function validateChapter(chapter: ChapterRecord): void { identifier(chapter.id, "Chapter id"); identifier(chapter.bookId, "Chapter book id"); positiveInteger(chapter.number, "Chapter number"); text(chapter.title, "Chapter title"); validLifecycle(chapter.lifecycle, CHAPTER_LIFECYCLES, "chapter"); }
function validateScene(scene: SceneRecord): void { identifier(scene.id, "Scene id"); identifier(scene.chapterId, "Scene chapter id"); positiveInteger(scene.order, "Scene order"); text(scene.title, "Scene title"); validLifecycle(scene.lifecycle, SCENE_LIFECYCLES, "scene"); }

function identifier(value: string, label: string): string { if (!value.trim()) throw new Error(`${label} is required.`); if (value !== value.trim()) throw new Error(`${label} cannot have leading or trailing whitespace.`); return value; }
function text(value: string, label: string): string { if (!value.trim()) throw new Error(`${label} is required.`); return value.trim(); }
function positiveInteger(value: number, label: string): number { if (!Number.isInteger(value) || value < 1) throw new Error(`${label} must be a positive integer.`); return value; }
function validLifecycle<T extends string>(value: T, allowed: readonly T[], label: string): T { if (!allowed.includes(value)) throw new Error(`Invalid ${label} lifecycle "${value}".`); return value; }
function assertUniqueId(state: ManuscriptState, id: string): void { if ([...state.books, ...state.chapters, ...state.scenes].some((item) => item.id === id)) throw new Error(`Duplicate manuscript identifier "${id}".`); }
function unique(set: Set<string>, id: string): void { if (set.has(id)) throw new Error(`Duplicate manuscript identifier "${id}".`); set.add(id); }
function sortChapterIds(ids: readonly string[], chapters: readonly ChapterRecord[]): readonly string[] { return [...ids].sort((a, b) => { const left = chapters.find((item) => item.id === a)!; const right = chapters.find((item) => item.id === b)!; return left.number - right.number || left.id.localeCompare(right.id); }); }
function sortSceneIds(ids: readonly string[], scenes: readonly SceneRecord[]): readonly string[] { return [...ids].sort((a, b) => { const left = scenes.find((item) => item.id === a)!; const right = scenes.find((item) => item.id === b)!; return left.order - right.order || left.id.localeCompare(right.id); }); }
function same(left: readonly string[], right: readonly string[]): boolean { return left.length === right.length && left.every((value, index) => value === right[index]); }
function cloneBook(book: BookRecord): BookRecord { return { ...book, chapterIds: [...book.chapterIds] }; }
function cloneChapter(chapter: ChapterRecord): ChapterRecord { return { ...chapter, sceneIds: [...chapter.sceneIds] }; }
function cloneScene(scene: SceneRecord): SceneRecord { return { ...scene }; }
function cloneState(state: ManuscriptState): ManuscriptState { return { formatVersion: state.formatVersion, books: state.books.map(cloneBook), chapters: state.chapters.map(cloneChapter), scenes: state.scenes.map(cloneScene) }; }

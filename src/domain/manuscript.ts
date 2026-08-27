export const MANUSCRIPT_FORMAT_VERSION = 1 as const;

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

const BOOK_LIFECYCLES: readonly BookLifecycle[] = ["planned", "active", "completed", "archived"];
const CHAPTER_LIFECYCLES: readonly ChapterLifecycle[] = ["planned", "drafting", "complete", "archived"];
const SCENE_LIFECYCLES: readonly SceneLifecycle[] = ["planned", "drafting", "complete", "archived"];

export function createManuscriptState(): ManuscriptState {
  return { formatVersion: MANUSCRIPT_FORMAT_VERSION, books: [], chapters: [], scenes: [] };
}

export function createBook(input: {
  id: string;
  projectId: string;
  title: string;
  lifecycle?: BookLifecycle;
}): BookRecord {
  const id = requireIdentifier(input.id, "Book id");
  const projectId = requireIdentifier(input.projectId, "Book project id");
  const title = requireText(input.title, "Book title");
  const lifecycle = input.lifecycle ?? "planned";
  requireLifecycle(lifecycle, BOOK_LIFECYCLES, "book");
  return { id, projectId, title, lifecycle, chapterIds: [] };
}

export function createChapter(input: {
  id: string;
  bookId: string;
  number: number;
  title: string;
  lifecycle?: ChapterLifecycle;
}): ChapterRecord {
  const id = requireIdentifier(input.id, "Chapter id");
  const bookId = requireIdentifier(input.bookId, "Chapter book id");
  requirePositiveInteger(input.number, "Chapter number");
  const title = requireText(input.title, "Chapter title");
  const lifecycle = input.lifecycle ?? "planned";
  requireLifecycle(lifecycle, CHAPTER_LIFECYCLES, "chapter");
  return { id, bookId, number: input.number, title, lifecycle, sceneIds: [] };
}

export function createScene(input: {
  id: string;
  chapterId: string;
  order: number;
  title: string;
  lifecycle?: SceneLifecycle;
}): SceneRecord {
  const id = requireIdentifier(input.id, "Scene id");
  const chapterId = requireIdentifier(input.chapterId, "Scene chapter id");
  requirePositiveInteger(input.order, "Scene order");
  const title = requireText(input.title, "Scene title");
  const lifecycle = input.lifecycle ?? "planned";
  requireLifecycle(lifecycle, SCENE_LIFECYCLES, "scene");
  return { id, chapterId, order: input.order, title, lifecycle };
}

export function addBook(state: ManuscriptState, book: BookRecord): ManuscriptState {
  validateManuscriptState(state);
  assertUniqueId(state, book.id);
  return cloneState({ ...state, books: [...state.books, cloneBook(book)] });
}

export function addChapter(state: ManuscriptState, chapter: ChapterRecord): ManuscriptState {
  validateManuscriptState(state);
  validateChapterRecord(chapter);
  if (!state.books.some((book) => book.id === chapter.bookId)) throw new Error(`Unknown book "${chapter.bookId}".`);
  assertUniqueId(state, chapter.id);
  if (state.chapters.some((item) => item.bookId === chapter.bookId && item.number === chapter.number)) {
    throw new Error(`Duplicate chapter number ${chapter.number} in book "${chapter.bookId}".`);
  }
  const books = state.books.map((book) => book.id === chapter.bookId ? { ...book, chapterIds: sortChapterIds([...book.chapterIds, chapter.id], [...state.chapters, chapter]) } : cloneBook(book));
  return cloneState({ ...state, books, chapters: [...state.chapters, cloneChapter(chapter)] });
}

export function addScene(state: ManuscriptState, scene: SceneRecord): ManuscriptState {
  validateManuscriptState(state);
  validateSceneRecord(scene);
  if (!state.chapters.some((chapter) => chapter.id === scene.chapterId)) throw new Error(`Unknown chapter "${scene.chapterId}".`);
  assertUniqueId(state, scene.id);
  if (state.scenes.some((item) => item.chapterId === scene.chapterId && item.order === scene.order)) {
    throw new Error(`Duplicate scene order ${scene.order} in chapter "${scene.chapterId}".`);
  }
  const chapters = state.chapters.map((chapter) => chapter.id === scene.chapterId ? { ...chapter, sceneIds: sortSceneIds([...chapter.sceneIds, scene.id], [...state.scenes, scene]) } : cloneChapter(chapter));
  return cloneState({ ...state, chapters, scenes: [...state.scenes, cloneScene(scene)] });
}

export function insertChapter(state: ManuscriptState, chapter: ChapterRecord, beforeChapterId?: string): ManuscriptState {
  const next = addChapter(state, chapter);
  if (beforeChapterId === undefined) return next;
  const parent = next.books.find((book) => book.id === chapter.bookId);
  if (!parent || !parent.chapterIds.includes(beforeChapterId)) throw new Error(`Chapter "${beforeChapterId}" is not in book "${chapter.bookId}".`);
  const ordered = [chapter.id, ...parent.chapterIds.filter((id) => id !== chapter.id && id !== beforeChapterId), beforeChapterId];
  return cloneState({ ...next, books: next.books.map((book) => book.id === parent.id ? { ...book, chapterIds: ordered } : book) });
}

export function insertScene(state: ManuscriptState, scene: SceneRecord, beforeSceneId?: string): ManuscriptState {
  const next = addScene(state, scene);
  if (beforeSceneId === undefined) return next;
  const parent = next.chapters.find((chapter) => chapter.id === scene.chapterId);
  if (!parent || !parent.sceneIds.includes(beforeSceneId)) throw new Error(`Scene "${beforeSceneId}" is not in chapter "${scene.chapterId}".`);
  const ordered = [scene.id, ...parent.sceneIds.filter((id) => id !== scene.id && id !== beforeSceneId), beforeSceneId];
  return cloneState({ ...next, chapters: next.chapters.map((chapter) => chapter.id === parent.id ? { ...chapter, sceneIds: ordered } : chapter) });
}

export function validateManuscriptState(state: ManuscriptState): void {
  if (state.formatVersion !== MANUSCRIPT_FORMAT_VERSION) throw new Error("Unsupported manuscript format version.");
  const ids = new Set<string>();
  for (const book of state.books) {
    validateBookRecord(book);
    assertUniqueIdSet(ids, book.id);
    if (new Set(book.chapterIds).size !== book.chapterIds.length) throw new Error(`Duplicate chapter reference in book "${book.id}".`);
  }
  const chapterIds = new Set<string>();
  for (const chapter of state.chapters) {
    validateChapterRecord(chapter);
    assertUniqueIdSet(chapterIds, chapter.id);
    if (!state.books.some((book) => book.id === chapter.bookId)) throw new Error(`Chapter "${chapter.id}" references unknown book "${chapter.bookId}".`);
    if (new Set(chapter.sceneIds).size !== chapter.sceneIds.length) throw new Error(`Duplicate scene reference in chapter "${chapter.id}".`);
    const siblings = state.chapters.filter((item) => item.bookId === chapter.bookId);
    if (siblings.filter((item) => item.number === chapter.number).length > 1) throw new Error(`Duplicate chapter number ${chapter.number} in book "${chapter.bookId}".`);
    const parent = state.books.find((book) => book.id === chapter.bookId)!;
    if (!parent.chapterIds.includes(chapter.id)) throw new Error(`Book "${chapter.bookId}" is missing chapter "${chapter.id}".`);
  }
  const sceneIds = new Set<string>();
  for (const scene of state.scenes) {
    validateSceneRecord(scene);
    assertUniqueIdSet(sceneIds, scene.id);
    if (!state.chapters.some((chapter) => chapter.id === scene.chapterId)) throw new Error(`Scene "${scene.id}" references unknown chapter "${scene.chapterId}".`);
    if (state.scenes.filter((item) => item.chapterId === scene.chapterId && item.order === scene.order).length > 1) throw new Error(`Duplicate scene order ${scene.order} in chapter "${scene.chapterId}".`);
    const parent = state.chapters.find((chapter) => chapter.id === scene.chapterId)!;
    if (!parent.sceneIds.includes(scene.id)) throw new Error(`Chapter "${scene.chapterId}" is missing scene "${scene.id}".`);
  }
  for (const book of state.books) {
    const expected = sortChapterIds([...state.chapters.filter((chapter) => chapter.bookId === book.id).map((chapter) => chapter.id)], state.chapters);
    if (!same(book.chapterIds, expected)) throw new Error(`Book "${book.id}" has non-deterministic chapter ordering.`);
  }
  for (const chapter of state.chapters) {
    const expected = sortSceneIds([...state.scenes.filter((scene) => scene.chapterId === chapter.id).map((scene) => scene.id)], state.scenes);
    if (!same(chapter.sceneIds, expected)) throw new Error(`Chapter "${chapter.id}" has non-deterministic scene ordering.`);
  }
}

function validateBookRecord(book: BookRecord): void {
  requireIdentifier(book.id, "Book id");
  requireIdentifier(book.projectId, "Book project id");
  requireText(book.title, "Book title");
  requireLifecycle(book.lifecycle, BOOK_LIFECYCLES, "book");
}

function validateChapterRecord(chapter: ChapterRecord): void {
  requireIdentifier(chapter.id, "Chapter id");
  requireIdentifier(chapter.bookId, "Chapter book id");
  requirePositiveInteger(chapter.number, "Chapter number");
  requireText(chapter.title, "Chapter title");
  requireLifecycle(chapter.lifecycle, CHAPTER_LIFECYCLES, "chapter");
}

function validateSceneRecord(scene: SceneRecord): void {
  requireIdentifier(scene.id, "Scene id");
  requireIdentifier(scene.chapterId, "Scene chapter id");
  requirePositiveInteger(scene.order, "Scene order");
  requireText(scene.title, "Scene title");
  requireLifecycle(scene.lifecycle, SCENE_LIFECYCLES, "scene");
}

function requireIdentifier(value: string, label: string): string {
  if (!value.trim()) throw new Error(`${label} is required.`);
  if (value !== value.trim()) throw new Error(`${label} cannot have leading or trailing whitespace.`);
  return value;
}

function requireText(value: string, label: string): string {
  if (!value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function requirePositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${label} must be a positive integer.`);
}

function requireLifecycle<T extends string>(value: T, allowed: readonly T[], label: string): void {
  if (!allowed.includes(value)) throw new Error(`Invalid ${label} lifecycle "${value}".`);
}

function assertUniqueId(state: ManuscriptState, id: string): void {
  if ([...state.books, ...state.chapters, ...state.scenes].some((item) => item.id === id)) throw new Error(`Duplicate manuscript identifier "${id}".`);
}

function assertUniqueIdSet(set: Set<string>, id: string): void {
  if (set.has(id)) throw new Error(`Duplicate manuscript identifier "${id}".`);
  set.add(id);
}

function sortChapterIds(ids: readonly string[], chapters: readonly ChapterRecord[]): readonly string[] {
  return [...ids].sort((a, b) => {
    const left = chapters.find((chapter) => chapter.id === a)!;
    const right = chapters.find((chapter) => chapter.id === b)!;
    return left.number - right.number || left.id.localeCompare(right.id);
  });
}

function sortSceneIds(ids: readonly string[], scenes: readonly SceneRecord[]): readonly string[] {
  return [...ids].sort((a, b) => {
    const left = scenes.find((scene) => scene.id === a)!;
    const right = scenes.find((scene) => scene.id === b)!;
    return left.order - right.order || left.id.localeCompare(right.id);
  });
}

function same(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function cloneBook(book: BookRecord): BookRecord {
  return { ...book, chapterIds: [...book.chapterIds] };
}

function cloneChapter(chapter: ChapterRecord): ChapterRecord {
  return { ...chapter, sceneIds: [...chapter.sceneIds] };
}

function cloneScene(scene: SceneRecord): SceneRecord {
  return { ...scene };
}

function cloneState(state: ManuscriptState): ManuscriptState {
  return { formatVersion: state.formatVersion, books: state.books.map(cloneBook), chapters: state.chapters.map(cloneChapter), scenes: state.scenes.map(cloneScene) };
}

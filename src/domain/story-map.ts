import type { ManuscriptState, BookRecord, ChapterRecord, SceneRecord } from "./manuscript";

export const STORY_MAP_FORMAT_VERSION = 1 as const;

export type StoryMapSceneStatus = SceneRecord["lifecycle"];
export type StoryMapChapterStatus = ChapterRecord["lifecycle"];

export interface StoryMapScene {
  readonly id: string;
  readonly order: number;
  readonly title: string;
  readonly status: StoryMapSceneStatus;
}

export interface StoryMapChapter {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly status: StoryMapChapterStatus;
  readonly scenes: readonly StoryMapScene[];
  readonly completionPercent: number;
}

export interface StoryMapBook {
  readonly id: string;
  readonly title: string;
  readonly status: BookRecord["lifecycle"];
  readonly chapters: readonly StoryMapChapter[];
  readonly completionPercent: number;
}

export interface StoryMap {
  readonly formatVersion: typeof STORY_MAP_FORMAT_VERSION;
  readonly books: readonly StoryMapBook[];
  readonly totals: {
    readonly books: number;
    readonly chapters: number;
    readonly scenes: number;
    readonly completedScenes: number;
    readonly completionPercent: number;
  };
}

const COMPLETE = new Set(["complete"]);

export function createStoryMap(state: ManuscriptState): StoryMap {
  const books = state.books.map((book) => buildBook(book, state)).sort((a, b) => a.id.localeCompare(b.id));
  const scenes = books.flatMap((book) => book.chapters.flatMap((chapter) => chapter.scenes));
  const completedScenes = scenes.filter((scene) => COMPLETE.has(scene.status)).length;
  return {
    formatVersion: STORY_MAP_FORMAT_VERSION,
    books,
    totals: {
      books: books.length,
      chapters: books.reduce((total, book) => total + book.chapters.length, 0),
      scenes: scenes.length,
      completedScenes,
      completionPercent: percent(completedScenes, scenes.length),
    },
  };
}

export function createStoryMapFromManuscript(state: ManuscriptState): StoryMap {
  return createStoryMap(state);
}

function buildBook(book: BookRecord, state: ManuscriptState): StoryMapBook {
  const chapters = state.chapters
    .filter((chapter) => chapter.bookId === book.id)
    .sort((a, b) => a.number - b.number || a.id.localeCompare(b.id))
    .map((chapter) => {
      const scenes = state.scenes
        .filter((scene) => scene.chapterId === chapter.id)
        .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
        .map((scene) => ({ id: scene.id, order: scene.order, title: scene.title, status: scene.lifecycle }));
      return {
        id: chapter.id,
        number: chapter.number,
        title: chapter.title,
        status: chapter.lifecycle,
        scenes,
        completionPercent: percent(scenes.filter((scene) => scene.status === "complete").length, scenes.length),
      };
    });
  return {
    id: book.id,
    title: book.title,
    status: book.lifecycle,
    chapters,
    completionPercent: percent(chapters.filter((chapter) => chapter.completionPercent === 100).length, chapters.length),
  };
}

function percent(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

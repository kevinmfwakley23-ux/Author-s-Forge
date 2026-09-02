import { randomUUID } from "node:crypto";
import type { ProjectState } from "../domain/project";
import { getBook, getChapter, getScene, validateStudioWorkspace } from "../domain/studio-workspace";
import {
  assignSceneToStoryMapPlotlines,
  createStoryMapChapterCard,
  createStoryMapPlanningState,
  createStoryMapPlotline,
  createStoryMapSceneAttributes,
  removeStoryMapChapterCard,
  removeStoryMapPlotline,
  setStoryMapChapterCard,
  setStoryMapSceneAttributes,
  upsertStoryMapPlotline,
  validateStoryMapPlanningState,
  type StoryMapChapterCard,
  type StoryMapPlanningState,
  type StoryMapPlotlineKind,
  type StoryMapSceneAttributes,
} from "../domain/story-map-planning";
import type { FileProjectStore } from "../infrastructure/file-project-store";

type ProjectWithStoryMapPlanning = ProjectState & { readonly storyMapPlanning?: StoryMapPlanningState };

export interface StudioStoryMapPlanningSnapshot {
  readonly projectId: string;
  readonly planning: StoryMapPlanningState;
  readonly options: {
    readonly characters: readonly { id: string; name: string }[];
    readonly locations: readonly string[];
    readonly tags: readonly string[];
  };
}

export class StudioStoryMapPlanningService {
  constructor(private readonly projects: Pick<FileProjectStore, "load" | "save">) {}

  async snapshot(projectId: string): Promise<StudioStoryMapPlanningSnapshot> {
    const project = await this.requireProject(projectId);
    const planning = planningOf(project);
    validatePlanningReferences(project, planning);
    return {
      projectId: project.metadata.id,
      planning,
      options: {
        characters: (project.characters ?? []).map((character) => ({ id: character.id, name: character.profile.name })),
        locations: [...new Set([
          ...Object.values(planning.sceneAttributes).map((attributes) => attributes.location),
          ...Object.values(planning.chapterCards).map((card) => card.location),
        ].filter(Boolean))].sort((a, b) => a.localeCompare(b)),
        tags: [...new Set(Object.values(planning.sceneAttributes).flatMap((attributes) => attributes.tags))].sort((a, b) => a.localeCompare(b)),
      },
    };
  }

  async setSceneAttributes(projectId: string, input: {
    bookId: string;
    chapterId: string;
    sceneId: string;
    attributes: Partial<StoryMapSceneAttributes>;
    plotlineIds?: readonly string[];
    now?: string;
  }): Promise<StudioStoryMapPlanningSnapshot> {
    const project = await this.requireProject(projectId);
    const workspace = requireWorkspace(project);
    const book = getBook(workspace, identifier(input.bookId, "Book id"));
    const chapter = getChapter(book, identifier(input.chapterId, "Chapter id"));
    getScene(book, chapter.id, identifier(input.sceneId, "Scene id"));

    const attributes = createStoryMapSceneAttributes(input.attributes);
    for (const characterId of attributes.povCharacterIds) requireCharacter(project, characterId);
    let planning = setStoryMapSceneAttributes(planningOf(project), input.sceneId, attributes);
    if (input.plotlineIds !== undefined) {
      const plotlineIds = uniqueIds(input.plotlineIds, "Story Map plotline id");
      for (const plotlineId of plotlineIds) {
        const plotline = planning.plotlines.find((item) => item.id === plotlineId);
        if (!plotline) throw new Error(`Story Map plotline "${plotlineId}" not found.`);
        if (plotline.bookId !== book.id) throw new Error(`Story Map plotline "${plotlineId}" belongs to another book.`);
      }
      planning = assignSceneToStoryMapPlotlines(planning, input.sceneId, plotlineIds, input.now);
    }
    await this.save(project, planning, input.now);
    return this.snapshot(project.metadata.id);
  }

  async setChapterCard(projectId: string, input: {
    bookId: string;
    chapterId: string;
    card: Partial<StoryMapChapterCard>;
    now?: string;
  }): Promise<StudioStoryMapPlanningSnapshot> {
    const project = await this.requireProject(projectId);
    const workspace = requireWorkspace(project);
    const book = getBook(workspace, identifier(input.bookId, "Book id"));
    const chapter = getChapter(book, identifier(input.chapterId, "Chapter id"));
    const card = createStoryMapChapterCard(input.card);
    for (const characterId of [...card.povCharacterIds, ...card.characterIds]) requireCharacter(project, characterId);
    await this.save(project, setStoryMapChapterCard(planningOf(project), chapter.id, card), input.now);
    return this.snapshot(project.metadata.id);
  }

  async removeChapterCard(projectId: string, bookId: string, chapterId: string, now?: string): Promise<StudioStoryMapPlanningSnapshot> {
    const project = await this.requireProject(projectId);
    const workspace = requireWorkspace(project);
    const book = getBook(workspace, identifier(bookId, "Book id"));
    const chapter = getChapter(book, identifier(chapterId, "Chapter id"));
    const planning = planningOf(project);
    if (!planning.chapterCards[chapter.id]) throw new Error(`Chapter Card for chapter "${chapter.id}" not found.`);
    await this.save(project, removeStoryMapChapterCard(planning, chapter.id), now);
    return this.snapshot(project.metadata.id);
  }

  async createPlotline(projectId: string, input: {
    id?: string;
    bookId: string;
    name: string;
    kind?: StoryMapPlotlineKind;
    description?: string;
    characterId?: string;
    sceneIds?: readonly string[];
    order?: number;
    now?: string;
  }): Promise<StudioStoryMapPlanningSnapshot> {
    const project = await this.requireProject(projectId);
    const workspace = requireWorkspace(project);
    const book = getBook(workspace, identifier(input.bookId, "Book id"));
    const sceneIds = uniqueIds(input.sceneIds ?? [], "Scene id");
    for (const sceneId of sceneIds) requireSceneInBook(book, sceneId);
    if (input.characterId) requireCharacter(project, input.characterId);
    const planning = planningOf(project);
    const defaultOrder = Math.max(0, ...planning.plotlines.filter((item) => item.bookId === book.id).map((item) => item.order)) + 1;
    const plotline = createStoryMapPlotline({
      id: input.id?.trim() || `plotline-${randomUUID()}`,
      bookId: book.id,
      name: input.name,
      kind: input.kind,
      description: input.description,
      characterId: input.characterId,
      sceneIds,
      order: input.order ?? defaultOrder,
      now: input.now,
    });
    await this.save(project, upsertStoryMapPlotline(planning, plotline), input.now);
    return this.snapshot(project.metadata.id);
  }

  async updatePlotline(projectId: string, plotlineId: string, input: {
    name?: string;
    kind?: StoryMapPlotlineKind;
    description?: string;
    characterId?: string | null;
    sceneIds?: readonly string[];
    order?: number;
    now?: string;
  }): Promise<StudioStoryMapPlanningSnapshot> {
    const project = await this.requireProject(projectId);
    const planning = planningOf(project);
    const id = identifier(plotlineId, "Story Map plotline id");
    const current = planning.plotlines.find((item) => item.id === id);
    if (!current) throw new Error(`Story Map plotline "${id}" not found.`);
    const workspace = requireWorkspace(project);
    const book = getBook(workspace, current.bookId);
    const sceneIds = input.sceneIds === undefined ? current.sceneIds : uniqueIds(input.sceneIds, "Scene id");
    for (const sceneId of sceneIds) requireSceneInBook(book, sceneId);
    const characterId = input.characterId === null ? undefined : input.characterId ?? current.characterId;
    if (characterId) requireCharacter(project, characterId);
    const next = createStoryMapPlotline({
      id: current.id,
      bookId: current.bookId,
      name: input.name ?? current.name,
      kind: input.kind ?? current.kind,
      description: input.description ?? current.description,
      characterId,
      sceneIds,
      order: input.order ?? current.order,
      now: current.createdAt,
    });
    const updated = { ...next, createdAt: current.createdAt, updatedAt: timestamp(input.now ?? new Date().toISOString()) };
    await this.save(project, upsertStoryMapPlotline(planning, updated), input.now);
    return this.snapshot(project.metadata.id);
  }

  async removePlotline(projectId: string, plotlineId: string, now?: string): Promise<StudioStoryMapPlanningSnapshot> {
    const project = await this.requireProject(projectId);
    const planning = planningOf(project);
    const id = identifier(plotlineId, "Story Map plotline id");
    if (!planning.plotlines.some((item) => item.id === id)) throw new Error(`Story Map plotline "${id}" not found.`);
    await this.save(project, removeStoryMapPlotline(planning, id), now);
    return this.snapshot(project.metadata.id);
  }

  private async requireProject(projectId: string): Promise<ProjectWithStoryMapPlanning> {
    const id = identifier(projectId, "Project id");
    const project = await this.projects.load(id);
    if (!project) throw new Error(`Project "${id}" not found.`);
    return project as ProjectWithStoryMapPlanning;
  }

  private async save(project: ProjectWithStoryMapPlanning, planning: StoryMapPlanningState, now = new Date().toISOString()): Promise<void> {
    validatePlanningReferences(project, planning);
    await this.projects.save({
      ...project,
      storyMapPlanning: validateStoryMapPlanningState(JSON.parse(JSON.stringify(planning))),
      metadata: { ...project.metadata, updatedAt: timestamp(now) },
    } as ProjectState);
  }
}

function planningOf(project: ProjectWithStoryMapPlanning): StoryMapPlanningState {
  return project.storyMapPlanning ? validateStoryMapPlanningState(project.storyMapPlanning) : createStoryMapPlanningState();
}

function requireWorkspace(project: ProjectState) {
  if (!project.studioWorkspace) throw new Error(`Project "${project.metadata.id}" has no Studio workspace.`);
  return validateStudioWorkspace(project.studioWorkspace);
}

function validatePlanningReferences(project: ProjectWithStoryMapPlanning, planning: StoryMapPlanningState): void {
  const workspace = project.studioWorkspace ? validateStudioWorkspace(project.studioWorkspace) : undefined;
  const allScenes = new Map<string, string>();
  const allChapters = new Set<string>();
  if (workspace) for (const book of workspace.books) for (const chapter of book.chapters) {
    allChapters.add(chapter.id);
    for (const scene of chapter.scenes) allScenes.set(scene.id, book.id);
  }
  for (const [sceneId, attributes] of Object.entries(planning.sceneAttributes)) {
    if (!allScenes.has(sceneId)) throw new Error(`Story Map planning references missing scene "${sceneId}".`);
    for (const characterId of attributes.povCharacterIds) requireCharacter(project, characterId);
  }
  for (const [chapterId, card] of Object.entries(planning.chapterCards)) {
    if (!allChapters.has(chapterId)) throw new Error(`Story Map Chapter Card references missing chapter "${chapterId}".`);
    for (const characterId of [...card.povCharacterIds, ...card.characterIds]) requireCharacter(project, characterId);
  }
  for (const plotline of planning.plotlines) {
    if (!workspace?.books.some((book) => book.id === plotline.bookId)) throw new Error(`Story Map plotline "${plotline.id}" references missing book "${plotline.bookId}".`);
    if (plotline.characterId) requireCharacter(project, plotline.characterId);
    for (const sceneId of plotline.sceneIds) {
      const bookId = allScenes.get(sceneId);
      if (!bookId) throw new Error(`Story Map plotline "${plotline.id}" references missing scene "${sceneId}".`);
      if (bookId !== plotline.bookId) throw new Error(`Story Map plotline "${plotline.id}" contains a scene from another book.`);
    }
  }
}

function requireCharacter(project: ProjectState, characterId: string): void {
  const id = identifier(characterId, "Character id");
  if (!(project.characters ?? []).some((character) => character.id === id)) throw new Error(`Character "${id}" not found.`);
}

function requireSceneInBook(book: ReturnType<typeof getBook>, sceneId: string): void {
  const id = identifier(sceneId, "Scene id");
  if (!book.chapters.some((chapter) => chapter.scenes.some((scene) => scene.id === id))) throw new Error(`Scene "${id}" not found in book "${book.id}".`);
}

function uniqueIds(value: readonly string[], label: string): readonly string[] {
  if (!Array.isArray(value)) throw new Error(`${label} collection is invalid.`);
  return [...new Set(value.map((item) => identifier(item, label)))];
}
function identifier(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim() || value !== value.trim() || value.length > 300 || /[\r\n]/.test(value)) throw new Error(`${label} is invalid.`);
  return value;
}
function timestamp(value: unknown): string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new Error("Story Map planning timestamp is invalid.");
  return new Date(value).toISOString();
}

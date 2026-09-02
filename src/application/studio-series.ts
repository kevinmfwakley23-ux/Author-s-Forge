import type { FileProjectStore } from "../infrastructure/file-project-store";
import { withProjectSeries, type ProjectState } from "../domain/project";
import {
  createSeries,
  type SeriesDetailsUpdate,
  type SeriesState,
  type SeriesTimelineEvent,
} from "../domain/series";
import { SeriesService } from "./series";

export interface StudioSeriesSnapshot {
  readonly series: readonly SeriesState[];
  readonly options: {
    readonly books: readonly { readonly id: string; readonly title: string }[];
    readonly characters: readonly { readonly id: string; readonly name: string }[];
    readonly visualIdentities: readonly { readonly id: string; readonly characterId: string }[];
  };
}

export interface CreateStudioSeriesInput extends SeriesDetailsUpdate {
  readonly id?: string;
  readonly name: string;
  readonly bookIds?: readonly string[];
  readonly now?: string;
}

export class StudioSeriesService {
  constructor(private readonly projects: Pick<FileProjectStore, "load" | "save">) {}

  async snapshot(projectId: string): Promise<StudioSeriesSnapshot> {
    return snapshot(await this.requireProject(projectId));
  }

  async create(projectId: string, input: CreateStudioSeriesInput): Promise<StudioSeriesSnapshot> {
    const project = await this.requireProject(projectId);
    const series = createSeries({
      id: input.id,
      projectId,
      name: input.name,
      bookIds: input.bookIds,
      sharedCharacters: input.sharedCharacters,
      worldRules: input.worldRules,
      visualIdentityIds: input.visualIdentityIds,
      locations: input.locations,
      terminology: input.terminology,
      history: input.history,
      unresolvedThreads: input.unresolvedThreads,
    });
    if ((project.series ?? []).some((item) => item.id === series.id)) throw new Error(`Series "${series.id}" already exists.`);
    assertSeriesReferences(project, series);
    return this.persist(project, [...(project.series ?? []), series], input.now);
  }

  async update(projectId: string, seriesId: string, details: SeriesDetailsUpdate, now?: string): Promise<StudioSeriesSnapshot> {
    const project = await this.requireProject(projectId);
    const { index, series } = requireSeries(project, seriesId);
    const updated = new SeriesService(projectId, series).update(details);
    assertSeriesReferences(project, updated);
    return this.persist(project, replace(project.series ?? [], index, updated), now);
  }

  async remove(projectId: string, seriesId: string, now?: string): Promise<StudioSeriesSnapshot> {
    const project = await this.requireProject(projectId);
    const { index } = requireSeries(project, seriesId);
    const next = [...(project.series ?? [])];
    next.splice(index, 1);
    return this.persist(project, next, now);
  }

  async addBook(projectId: string, seriesId: string, bookId: string, now?: string): Promise<StudioSeriesSnapshot> {
    const project = await this.requireProject(projectId);
    assertBookExists(project, bookId);
    const { index, series } = requireSeries(project, seriesId);
    const updated = new SeriesService(projectId, series).addBook(bookId);
    return this.persist(project, replace(project.series ?? [], index, updated), now);
  }

  async removeBook(projectId: string, seriesId: string, bookId: string, now?: string): Promise<StudioSeriesSnapshot> {
    const project = await this.requireProject(projectId);
    const { index, series } = requireSeries(project, seriesId);
    const updated = new SeriesService(projectId, series).removeBook(bookId);
    return this.persist(project, replace(project.series ?? [], index, updated), now);
  }

  async reorderBooks(projectId: string, seriesId: string, bookIds: readonly string[], now?: string): Promise<StudioSeriesSnapshot> {
    const project = await this.requireProject(projectId);
    for (const bookId of bookIds) assertBookExists(project, bookId);
    const { index, series } = requireSeries(project, seriesId);
    const updated = new SeriesService(projectId, series).reorderBooks(bookIds);
    return this.persist(project, replace(project.series ?? [], index, updated), now);
  }

  async addTimelineEvent(projectId: string, seriesId: string, event: SeriesTimelineEvent, now?: string): Promise<StudioSeriesSnapshot> {
    const project = await this.requireProject(projectId);
    assertBookExists(project, event.bookId);
    const { index, series } = requireSeries(project, seriesId);
    const updated = new SeriesService(projectId, series).addTimelineEvent(event);
    return this.persist(project, replace(project.series ?? [], index, updated), now);
  }

  async removeTimelineEvent(projectId: string, seriesId: string, eventId: string, now?: string): Promise<StudioSeriesSnapshot> {
    const project = await this.requireProject(projectId);
    const { index, series } = requireSeries(project, seriesId);
    const updated = new SeriesService(projectId, series).removeTimelineEvent(eventId);
    return this.persist(project, replace(project.series ?? [], index, updated), now);
  }

  private async requireProject(projectId: string): Promise<ProjectState> {
    const project = await this.projects.load(projectId);
    if (!project) throw new Error(`Project "${projectId}" not found.`);
    return project;
  }

  private async persist(project: ProjectState, series: readonly SeriesState[], now?: string): Promise<StudioSeriesSnapshot> {
    const next = withProjectSeries(project, series, now);
    await this.projects.save(next);
    const restored = await this.projects.load(project.metadata.id);
    if (!restored) throw new Error(`Project "${project.metadata.id}" disappeared after Series save.`);
    return snapshot(restored);
  }
}

function snapshot(project: ProjectState): StudioSeriesSnapshot {
  return Object.freeze({
    series: (project.series ?? []).map((item) => JSON.parse(JSON.stringify(item)) as SeriesState),
    options: Object.freeze({
      books: (project.studioWorkspace?.books ?? []).map((book) => Object.freeze({ id: book.id, title: book.title })),
      characters: (project.characters ?? []).map((character) => Object.freeze({ id: character.id, name: character.profile.name })),
      visualIdentities: (project.visualIdentities ?? []).map((identity) => Object.freeze({ id: identity.id, characterId: identity.characterId })),
    }),
  });
}

function requireSeries(project: ProjectState, seriesId: string): { index: number; series: SeriesState } {
  const id = required(seriesId, "Series id");
  const list = project.series ?? [];
  const index = list.findIndex((series) => series.id === id);
  if (index < 0) throw new Error(`Series "${id}" not found.`);
  return { index, series: list[index] };
}

function replace(list: readonly SeriesState[], index: number, value: SeriesState): readonly SeriesState[] {
  const next = [...list];
  next[index] = value;
  return next;
}

function assertSeriesReferences(project: ProjectState, series: SeriesState): void {
  for (const bookId of series.bookIds) assertBookExists(project, bookId);
  const characters = new Set((project.characters ?? []).map((character) => character.id));
  for (const characterId of series.sharedCharacters) {
    if (!characters.has(characterId)) throw new Error(`Series character "${characterId}" not found in this project.`);
  }
  const identities = new Set((project.visualIdentities ?? []).map((identity) => identity.id));
  for (const identityId of series.visualIdentityIds) {
    if (!identities.has(identityId)) throw new Error(`Series visual identity "${identityId}" not found in this project.`);
  }
}

function assertBookExists(project: ProjectState, bookId: string): void {
  const id = required(bookId, "Book id");
  if (!(project.studioWorkspace?.books ?? []).some((book) => book.id === id)) throw new Error(`Book "${id}" not found in this project.`);
}

function required(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

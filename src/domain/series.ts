export const SERIES_FORMAT_VERSION = 1 as const;

export interface SeriesState {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly bookIds: readonly string[];
  readonly sharedCharacters: readonly string[];
  readonly worldRules: readonly string[];
  readonly visualIdentityIds: readonly string[];
  readonly locations: readonly string[];
  readonly terminology: readonly string[];
  readonly history: readonly string[];
  readonly unresolvedThreads: readonly string[];
  readonly timeline: readonly SeriesTimelineEvent[];
}

export interface SeriesTimelineEvent {
  readonly id: string;
  readonly date: string;
  readonly bookId: string;
  readonly description: string;
}

export interface SeriesDetailsUpdate {
  readonly name?: string;
  readonly sharedCharacters?: readonly string[];
  readonly worldRules?: readonly string[];
  readonly visualIdentityIds?: readonly string[];
  readonly locations?: readonly string[];
  readonly terminology?: readonly string[];
  readonly history?: readonly string[];
  readonly unresolvedThreads?: readonly string[];
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function required(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required.`);
  return value.trim();
}

function stringArray(value: unknown, name: string): readonly string[] {
  if (!Array.isArray(value)) throw new Error(`${name} must be an array.`);
  const normalized = value.map((item) => required(item, name));
  if (new Set(normalized).size !== normalized.length) throw new Error(`Duplicate ${name.toLowerCase()} in series state.`);
  return normalized;
}

function timelineEvents(value: unknown, bookIds: readonly string[]): readonly SeriesTimelineEvent[] {
  if (!Array.isArray(value)) throw new Error("Series timeline must be an array.");
  const eventIds = new Set<string>();
  return value.map((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid series timeline event.");
    const event = raw as Record<string, unknown>;
    const normalized: SeriesTimelineEvent = {
      id: required(event.id, "Timeline event id"),
      date: required(event.date, "Timeline date"),
      bookId: required(event.bookId, "Timeline book id"),
      description: required(event.description, "Timeline description"),
    };
    if (eventIds.has(normalized.id)) throw new Error(`Duplicate timeline event id "${normalized.id}" in series state.`);
    eventIds.add(normalized.id);
    if (!bookIds.includes(normalized.bookId)) throw new Error(`Timeline event references book "${normalized.bookId}" outside the series.`);
    return normalized;
  });
}

export function createSeries(input: {
  id?: string;
  projectId: string;
  name: string;
  bookIds?: readonly string[];
  sharedCharacters?: readonly string[];
  worldRules?: readonly string[];
  visualIdentityIds?: readonly string[];
  locations?: readonly string[];
  terminology?: readonly string[];
  history?: readonly string[];
  unresolvedThreads?: readonly string[];
  timeline?: readonly SeriesTimelineEvent[];
}): SeriesState {
  return validateSeriesState({
    id: input.id ?? `series_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    projectId: input.projectId,
    name: input.name,
    bookIds: input.bookIds ?? [],
    sharedCharacters: input.sharedCharacters ?? [],
    worldRules: input.worldRules ?? [],
    visualIdentityIds: input.visualIdentityIds ?? [],
    locations: input.locations ?? [],
    terminology: input.terminology ?? [],
    history: input.history ?? [],
    unresolvedThreads: input.unresolvedThreads ?? [],
    timeline: input.timeline ?? [],
  });
}

export function validateSeriesState(value: SeriesState): SeriesState {
  if (!value || typeof value !== "object") throw new Error("Invalid series state.");
  const bookIds = stringArray(value.bookIds, "Book id");
  const validated: SeriesState = {
    id: required(value.id, "Series id"),
    projectId: required(value.projectId, "Project id"),
    name: required(value.name, "Series name"),
    bookIds,
    sharedCharacters: stringArray(value.sharedCharacters, "Character id"),
    worldRules: stringArray(value.worldRules, "World rule"),
    visualIdentityIds: stringArray(value.visualIdentityIds, "Visual identity id"),
    locations: stringArray(value.locations, "Location"),
    terminology: stringArray(value.terminology, "Term"),
    history: stringArray(value.history, "History item"),
    unresolvedThreads: stringArray(value.unresolvedThreads, "Unresolved thread"),
    timeline: timelineEvents(value.timeline, bookIds),
  };
  return clone(validated);
}

export function updateSeriesDetails(series: SeriesState, update: SeriesDetailsUpdate): SeriesState {
  return validateSeriesState({
    ...series,
    ...(update.name === undefined ? {} : { name: update.name }),
    ...(update.sharedCharacters === undefined ? {} : { sharedCharacters: update.sharedCharacters }),
    ...(update.worldRules === undefined ? {} : { worldRules: update.worldRules }),
    ...(update.visualIdentityIds === undefined ? {} : { visualIdentityIds: update.visualIdentityIds }),
    ...(update.locations === undefined ? {} : { locations: update.locations }),
    ...(update.terminology === undefined ? {} : { terminology: update.terminology }),
    ...(update.history === undefined ? {} : { history: update.history }),
    ...(update.unresolvedThreads === undefined ? {} : { unresolvedThreads: update.unresolvedThreads }),
  });
}

export function addBookToSeries(series: SeriesState, bookId: string): SeriesState {
  const id = required(bookId, "Book id");
  if (series.bookIds.includes(id)) throw new Error(`Book "${id}" is already in the series.`);
  return validateSeriesState({ ...series, bookIds: [...series.bookIds, id] });
}

export function removeBookFromSeries(series: SeriesState, bookId: string): SeriesState {
  const id = required(bookId, "Book id");
  if (!series.bookIds.includes(id)) throw new Error(`Book "${id}" is not in the series.`);
  if (series.timeline.some((event) => event.bookId === id)) {
    throw new Error(`Book "${id}" still has series timeline events. Remove those events before removing the book.`);
  }
  return validateSeriesState({ ...series, bookIds: series.bookIds.filter((candidate) => candidate !== id) });
}

export function reorderSeriesBooks(series: SeriesState, orderedBookIds: readonly string[]): SeriesState {
  const requested = stringArray(orderedBookIds, "Book id");
  if (requested.length !== series.bookIds.length || requested.some((id) => !series.bookIds.includes(id))) {
    throw new Error("Series book order must contain every current series book exactly once.");
  }
  return validateSeriesState({ ...series, bookIds: requested });
}

export function addSeriesTimelineEvent(series: SeriesState, event: SeriesTimelineEvent): SeriesState {
  const normalized = timelineEvents([event], series.bookIds)[0];
  if (series.timeline.some((item) => item.id === normalized.id)) throw new Error(`Timeline event "${normalized.id}" already exists.`);
  return validateSeriesState({ ...series, timeline: [...series.timeline, normalized] });
}

export function removeSeriesTimelineEvent(series: SeriesState, eventId: string): SeriesState {
  const id = required(eventId, "Timeline event id");
  if (!series.timeline.some((event) => event.id === id)) throw new Error(`Timeline event "${id}" not found.`);
  return validateSeriesState({ ...series, timeline: series.timeline.filter((event) => event.id !== id) });
}

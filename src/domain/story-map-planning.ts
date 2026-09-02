export const STORY_MAP_PLANNING_FORMAT_VERSION = 1 as const;
export const STORY_MAP_PLOTLINE_KINDS = ["main", "subplot", "character-arc"] as const;
export type StoryMapPlotlineKind = typeof STORY_MAP_PLOTLINE_KINDS[number];

export interface StoryMapSceneAttributes {
  readonly povCharacterIds: readonly string[];
  readonly location: string;
  readonly storyTime: string;
  readonly goal: string;
  readonly conflict: string;
  readonly outcome: string;
  readonly emotionalBeat: string;
  readonly tags: readonly string[];
}

export interface StoryMapPlotline {
  readonly id: string;
  readonly bookId: string;
  readonly name: string;
  readonly kind: StoryMapPlotlineKind;
  readonly description: string;
  readonly characterId?: string;
  readonly sceneIds: readonly string[];
  readonly order: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface StoryMapPlanningState {
  readonly formatVersion: typeof STORY_MAP_PLANNING_FORMAT_VERSION;
  readonly sceneAttributes: Readonly<Record<string, StoryMapSceneAttributes>>;
  readonly plotlines: readonly StoryMapPlotline[];
}

export function createStoryMapPlanningState(): StoryMapPlanningState {
  return { formatVersion: STORY_MAP_PLANNING_FORMAT_VERSION, sceneAttributes: {}, plotlines: [] };
}

export function createStoryMapSceneAttributes(input: Partial<StoryMapSceneAttributes> = {}): StoryMapSceneAttributes {
  return validateStoryMapSceneAttributes({
    povCharacterIds: input.povCharacterIds ?? [],
    location: input.location ?? "",
    storyTime: input.storyTime ?? "",
    goal: input.goal ?? "",
    conflict: input.conflict ?? "",
    outcome: input.outcome ?? "",
    emotionalBeat: input.emotionalBeat ?? "",
    tags: input.tags ?? [],
  });
}

export function setStoryMapSceneAttributes(state: StoryMapPlanningState, sceneId: string, attributes: StoryMapSceneAttributes): StoryMapPlanningState {
  const validated = validateStoryMapPlanningState(state);
  const id = identifier(sceneId, "Story Map scene id");
  const value = validateStoryMapSceneAttributes(attributes);
  return validateStoryMapPlanningState({
    ...validated,
    sceneAttributes: { ...validated.sceneAttributes, [id]: value },
  });
}

export function removeStoryMapSceneAttributes(state: StoryMapPlanningState, sceneId: string): StoryMapPlanningState {
  const validated = validateStoryMapPlanningState(state);
  const id = identifier(sceneId, "Story Map scene id");
  const next = { ...validated.sceneAttributes };
  delete next[id];
  return validateStoryMapPlanningState({ ...validated, sceneAttributes: next });
}

export function createStoryMapPlotline(input: {
  id: string;
  bookId: string;
  name: string;
  kind?: StoryMapPlotlineKind;
  description?: string;
  characterId?: string;
  sceneIds?: readonly string[];
  order?: number;
  now?: string;
}): StoryMapPlotline {
  const now = timestamp(input.now ?? new Date().toISOString(), "Story Map plotline timestamp");
  return validateStoryMapPlotline({
    id: identifier(input.id, "Story Map plotline id"),
    bookId: identifier(input.bookId, "Story Map plotline book id"),
    name: requiredText(input.name, "Story Map plotline name", 300),
    kind: plotlineKind(input.kind ?? "subplot"),
    description: optionalText(input.description, "Story Map plotline description", 4000),
    ...(input.characterId ? { characterId: identifier(input.characterId, "Story Map plotline character id") } : {}),
    sceneIds: uniqueIds(input.sceneIds ?? [], "Story Map plotline scene id"),
    order: positiveInteger(input.order ?? 1, "Story Map plotline order"),
    createdAt: now,
    updatedAt: now,
  });
}

export function upsertStoryMapPlotline(state: StoryMapPlanningState, plotline: StoryMapPlotline): StoryMapPlanningState {
  const validated = validateStoryMapPlanningState(state);
  const value = validateStoryMapPlotline(plotline);
  const sameBook = validated.plotlines.filter((item) => item.bookId === value.bookId && item.id !== value.id);
  if (sameBook.some((item) => item.name.toLocaleLowerCase() === value.name.toLocaleLowerCase())) {
    throw new Error(`Story Map plotline name "${value.name}" already exists in book "${value.bookId}".`);
  }
  const plotlines = validated.plotlines.some((item) => item.id === value.id)
    ? validated.plotlines.map((item) => item.id === value.id ? value : item)
    : [...validated.plotlines, value];
  return validateStoryMapPlanningState({ ...validated, plotlines });
}

export function removeStoryMapPlotline(state: StoryMapPlanningState, plotlineId: string): StoryMapPlanningState {
  const validated = validateStoryMapPlanningState(state);
  const id = identifier(plotlineId, "Story Map plotline id");
  return validateStoryMapPlanningState({ ...validated, plotlines: validated.plotlines.filter((item) => item.id !== id) });
}

export function assignSceneToStoryMapPlotlines(state: StoryMapPlanningState, sceneId: string, plotlineIds: readonly string[], now = new Date().toISOString()): StoryMapPlanningState {
  const validated = validateStoryMapPlanningState(state);
  const scene = identifier(sceneId, "Story Map scene id");
  const selected = new Set(uniqueIds(plotlineIds, "Story Map plotline id"));
  for (const id of selected) if (!validated.plotlines.some((plotline) => plotline.id === id)) throw new Error(`Story Map plotline "${id}" not found.`);
  const updatedAt = timestamp(now, "Story Map plotline updated timestamp");
  return validateStoryMapPlanningState({
    ...validated,
    plotlines: validated.plotlines.map((plotline) => {
      const has = plotline.sceneIds.includes(scene);
      const should = selected.has(plotline.id);
      if (has === should) return plotline;
      return {
        ...plotline,
        sceneIds: should ? [...plotline.sceneIds, scene] : plotline.sceneIds.filter((id) => id !== scene),
        updatedAt,
      };
    }),
  });
}

export function validateStoryMapPlanningState(value: unknown): StoryMapPlanningState {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Story Map planning state.");
  const state = value as Record<string, unknown>;
  if (state.formatVersion !== STORY_MAP_PLANNING_FORMAT_VERSION) throw new Error("Unsupported Story Map planning format.");
  if (!state.sceneAttributes || typeof state.sceneAttributes !== "object" || Array.isArray(state.sceneAttributes)) throw new Error("Invalid Story Map scene attributes map.");
  const sceneAttributes: Record<string, StoryMapSceneAttributes> = {};
  for (const [sceneId, attributes] of Object.entries(state.sceneAttributes as Record<string, unknown>)) {
    sceneAttributes[identifier(sceneId, "Story Map scene id")] = validateStoryMapSceneAttributes(attributes);
  }
  if (!Array.isArray(state.plotlines)) throw new Error("Invalid Story Map plotline collection.");
  const ids = new Set<string>();
  const plotlines = state.plotlines.map((item) => {
    const plotline = validateStoryMapPlotline(item);
    if (ids.has(plotline.id)) throw new Error(`Duplicate Story Map plotline id "${plotline.id}".`);
    ids.add(plotline.id);
    return plotline;
  }).sort((a, b) => a.bookId.localeCompare(b.bookId) || a.order - b.order || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  return { formatVersion: STORY_MAP_PLANNING_FORMAT_VERSION, sceneAttributes, plotlines };
}

export function validateStoryMapSceneAttributes(value: unknown): StoryMapSceneAttributes {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Story Map scene attributes.");
  const input = value as Partial<StoryMapSceneAttributes>;
  return {
    povCharacterIds: uniqueIds(input.povCharacterIds ?? [], "Story Map POV character id"),
    location: optionalText(input.location, "Story Map scene location", 500),
    storyTime: optionalText(input.storyTime, "Story Map scene time", 500),
    goal: optionalText(input.goal, "Story Map scene goal", 3000),
    conflict: optionalText(input.conflict, "Story Map scene conflict", 3000),
    outcome: optionalText(input.outcome, "Story Map scene outcome", 3000),
    emotionalBeat: optionalText(input.emotionalBeat, "Story Map emotional beat", 2000),
    tags: uniqueText(input.tags ?? [], "Story Map scene tag", 120, 30),
  };
}

export function validateStoryMapPlotline(value: unknown): StoryMapPlotline {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Story Map plotline.");
  const plotline = value as StoryMapPlotline;
  const kind = plotlineKind(plotline.kind);
  const characterId = plotline.characterId === undefined ? undefined : identifier(plotline.characterId, "Story Map plotline character id");
  if (kind === "character-arc" && !characterId) throw new Error("Character-arc plotlines require a character id.");
  const createdAt = timestamp(plotline.createdAt, "Story Map plotline created timestamp");
  const updatedAt = timestamp(plotline.updatedAt, "Story Map plotline updated timestamp");
  if (Date.parse(updatedAt) < Date.parse(createdAt)) throw new Error(`Story Map plotline "${plotline.id}" updatedAt cannot precede createdAt.`);
  return {
    id: identifier(plotline.id, "Story Map plotline id"),
    bookId: identifier(plotline.bookId, "Story Map plotline book id"),
    name: requiredText(plotline.name, "Story Map plotline name", 300),
    kind,
    description: optionalText(plotline.description, "Story Map plotline description", 4000),
    ...(characterId ? { characterId } : {}),
    sceneIds: uniqueIds(plotline.sceneIds, "Story Map plotline scene id"),
    order: positiveInteger(plotline.order, "Story Map plotline order"),
    createdAt,
    updatedAt,
  };
}

function plotlineKind(value: unknown): StoryMapPlotlineKind {
  if (typeof value !== "string" || !STORY_MAP_PLOTLINE_KINDS.includes(value as StoryMapPlotlineKind)) throw new Error("Invalid Story Map plotline kind.");
  return value as StoryMapPlotlineKind;
}
function identifier(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim() || value !== value.trim() || value.length > 300 || /[\r\n]/.test(value)) throw new Error(`${label} is invalid.`);
  return value;
}
function requiredText(value: unknown, label: string, max: number): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  const result = value.trim();
  if (result.length > max) throw new Error(`${label} exceeds ${max} characters.`);
  return result;
}
function optionalText(value: unknown, label: string, max: number): string {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") throw new Error(`${label} must be text.`);
  const result = value.trim();
  if (result.length > max) throw new Error(`${label} exceeds ${max} characters.`);
  return result;
}
function uniqueIds(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value)) throw new Error(`${label} collection is invalid.`);
  return [...new Set(value.map((item) => identifier(item, label)))];
}
function uniqueText(value: unknown, label: string, maxLength: number, maxItems: number): readonly string[] {
  if (!Array.isArray(value)) throw new Error(`${label} collection is invalid.`);
  if (value.length > maxItems) throw new Error(`${label} collection exceeds ${maxItems} items.`);
  const output: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string" || !item.trim()) throw new Error(`${label} is invalid.`);
    const text = item.trim();
    if (text.length > maxLength) throw new Error(`${label} exceeds ${maxLength} characters.`);
    const key = text.toLocaleLowerCase();
    if (!seen.has(key)) { seen.add(key); output.push(text); }
  }
  return output;
}
function positiveInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) < 1) throw new Error(`${label} must be a positive integer.`);
  return Number(value);
}
function timestamp(value: unknown, label: string): string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new Error(`${label} is invalid.`);
  return new Date(value).toISOString();
}

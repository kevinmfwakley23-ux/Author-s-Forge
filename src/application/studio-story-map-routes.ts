import type { IncomingMessage, ServerResponse } from "node:http";
import type { FileProjectStore } from "../infrastructure/file-project-store";
import { STORY_MAP_PLOTLINE_KINDS, type StoryMapChapterCard, type StoryMapPlotlineKind, type StoryMapSceneAttributes } from "../domain/story-map-planning";
import { StudioStoryMapPlanningService } from "./studio-story-map-planning";

export type StudioStoryMapRouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL, projectId: string) => Promise<boolean>;

export function createStudioStoryMapRoutes(
  projects: FileProjectStore,
  planning = new StudioStoryMapPlanningService(projects),
): StudioStoryMapRouteHandler {
  return async (req, res, url, projectId) => {
    const root = `/api/projects/${projectId}/story-map`;
    if (url.pathname === `${root}/planning` && req.method === "GET") {
      json(res, 200, await planning.snapshot(projectId));
      return true;
    }

    const chapterCardMatch = url.pathname.match(new RegExp(`^${escapeRegExp(root)}/chapters/([^/]+)/([^/]+)/card$`));
    if (chapterCardMatch && req.method === "PUT") {
      const input = await body(req);
      json(res, 200, await planning.setChapterCard(projectId, {
        bookId: decode(chapterCardMatch[1]),
        chapterId: decode(chapterCardMatch[2]),
        card: chapterCard(input.card),
        now: optionalString(input.now, "now"),
      }));
      return true;
    }
    if (chapterCardMatch && req.method === "DELETE") {
      json(res, 200, await planning.removeChapterCard(projectId, decode(chapterCardMatch[1]), decode(chapterCardMatch[2])));
      return true;
    }

    const sceneMatch = url.pathname.match(new RegExp(`^${escapeRegExp(root)}/scenes/([^/]+)/([^/]+)/([^/]+)/planning$`));
    if (sceneMatch && req.method === "PUT") {
      const input = await body(req);
      json(res, 200, await planning.setSceneAttributes(projectId, {
        bookId: decode(sceneMatch[1]),
        chapterId: decode(sceneMatch[2]),
        sceneId: decode(sceneMatch[3]),
        attributes: sceneAttributes(input.attributes),
        plotlineIds: optionalStringArray(input.plotlineIds, "plotlineIds"),
        now: optionalString(input.now, "now"),
      }));
      return true;
    }

    if (url.pathname === `${root}/plotlines` && req.method === "POST") {
      const input = await body(req);
      json(res, 201, await planning.createPlotline(projectId, {
        id: optionalString(input.id, "id"),
        bookId: requiredString(input.bookId, "bookId"),
        name: requiredString(input.name, "name"),
        kind: optionalKind(input.kind),
        description: optionalString(input.description, "description"),
        characterId: optionalString(input.characterId, "characterId"),
        sceneIds: optionalStringArray(input.sceneIds, "sceneIds"),
        order: optionalInteger(input.order, "order"),
        now: optionalString(input.now, "now"),
      }));
      return true;
    }

    const plotlineMatch = url.pathname.match(new RegExp(`^${escapeRegExp(root)}/plotlines/([^/]+)$`));
    if (plotlineMatch && req.method === "PUT") {
      const input = await body(req);
      json(res, 200, await planning.updatePlotline(projectId, decode(plotlineMatch[1]), {
        name: optionalString(input.name, "name"),
        kind: optionalKind(input.kind),
        description: optionalString(input.description, "description"),
        characterId: input.characterId === null ? null : optionalString(input.characterId, "characterId"),
        sceneIds: optionalStringArray(input.sceneIds, "sceneIds"),
        order: optionalInteger(input.order, "order"),
        now: optionalString(input.now, "now"),
      }));
      return true;
    }
    if (plotlineMatch && req.method === "DELETE") {
      json(res, 200, await planning.removePlotline(projectId, decode(plotlineMatch[1])));
      return true;
    }
    return false;
  };
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of req) {
    raw += String(chunk);
    if (raw.length > 250_000) throw new Error("Story Map request body exceeds 250 KB.");
  }
  if (!raw.trim()) return {};
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Story Map request body must be a JSON object.");
  return parsed as Record<string, unknown>;
}

function sceneAttributes(value: unknown): Partial<StoryMapSceneAttributes> {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("attributes must be a JSON object.");
  const input = value as Record<string, unknown>;
  return {
    povCharacterIds: optionalStringArray(input.povCharacterIds, "povCharacterIds") ?? [],
    location: optionalString(input.location, "location") ?? "",
    storyTime: optionalString(input.storyTime, "storyTime") ?? "",
    goal: optionalString(input.goal, "goal") ?? "",
    conflict: optionalString(input.conflict, "conflict") ?? "",
    outcome: optionalString(input.outcome, "outcome") ?? "",
    emotionalBeat: optionalString(input.emotionalBeat, "emotionalBeat") ?? "",
    tags: optionalStringArray(input.tags, "tags") ?? [],
  };
}

function chapterCard(value: unknown): Partial<StoryMapChapterCard> {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("card must be a JSON object.");
  const input = value as Record<string, unknown>;
  return {
    povCharacterIds: optionalStringArray(input.povCharacterIds, "povCharacterIds") ?? [],
    location: optionalString(input.location, "location") ?? "",
    storyTime: optionalString(input.storyTime, "storyTime") ?? "",
    emotionalObjective: optionalString(input.emotionalObjective, "emotionalObjective") ?? "",
    plotObjective: optionalString(input.plotObjective, "plotObjective") ?? "",
    characterIds: optionalStringArray(input.characterIds, "characterIds") ?? [],
    requiredEvents: optionalStringArray(input.requiredEvents, "requiredEvents") ?? [],
    clues: optionalStringArray(input.clues, "clues") ?? [],
    reveals: optionalStringArray(input.reveals, "reveals") ?? [],
    continuityDependencies: optionalStringArray(input.continuityDependencies, "continuityDependencies") ?? [],
    atmosphere: optionalString(input.atmosphere, "atmosphere") ?? "",
    endingHook: optionalString(input.endingHook, "endingHook") ?? "",
    approximateWordCount: optionalNonNegativeInteger(input.approximateWordCount, "approximateWordCount") ?? 0,
    forbiddenDeviations: optionalStringArray(input.forbiddenDeviations, "forbiddenDeviations") ?? [],
  };
}
function optionalKind(value: unknown): StoryMapPlotlineKind | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !STORY_MAP_PLOTLINE_KINDS.includes(value as StoryMapPlotlineKind)) throw new Error("Invalid Story Map plotline kind.");
  return value as StoryMapPlotlineKind;
}
function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value;
}
function optionalString(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error(`${label} must be a string.`);
  return value;
}
function optionalStringArray(value: unknown, label: string): readonly string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw new Error(`${label} must be an array of strings.`);
  return value as string[];
}
function optionalInteger(value: unknown, label: string): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const result = Number(value);
  if (!Number.isInteger(result) || result < 1) throw new Error(`${label} must be a positive integer.`);
  return result;
}
function optionalNonNegativeInteger(value: unknown, label: string): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const result = Number(value);
  if (!Number.isInteger(result) || result < 0) throw new Error(`${label} must be a non-negative integer.`);
  return result;
}
function decode(value: string): string { return decodeURIComponent(value); }
function escapeRegExp(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(JSON.stringify(value));
}

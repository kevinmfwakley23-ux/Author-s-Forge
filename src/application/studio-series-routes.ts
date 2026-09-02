import type { IncomingMessage, ServerResponse } from "node:http";
import type { FileProjectStore } from "../infrastructure/file-project-store";
import type { SeriesDetailsUpdate, SeriesTimelineEvent } from "../domain/series";
import { StudioSeriesService } from "./studio-series";

export type StudioSeriesRouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL, projectId: string) => Promise<boolean>;

export function createStudioSeriesRoutes(
  projects: FileProjectStore,
  service = new StudioSeriesService(projects),
): StudioSeriesRouteHandler {
  return async (req, res, url, projectId) => {
    const root = `/api/projects/${projectId}/series`;

    if (url.pathname === root && req.method === "GET") {
      json(res, 200, await service.snapshot(projectId));
      return true;
    }
    if (url.pathname === root && req.method === "POST") {
      const input = await body(req);
      json(res, 201, await service.create(projectId, {
        id: optionalString(input.id, "id", 160),
        name: requiredString(input.name, "name", 240),
        bookIds: optionalStringArray(input.bookIds, "bookIds", 500),
        ...details(input),
        now: optionalTimestamp(input.now, "now"),
      }));
      return true;
    }

    const seriesMatch = url.pathname.match(new RegExp(`^${escapeRegExp(root)}/([^/]+)$`));
    if (seriesMatch && req.method === "PUT") {
      const input = await body(req);
      json(res, 200, await service.update(projectId, decode(seriesMatch[1]), details(input), optionalTimestamp(input.now, "now")));
      return true;
    }
    if (seriesMatch && req.method === "DELETE") {
      const input = await optionalBody(req);
      json(res, 200, await service.remove(projectId, decode(seriesMatch[1]), optionalTimestamp(input.now, "now")));
      return true;
    }

    const booksRoot = url.pathname.match(new RegExp(`^${escapeRegExp(root)}/([^/]+)/books$`));
    if (booksRoot && req.method === "POST") {
      const input = await body(req);
      json(res, 200, await service.addBook(projectId, decode(booksRoot[1]), requiredString(input.bookId, "bookId", 200), optionalTimestamp(input.now, "now")));
      return true;
    }
    if (booksRoot && req.method === "PUT") {
      const input = await body(req);
      json(res, 200, await service.reorderBooks(projectId, decode(booksRoot[1]), requiredStringArray(input.bookIds, "bookIds", 500), optionalTimestamp(input.now, "now")));
      return true;
    }

    const bookMatch = url.pathname.match(new RegExp(`^${escapeRegExp(root)}/([^/]+)/books/([^/]+)$`));
    if (bookMatch && req.method === "DELETE") {
      const input = await optionalBody(req);
      json(res, 200, await service.removeBook(projectId, decode(bookMatch[1]), decode(bookMatch[2]), optionalTimestamp(input.now, "now")));
      return true;
    }

    const timelineRoot = url.pathname.match(new RegExp(`^${escapeRegExp(root)}/([^/]+)/timeline$`));
    if (timelineRoot && req.method === "POST") {
      const input = await body(req);
      const event: SeriesTimelineEvent = {
        id: requiredString(input.id, "id", 160),
        date: requiredString(input.date, "date", 240),
        bookId: requiredString(input.bookId, "bookId", 200),
        description: requiredString(input.description, "description", 8_000),
      };
      json(res, 201, await service.addTimelineEvent(projectId, decode(timelineRoot[1]), event, optionalTimestamp(input.now, "now")));
      return true;
    }

    const timelineMatch = url.pathname.match(new RegExp(`^${escapeRegExp(root)}/([^/]+)/timeline/([^/]+)$`));
    if (timelineMatch && req.method === "DELETE") {
      const input = await optionalBody(req);
      json(res, 200, await service.removeTimelineEvent(projectId, decode(timelineMatch[1]), decode(timelineMatch[2]), optionalTimestamp(input.now, "now")));
      return true;
    }

    return false;
  };
}

function details(input: Record<string, unknown>): SeriesDetailsUpdate {
  return {
    ...(input.name === undefined ? {} : { name: requiredString(input.name, "name", 240) }),
    ...(input.sharedCharacters === undefined ? {} : { sharedCharacters: requiredStringArray(input.sharedCharacters, "sharedCharacters", 500) }),
    ...(input.worldRules === undefined ? {} : { worldRules: requiredStringArray(input.worldRules, "worldRules", 500) }),
    ...(input.visualIdentityIds === undefined ? {} : { visualIdentityIds: requiredStringArray(input.visualIdentityIds, "visualIdentityIds", 500) }),
    ...(input.locations === undefined ? {} : { locations: requiredStringArray(input.locations, "locations", 500) }),
    ...(input.terminology === undefined ? {} : { terminology: requiredStringArray(input.terminology, "terminology", 500) }),
    ...(input.history === undefined ? {} : { history: requiredStringArray(input.history, "history", 500) }),
    ...(input.unresolvedThreads === undefined ? {} : { unresolvedThreads: requiredStringArray(input.unresolvedThreads, "unresolvedThreads", 500) }),
  };
}

async function optionalBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of req) {
    raw += String(chunk);
    if (raw.length > 256 * 1024) throw new Error("Series request body exceeds 256 KiB limit.");
  }
  if (!raw.trim()) return {};
  const value = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Series JSON object body required.");
  return value as Record<string, unknown>;
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  const value = await optionalBody(req);
  return value;
}

function requiredString(value: unknown, label: string, max: number): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  const text = value.trim();
  if (text.length > max) throw new Error(`${label} exceeds ${max} characters.`);
  return text;
}

function optionalString(value: unknown, label: string, max: number): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return requiredString(value, label, max);
}

function requiredStringArray(value: unknown, label: string, maxItems: number): readonly string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array of strings.`);
  if (value.length > maxItems) throw new Error(`${label} exceeds ${maxItems} items.`);
  const items = value.map((item) => requiredString(item, label, 8_000));
  if (new Set(items).size !== items.length) throw new Error(`${label} must not contain duplicates.`);
  return items;
}

function optionalStringArray(value: unknown, label: string, maxItems: number): readonly string[] | undefined {
  if (value === undefined || value === null) return undefined;
  return requiredStringArray(value, label, maxItems);
}

function optionalTimestamp(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const text = requiredString(value, label, 100);
  if (Number.isNaN(Date.parse(text))) throw new Error(`${label} must be a valid timestamp.`);
  return text;
}

function decode(value: string): string { return decodeURIComponent(value); }
function escapeRegExp(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(JSON.stringify(value));
}

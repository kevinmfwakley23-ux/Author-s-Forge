import type { IncomingMessage, ServerResponse } from "node:http";
import type { SceneCardDetails } from "../domain/scene-card-workflow";
import type { FileProjectStore } from "../infrastructure/file-project-store";
import { StudioSceneCardWorkflowService } from "./studio-scene-card-workflow";

export type StudioSceneCardWorkflowRouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL, projectId: string) => Promise<boolean>;

export function createStudioSceneCardWorkflowRoutes(
  projects: FileProjectStore,
  service = new StudioSceneCardWorkflowService(projects),
): StudioSceneCardWorkflowRouteHandler {
  return async (req, res, url, projectId) => {
    const root = `/api/projects/${projectId}/scene-cards`;
    if (url.pathname === root && req.method === "GET") {
      json(res, 200, await service.snapshot(projectId));
      return true;
    }

    const match = url.pathname.match(new RegExp(`^${escapeRegExp(root)}/([^/]+)/([^/]+)/([^/]+)(?:/(approve|revoke|draft-brief))?$`));
    if (!match) return false;
    const bookId = decode(match[1]);
    const chapterId = decode(match[2]);
    const sceneId = decode(match[3]);
    const action = match[4] ?? "";

    if (!action && req.method === "PUT") {
      const input = await body(req);
      json(res, 200, await service.saveCard(projectId, {
        bookId,
        chapterId,
        sceneId,
        details: details(input.details),
        now: optionalString(input.now, "now"),
      }));
      return true;
    }
    if (!action && req.method === "DELETE") {
      const input = await optionalBody(req);
      json(res, 200, await service.removeCard(projectId, { bookId, chapterId, sceneId, now: optionalString(input.now, "now") }));
      return true;
    }
    if (action === "approve" && req.method === "POST") {
      const input = await body(req);
      json(res, 200, await service.approveCard(projectId, {
        bookId,
        chapterId,
        sceneId,
        authorApproved: input.authorApproved === true,
        now: optionalString(input.now, "now"),
      }));
      return true;
    }
    if (action === "revoke" && req.method === "POST") {
      const input = await optionalBody(req);
      json(res, 200, await service.revokeApproval(projectId, { bookId, chapterId, sceneId, now: optionalString(input.now, "now") }));
      return true;
    }
    if (action === "draft-brief" && req.method === "POST") {
      await optionalBody(req);
      json(res, 200, await service.draftBrief(projectId, { bookId, chapterId, sceneId }));
      return true;
    }
    return false;
  };
}

async function optionalBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of req) {
    raw += String(chunk);
    if (raw.length > 250_000) throw new Error("Scene Card request body exceeds 250 KB.");
  }
  if (!raw.trim()) return {};
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Scene Card request body must be a JSON object.");
  return parsed as Record<string, unknown>;
}
async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  const input = await optionalBody(req);
  return input;
}
function details(value: unknown): Partial<SceneCardDetails> {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("details must be a JSON object.");
  const input = value as Record<string, unknown>;
  return {
    purpose: optionalString(input.purpose, "purpose") ?? "",
    openingSituation: optionalString(input.openingSituation, "openingSituation") ?? "",
    closingSituation: optionalString(input.closingSituation, "closingSituation") ?? "",
    characterIds: optionalStringArray(input.characterIds, "characterIds") ?? [],
    requiredEvents: optionalStringArray(input.requiredEvents, "requiredEvents") ?? [],
    clues: optionalStringArray(input.clues, "clues") ?? [],
    reveals: optionalStringArray(input.reveals, "reveals") ?? [],
    continuityDependencies: optionalStringArray(input.continuityDependencies, "continuityDependencies") ?? [],
    atmosphere: optionalString(input.atmosphere, "atmosphere") ?? "",
    approximateWordCount: optionalNonNegativeInteger(input.approximateWordCount, "approximateWordCount") ?? 0,
    forbiddenDeviations: optionalStringArray(input.forbiddenDeviations, "forbiddenDeviations") ?? [],
    notes: optionalString(input.notes, "notes") ?? "",
  };
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

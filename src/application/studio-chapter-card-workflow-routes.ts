import type { IncomingMessage, ServerResponse } from "node:http";
import type { FileProjectStore } from "../infrastructure/file-project-store";
import { generateProjectText } from "../infrastructure/ai-provider";
import { aiMissionRoutingGenerationFields, parseAiMissionRoutingPreference } from "./ai-mission-routing";
import { StudioChapterCardWorkflowService, type ChapterCardPlanGenerator } from "./studio-chapter-card-workflow";

export type StudioChapterCardWorkflowRouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL, projectId: string) => Promise<boolean>;

export function createStudioChapterCardWorkflowRoutes(
  projects: FileProjectStore,
  generator?: ChapterCardPlanGenerator,
): StudioChapterCardWorkflowRouteHandler {
  const service = new StudioChapterCardWorkflowService(projects, generator);
  return async (req, res, url, projectId) => {
    const root = `/api/projects/${projectId}/story-map/chapter-card-workflow`;
    if (url.pathname === root && req.method === "GET") {
      json(res, 200, await service.snapshot(projectId));
      return true;
    }
    if (url.pathname === `${root}/generate` && req.method === "POST") {
      const input = await body(req);
      const routingPreference = parseAiMissionRoutingPreference(input.routingPreference);
      const routedGenerator: ChapterCardPlanGenerator = async (request) =>
        (generator ?? generateProjectText)({
          ...request,
          ...aiMissionRoutingGenerationFields(routingPreference),
        });
      const routedService = new StudioChapterCardWorkflowService(projects, routedGenerator);
      json(res, 201, await routedService.generateChapterCards(projectId, {
        bookId: requiredString(input.bookId, "bookId"),
        description: requiredString(input.description, "description"),
        events: optionalStringArray(input.events, "events"),
        timelineDetails: optionalStringArray(input.timelineDetails, "timelineDetails"),
        targetChapters: optionalPositiveInteger(input.targetChapters, "targetChapters"),
        replaceExistingCards: input.replaceExistingCards === true,
        now: optionalString(input.now, "now"),
      }));
      return true;
    }

    const candidateMatch = url.pathname.match(new RegExp(`^${escapeRegExp(root)}/candidates/([^/]+)/(approve|reject)$`));
    if (candidateMatch && req.method === "POST") {
      const input = await body(req);
      const id = decodeURIComponent(candidateMatch[1]);
      if (candidateMatch[2] === "approve") {
        json(res, 200, await service.approveCandidate(projectId, id, {
          authorApproved: input.authorApproved === true,
          now: optionalString(input.now, "now"),
        }));
      } else {
        json(res, 200, await service.rejectCandidate(projectId, id, { now: optionalString(input.now, "now") }));
      }
      return true;
    }

    const cardApprovalMatch = url.pathname.match(new RegExp(`^${escapeRegExp(root)}/chapters/([^/]+)/([^/]+)/approve$`));
    if (cardApprovalMatch && req.method === "POST") {
      const input = await body(req);
      json(res, 200, await service.approveCard(projectId, {
        bookId: decodeURIComponent(cardApprovalMatch[1]),
        chapterId: decodeURIComponent(cardApprovalMatch[2]),
        authorApproved: input.authorApproved === true,
        now: optionalString(input.now, "now"),
      }));
      return true;
    }
    return false;
  };
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of req) {
    raw += String(chunk);
    if (raw.length > 512 * 1024) throw new Error("Chapter Card workflow request body exceeds 512 KiB.");
  }
  if (!raw.trim()) return {};
  const value = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Chapter Card workflow request body must be a JSON object.");
  return value as Record<string, unknown>;
}
function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
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
function optionalPositiveInteger(value: unknown, label: string): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 100) throw new Error(`${label} must be an integer from 1 through 100.`);
  return number;
}
function escapeRegExp(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(JSON.stringify(value));
}

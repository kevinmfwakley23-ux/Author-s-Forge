import type { IncomingMessage, ServerResponse } from "node:http";
import type { FileProjectStore } from "../infrastructure/file-project-store";
import { StudioStoryArchitectureWorkflowService, type StoryArchitectureGenerator } from "./studio-story-architecture-workflow";
import { StoryArchitectureTemplateService, type StoryArchitectureTemplateBeat } from "./story-architecture-templates";
import { generateProjectText } from "../infrastructure/ai-provider";
import { validateStoryArchitecturePlan } from "../domain/story-architecture-workflow";

export type StudioStoryArchitectureRouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL, projectId: string) => Promise<boolean>;

export function createStudioStoryArchitectureRoutes(
  store: FileProjectStore,
  generator: StoryArchitectureGenerator = generateProjectText,
): StudioStoryArchitectureRouteHandler {
  const service = new StudioStoryArchitectureWorkflowService(store, generator);
  const templates = new StoryArchitectureTemplateService(store);
  return async (req, res, url, projectId) => {
    const root = `/api/projects/${projectId}/story-architecture`;
    if (url.pathname === root && req.method === "GET") {
      json(res, 200, await service.snapshot(projectId));
      return true;
    }
    if (url.pathname === `${root}/templates` && req.method === "GET") {
      json(res, 200, await templates.list(projectId));
      return true;
    }
    if (url.pathname === `${root}/templates/install` && req.method === "POST") {
      const input = await body(req);
      json(res, 201, await templates.install(
        projectId,
        String(input.builtInId ?? ""),
        input.title === undefined || input.title === "" ? undefined : String(input.title),
      ));
      return true;
    }
    if (url.pathname === `${root}/templates` && req.method === "POST") {
      const input = await body(req);
      json(res, 201, await templates.create(projectId, {
        title: String(input.title ?? ""),
        description: input.description === undefined ? undefined : String(input.description),
        bookKinds: optionalStringList(input.bookKinds),
        guidance: stringList(input.guidance),
        beats: beatList(input.beats),
      }));
      return true;
    }
    const templateMatch = url.pathname.match(new RegExp(`^${escapeRegExp(root)}/templates/([^/]+)$`, "u"));
    if (templateMatch) {
      const templateId = decodeURIComponent(templateMatch[1]);
      if (req.method === "PUT") {
        const input = await body(req);
        json(res, 200, await templates.update(projectId, templateId, {
          title: input.title === undefined ? undefined : String(input.title),
          description: input.description === undefined ? undefined : String(input.description),
          bookKinds: input.bookKinds === undefined ? undefined : stringList(input.bookKinds),
          guidance: input.guidance === undefined ? undefined : stringList(input.guidance),
          beats: input.beats === undefined ? undefined : beatList(input.beats),
        }));
        return true;
      }
      if (req.method === "DELETE") {
        json(res, 200, await templates.remove(projectId, templateId));
        return true;
      }
      return false;
    }
    if (url.pathname === `${root}/generate` && req.method === "POST") {
      const input = await body(req);
      json(res, 201, await service.generate(projectId, {
        idea: String(input.idea ?? ""),
        kind: input.kind === undefined ? undefined : String(input.kind),
        targetChapters: input.targetChapters === undefined || input.targetChapters === "" ? undefined : Number(input.targetChapters),
        templateId: input.templateId === undefined || input.templateId === "" ? undefined : String(input.templateId),
      }));
      return true;
    }

    const match = url.pathname.match(new RegExp(`^${escapeRegExp(root)}/candidates/([^/]+)(?:/(approve|revoke|chapter-card-seed))?$`, "u"));
    if (!match) return false;
    const candidateId = decodeURIComponent(match[1]);
    const action = match[2] ?? "";
    if (!action && req.method === "PUT") {
      const input = await body(req);
      json(res, 200, await service.updatePlan(projectId, candidateId, validateStoryArchitecturePlan(input.plan)));
      return true;
    }
    if (action === "approve" && req.method === "POST") {
      const input = await body(req);
      json(res, 200, await service.approve(projectId, candidateId, { authorApproved: input.authorApproved === true }));
      return true;
    }
    if (action === "revoke" && req.method === "POST") {
      json(res, 200, await service.revokeApproval(projectId, candidateId));
      return true;
    }
    if (action === "chapter-card-seed" && req.method === "POST") {
      json(res, 200, await service.chapterCardSeed(projectId, candidateId));
      return true;
    }
    return false;
  };
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of req) {
    raw += String(chunk);
    if (raw.length > 512 * 1024) throw new Error("Story Architecture request body exceeds 512 KiB limit.");
  }
  if (!raw.trim()) return {};
  const value = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Story Architecture JSON object body required.");
  return value as Record<string, unknown>;
}
function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
}
function optionalStringList(value: unknown): string[] | undefined {
  return value === undefined ? undefined : stringList(value);
}
function beatList(value: unknown): StoryArchitectureTemplateBeat[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return { label: "", purpose: "" };
    const row = item as Record<string, unknown>;
    return {
      label: String(row.label ?? ""),
      purpose: String(row.purpose ?? ""),
      ...(row.targetPosition === undefined || row.targetPosition === "" ? {} : { targetPosition: String(row.targetPosition) }),
    };
  });
}
function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(JSON.stringify(value));
}
function escapeRegExp(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
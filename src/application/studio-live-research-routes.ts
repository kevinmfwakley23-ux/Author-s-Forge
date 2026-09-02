import type { IncomingMessage, ServerResponse } from "node:http";
import type { FileProjectStore } from "../infrastructure/file-project-store";
import { RESEARCH_DOMAINS, type ResearchDomain } from "../domain/research";
import { refreshPersistedAiOwnerControl } from "../infrastructure/ai-owner-control-runtime";
import { assertHostedResearchAllowed, StudioLiveResearchService, type StudioLiveResearchInput } from "./studio-live-research";

export type StudioLiveResearchRouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL, projectId: string) => Promise<boolean>;

export function createStudioLiveResearchRoutes(store: FileProjectStore): StudioLiveResearchRouteHandler {
  const service = new StudioLiveResearchService(store);
  return async (req, res, url, projectId) => {
    if (url.pathname === `/api/projects/${projectId}/research/live/status` && req.method === "GET") {
      await requireProject(store, projectId);
      const control = refreshPersistedAiOwnerControl();
      let available = true;
      let reason = "Hosted source-backed research is enabled by the owner spend policy.";
      try { assertHostedResearchAllowed(control); }
      catch (error) { available = false; reason = error instanceof Error ? error.message : String(error); }
      json(res, 200, {
        available,
        reason,
        domains: RESEARCH_DOMAINS,
        sourceBacked: true,
        authority: "working",
        canonEligible: false,
        spendPolicy: control.spendPolicy,
        pinnedProvider: control.pinnedProvider ?? null,
        pinnedModel: control.pinnedModel ?? null,
      });
      return true;
    }
    if (url.pathname === `/api/projects/${projectId}/research/live` && req.method === "POST") {
      await requireProject(store, projectId);
      const input = await body(req);
      const request: StudioLiveResearchInput = {
        question: text(input.question, "Live research question"),
        researchedBecause: text(input.researchedBecause, "Live research rationale"),
        domain: enumValue(input.domain, RESEARCH_DOMAINS, "live research domain") as ResearchDomain,
        ...(optionalText(input.bookId) ? { bookId: optionalText(input.bookId) } : {}),
        ...(optionalText(input.chapterId) ? { chapterId: optionalText(input.chapterId) } : {}),
        ...(optionalText(input.sceneId) ? { sceneId: optionalText(input.sceneId) } : {}),
      };
      json(res, 201, await service.research(projectId, request));
      return true;
    }
    return false;
  };
}

async function requireProject(store: Pick<FileProjectStore, "load">, projectId: string) {
  const project = await store.load(projectId);
  if (!project) throw new Error(`Project "${projectId}" not found.`);
  return project;
}
async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of req) {
    raw += String(chunk);
    if (raw.length > 1024 * 1024) throw new Error("Live research request exceeds 1 MiB.");
  }
  const parsed: unknown = raw.trim() ? JSON.parse(raw) : {};
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Live research JSON object body required.");
  return parsed as Record<string, unknown>;
}
function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  const result = value.trim();
  if (result.length > 5000) throw new Error(`${label} is too long.`);
  return result;
}
function optionalText(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !value.trim() || value.length > 200 || /[\r\n]/.test(value)) throw new Error("Invalid live research scope id.");
  return value.trim();
}
function enumValue<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) throw new Error(`Invalid ${label}.`);
  return value as T;
}
function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(JSON.stringify(value));
}

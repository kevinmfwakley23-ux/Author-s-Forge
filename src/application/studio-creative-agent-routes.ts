import type { IncomingMessage, ServerResponse } from "node:http";
import type { FileProjectStore } from "../infrastructure/file-project-store";
import { creativeToolRegistrySnapshot } from "./creative-tool-registry";

export type StudioCreativeAgentRouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL, projectId: string) => Promise<boolean>;

/** Discoverable, read-only tool metadata for governed creative planning. */
export function createStudioCreativeAgentRoutes(store: FileProjectStore): StudioCreativeAgentRouteHandler {
  return async (req, res, url, projectId) => {
    if (url.pathname !== `/api/projects/${projectId}/agent/tools` || req.method !== "GET") return false;
    const project = await store.load(projectId);
    if (!project) throw new Error(`Project "${projectId}" not found.`);
    json(res, 200, {
      projectId,
      ...creativeToolRegistrySnapshot(),
      authority: "discovery-only",
      executionRule: "Each operation remains subject to its existing Forge route, provider, state, proposal, and author-approval boundary.",
    });
    return true;
  };
}

function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(JSON.stringify(value));
}

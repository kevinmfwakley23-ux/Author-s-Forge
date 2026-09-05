import type { IncomingMessage, ServerResponse } from "node:http";
import type { FileProjectStore } from "../infrastructure/file-project-store";
import type { FileAiModelPerformanceStore } from "../infrastructure/file-ai-model-performance-store";

export type StudioAiModelPerformanceRouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL, projectId: string) => Promise<boolean>;

/** Read-only evidence surface. Recommendations never mutate owner routing. */
export function createStudioAiModelPerformanceRoutes(
  store: Pick<FileProjectStore, "load">,
  performanceStore: FileAiModelPerformanceStore,
): StudioAiModelPerformanceRouteHandler {
  return async (req, res, url, projectId) => {
    if (url.pathname !== `/api/projects/${projectId}/ai/model-performance` || req.method !== "GET") return false;
    await requireProject(store, projectId);
    const minimumSamples = positiveInteger(url.searchParams.get("minimumSamples"), 3, 1, 100);
    const observations = await performanceStore.list(projectId);
    const aggregates = await performanceStore.aggregate(projectId, minimumSamples);
    json(res, 200, {
      projectId,
      minimumSamples,
      observationCount: observations.length,
      aggregates,
      recommendationPolicy: {
        advisoryOnly: true,
        ownerRoutingRemainsAuthoritative: true,
        explanation: "Best-value scores are derived only from recorded Forge ensemble outcomes. Models with insufficient evidence are not promoted automatically.",
      },
      privacy: "Performance evidence stores provider/model, phase, scores, pass/fail, latency, billing class, and timestamps only. Prompt and manuscript text are not stored in this ledger.",
    });
    return true;
  };
}

async function requireProject(store: Pick<FileProjectStore, "load">, projectId: string) {
  const project = await store.load(projectId);
  if (!project) throw new Error(`Project "${projectId}" not found.`);
  return project;
}
function positiveInteger(value: string | null, fallback: number, minimum: number, maximum: number): number {
  if (value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) throw new Error(`minimumSamples must be an integer from ${minimum} to ${maximum}.`);
  return parsed;
}
function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(JSON.stringify(value));
}

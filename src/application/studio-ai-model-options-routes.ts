import type { IncomingMessage, ServerResponse } from "node:http";
import type { FileProjectStore } from "../infrastructure/file-project-store";
import {
  AI_MODEL_OPTION_PROVIDERS,
  loadAiModelRuntimeOptions,
  persistAiModelRuntimeOptions,
} from "../infrastructure/ai-model-options-runtime";
import { aiConfiguredResources } from "../infrastructure/ai-provider";

export type StudioAiModelOptionsRouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL, projectId: string) => Promise<boolean>;

export function createStudioAiModelOptionsRoutes(store: Pick<FileProjectStore, "load">): StudioAiModelOptionsRouteHandler {
  return async (req, res, url, projectId) => {
    if (url.pathname !== `/api/projects/${projectId}/ai/model-options`) return false;
    await requireProject(store, projectId);
    if (req.method === "GET") {
      const options = loadAiModelRuntimeOptions();
      json(res, 200, snapshot(options));
      return true;
    }
    if (req.method === "POST") {
      const input = await body(req);
      const options = persistAiModelRuntimeOptions(input);
      json(res, 200, snapshot(options));
      return true;
    }
    return false;
  };
}

function snapshot(options: ReturnType<typeof loadAiModelRuntimeOptions>) {
  const resources = aiConfiguredResources();
  return {
    options,
    providers: AI_MODEL_OPTION_PROVIDERS,
    resources,
    qualityProtection: {
      mandatoryForManuscriptEnsemble: true,
      stages: ["provider quality floor", "continuity judge", "voice judge", "Editing Office"],
      note: "Model price never bypasses or strengthens the quality gate; free and paid models are judged by the same standards.",
    },
    noSpendTrustNotice: "trustedNoSpendModels is an explicit owner declaration for provider/model routes Forge cannot independently classify as free. Use it only when your provider account confirms the route will not consume paid tokens.",
  };
}
async function requireProject(store: Pick<FileProjectStore, "load">, projectId: string) {
  const project = await store.load(projectId);
  if (!project) throw new Error(`Project "${projectId}" not found.`);
}
async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of req) {
    raw += String(chunk);
    if (raw.length > 512 * 1024) throw new Error("AI model options request exceeds 512 KiB.");
  }
  if (!raw.trim()) return {};
  const value = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("AI model options JSON object required.");
  return value as Record<string, unknown>;
}
function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(JSON.stringify(value));
}

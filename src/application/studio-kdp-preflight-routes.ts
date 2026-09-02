import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import { FileKdpPreflightStore } from "../infrastructure/file-kdp-preflight-store";
import type { FileProjectStore } from "../infrastructure/file-project-store";
import { KdpPreflightHistoryService } from "./kdp-preflight-history";
import { listKdpPreflightHistoryFromHttp, runKdpPreflightFromHttp } from "./kdp-preflight-http";

export type StudioKdpPreflightRouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL, projectId: string) => Promise<boolean>;

/**
 * Canonical Studio route boundary for production KDP audits.
 *
 * This handler executes before the legacy inline Studio routes. It loads the
 * durable project and resolves the authoritative Cover Studio plan server-side
 * so browser callers cannot redefine trim/page/cover geometry in the audit
 * payload.
 */
export function createStudioKdpPreflightRoutes(projects: FileProjectStore): StudioKdpPreflightRouteHandler {
  const dataRoot = process.env.FORGE_DATA_DIR ?? join(process.cwd(), ".forge-data");
  const history = new KdpPreflightHistoryService(new FileKdpPreflightStore(join(dataRoot, "kdp-preflight-reports.json")));

  return async (req, res, url, projectId) => {
    if (url.pathname !== `/api/projects/${projectId}/production/kdp-preflight`) return false;
    const project = await projects.load(projectId);
    if (!project) {
      json(res, 404, { error: `Project "${projectId}" not found.` });
      return true;
    }

    if (req.method === "GET") {
      json(res, 200, await listKdpPreflightHistoryFromHttp({ history, project }));
      return true;
    }

    if (req.method === "POST") {
      const input = await body(req);
      json(res, 201, await runKdpPreflightFromHttp({ history, project }, input));
      return true;
    }

    json(res, 405, { error: "Method not allowed." }, { allow: "GET, POST" });
    return true;
  };
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of req) {
    raw += String(chunk);
    if (raw.length > 2 * 1024 * 1024) throw new Error("KDP preflight request body exceeds 2 MiB limit.");
  }
  if (!raw.trim()) return {};
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("KDP preflight request body must be a JSON object.");
  return parsed as Record<string, unknown>;
}

function json(res: ServerResponse, status: number, value: unknown, headers: Record<string, string> = {}): void {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...headers,
  });
  res.end(JSON.stringify(value));
}

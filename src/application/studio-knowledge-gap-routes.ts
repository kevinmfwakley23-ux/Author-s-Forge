import { join } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { FileProjectStore } from "../infrastructure/file-project-store";
import { FileKnowledgeGapStore } from "../infrastructure/file-knowledge-gap-store";
import { StudioKnowledgeGapRadarService } from "./knowledge-gap-radar";

export type StudioKnowledgeGapRouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL, projectId: string) => Promise<boolean>;

export function createStudioKnowledgeGapRoutes(
  projects: FileProjectStore,
  gapStore = new FileKnowledgeGapStore(join(process.env.FORGE_DATA_DIR?.trim() || join(process.cwd(), ".forge-data"), "knowledge-gaps.json")),
  radar = new StudioKnowledgeGapRadarService(projects, gapStore),
): StudioKnowledgeGapRouteHandler {
  return async (req, res, url, projectId) => {
    const root = `/api/projects/${projectId}/research/gaps`;
    if (url.pathname === root && req.method === "GET") {
      json(res, 200, {
        gaps: await radar.list(projectId),
        policy: {
          hypothesisOnly: true,
          canonEligible: false,
          projectBrainMemory: false,
          sourceBackedEvidenceRequired: true,
        },
      });
      return true;
    }
    if (url.pathname === `${root}/scan` && req.method === "POST") {
      const input = await body(req);
      const result = await radar.scan(projectId, {
        focus: optionalString(input.focus),
        maxGaps: input.maxGaps === undefined ? undefined : Number(input.maxGaps),
        bookId: optionalString(input.bookId),
        chapterId: optionalString(input.chapterId),
        sceneId: optionalString(input.sceneId),
      });
      json(res, 201, result);
      return true;
    }
    const action = parseAction(url.pathname, root);
    if (action && req.method === "POST") {
      if (action.action === "dismiss") {
        const input = await body(req);
        json(res, 200, { gap: await radar.dismiss(projectId, action.gapId, optionalString(input.reason) || "Dismissed by the author from the Research Office.") });
        return true;
      }
      if (action.action === "research") {
        const result = await radar.researchGap(projectId, action.gapId);
        json(res, 201, result);
        return true;
      }
    }
    return false;
  };
}

function parseAction(pathname: string, root: string): { gapId: string; action: "dismiss" | "research" } | undefined {
  if (!pathname.startsWith(`${root}/`)) return undefined;
  const rest = pathname.slice(root.length + 1).split("/").map((value) => decodeURIComponent(value));
  if (rest.length !== 2 || !rest[0] || (rest[1] !== "dismiss" && rest[1] !== "research")) return undefined;
  if (rest[0].length > 300 || /[\r\n/]/.test(rest[0])) throw new Error("Invalid knowledge gap id.");
  return { gapId: rest[0], action: rest[1] };
}
async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of req) {
    raw += String(chunk);
    if (raw.length > 100_000) throw new Error("Knowledge gap request body is too large.");
  }
  if (!raw.trim()) return {};
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Knowledge gap request body must be a JSON object.");
  return parsed as Record<string, unknown>;
}
function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error("Knowledge gap text fields must be strings.");
  return value;
}
function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(JSON.stringify(value));
}

import type { IncomingMessage, ServerResponse } from "node:http";
import { resolveAiCollaborationPolicy } from "../domain/ai-collaboration";
import { createStudioWorkspace, validateStudioWorkspace } from "../domain/studio-workspace";
import type { FileProjectStore } from "../infrastructure/file-project-store";
import { compileCreativeAgentPlan } from "./creative-agent-plan";
import { creativeToolRegistrySnapshot } from "./creative-tool-registry";

export type StudioCreativeAgentRouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL, projectId: string) => Promise<boolean>;

/** Discoverable tool metadata and typed plan compilation for governed creative agents. */
export function createStudioCreativeAgentRoutes(store: FileProjectStore): StudioCreativeAgentRouteHandler {
  return async (req, res, url, projectId) => {
    const toolsPath = `/api/projects/${projectId}/agent/tools`;
    const planPath = `/api/projects/${projectId}/agent/plan`;
    if (url.pathname !== toolsPath && url.pathname !== planPath) return false;
    const project = await store.load(projectId);
    if (!project) throw new Error(`Project "${projectId}" not found.`);

    if (url.pathname === toolsPath && req.method === "GET") {
      json(res, 200, {
        projectId,
        ...creativeToolRegistrySnapshot(),
        authority: "discovery-only",
        executionRule: "Each operation remains subject to its existing Forge route, provider, state, proposal, and author-approval boundary.",
      });
      return true;
    }

    if (url.pathname === planPath && req.method === "POST") {
      const input = await body(req);
      const workspace = project.studioWorkspace ? validateStudioWorkspace(project.studioWorkspace) : createStudioWorkspace();
      const bookId = optionalId(input.bookId) ?? workspace.activeBookId ?? undefined;
      const book = bookId ? workspace.books.find((candidate) => candidate.id === bookId) : undefined;
      const chapterId = optionalId(input.chapterId);
      const chapter = book && chapterId ? book.chapters.find((candidate) => candidate.id === chapterId) : undefined;
      const sceneId = optionalId(input.sceneId);
      const scene = chapter && sceneId ? chapter.scenes.find((candidate) => candidate.id === sceneId) : undefined;
      const collaboration = resolveAiCollaborationPolicy(project.aiCollaborationPolicy);
      const plan = compileCreativeAgentPlan({
        goal: requiredText(input.goal, "Creative agent goal"),
        mode: collaboration.mode,
        scope: {
          project: true,
          book: Boolean(book),
          chapter: Boolean(chapter),
          scene: Boolean(scene),
          sceneHasContent: Boolean(scene?.content.trim()),
        },
      });
      json(res, 200, {
        projectId,
        target: { bookId: book?.id ?? null, chapterId: chapter?.id ?? null, sceneId: scene?.id ?? null },
        plan,
        authority: "plan-only",
        executionRule: "Planning never executes a tool. Every step must pass its registered Forge boundary and approval policy separately.",
      });
      return true;
    }

    return false;
  };
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of req) {
    raw += String(chunk);
    if (raw.length > 1024 * 1024) throw new Error("Creative agent planning request exceeds 1 MiB.");
  }
  const parsed: unknown = raw.trim() ? JSON.parse(raw) : {};
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Creative agent planning body must be a JSON object.");
  return parsed as Record<string, unknown>;
}

function requiredText(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function optionalId(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/u.test(value)) throw new Error("Invalid creative agent target id.");
  return value;
}

function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(JSON.stringify(value));
}

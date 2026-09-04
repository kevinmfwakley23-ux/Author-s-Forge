import type { IncomingMessage, ServerResponse } from "node:http";
import { resolveAiCollaborationPolicy } from "../domain/ai-collaboration";
import { createStudioWorkspace, validateStudioWorkspace } from "../domain/studio-workspace";
import type { FileProjectStore } from "../infrastructure/file-project-store";
import { compileCreativeAgentPlan } from "./creative-agent-plan";
import { CreativeAgentRecipeService, type CreativeAgentRecipeStep } from "./creative-agent-recipes";
import { creativeToolRegistrySnapshot } from "./creative-tool-registry";

export type StudioCreativeAgentRouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL, projectId: string) => Promise<boolean>;

/** Discoverable tool metadata, governed planning, and durable reusable Forge Recipes. */
export function createStudioCreativeAgentRoutes(store: FileProjectStore): StudioCreativeAgentRouteHandler {
  const recipes = new CreativeAgentRecipeService(store);
  return async (req, res, url, projectId) => {
    const toolsPath = `/api/projects/${projectId}/agent/tools`;
    const planPath = `/api/projects/${projectId}/agent/plan`;
    const recipesPath = `/api/projects/${projectId}/agent/recipes`;
    const recipeMatch = url.pathname.match(new RegExp(`^${escapeRegExp(recipesPath)}/([A-Za-z0-9_-]+)$`));
    const recipePlanMatch = url.pathname.match(new RegExp(`^${escapeRegExp(recipesPath)}/([A-Za-z0-9_-]+)/plan$`));
    if (url.pathname !== toolsPath && url.pathname !== planPath && url.pathname !== recipesPath && !recipeMatch && !recipePlanMatch) return false;
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

    if (url.pathname === recipesPath && req.method === "GET") {
      json(res, 200, {
        projectId,
        recipes: await recipes.list(projectId),
        authority: "author-defined-workflow",
        executionRule: "Recipes store governed tool sequences only. Loading or compiling a recipe never executes its tools.",
      });
      return true;
    }

    if (url.pathname === recipesPath && req.method === "POST") {
      const input = await body(req);
      const recipe = await recipes.create(projectId, {
        id: optionalId(input.id),
        title: requiredText(input.title, "Recipe title"),
        description: optionalText(input.description),
        steps: recipeSteps(input.steps),
        now: optionalText(input.now),
      });
      json(res, 201, { projectId, recipe, authority: "author-defined-workflow" });
      return true;
    }

    if (recipePlanMatch && req.method === "POST") {
      const input = await body(req);
      const compiled = await recipes.compile(projectId, recipePlanMatch[1], {
        goal: optionalText(input.goal),
        bookId: optionalId(input.bookId),
        chapterId: optionalId(input.chapterId),
        sceneId: optionalId(input.sceneId),
      });
      json(res, 200, {
        projectId,
        ...compiled,
        authority: "plan-only",
        executionRule: "Compiling a Forge Recipe never executes its tools. Each step retains the registered provider, state, scope and approval boundary.",
      });
      return true;
    }

    if (recipeMatch && req.method === "PUT") {
      const input = await body(req);
      const recipe = await recipes.update(projectId, recipeMatch[1], {
        title: optionalText(input.title),
        description: input.description === undefined ? undefined : String(input.description ?? ""),
        steps: input.steps === undefined ? undefined : recipeSteps(input.steps),
        now: optionalText(input.now),
      });
      json(res, 200, { projectId, recipe, authority: "author-defined-workflow" });
      return true;
    }

    if (recipeMatch && req.method === "DELETE") {
      json(res, 200, { projectId, ...(await recipes.remove(projectId, recipeMatch[1])) });
      return true;
    }

    return false;
  };
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of req) {
    raw += String(chunk);
    if (raw.length > 1024 * 1024) throw new Error("Creative agent request exceeds 1 MiB.");
  }
  const parsed: unknown = raw.trim() ? JSON.parse(raw) : {};
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Creative agent body must be a JSON object.");
  return parsed as Record<string, unknown>;
}

function recipeSteps(value: unknown): readonly CreativeAgentRecipeStep[] {
  if (!Array.isArray(value)) throw new Error("Forge Recipe steps must be an array.");
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`Forge Recipe step ${index + 1} must be an object.`);
    const row = entry as Record<string, unknown>;
    return {
      toolId: requiredText(row.toolId, `Forge Recipe step ${index + 1} tool id`),
      ...(optionalText(row.instruction) ? { instruction: optionalText(row.instruction) } : {}),
    };
  });
}

function requiredText(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function optionalText(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error("Creative agent text value must be a string.");
  return value.trim() || undefined;
}

function optionalId(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/u.test(value)) throw new Error("Invalid creative agent target id.");
  return value;
}

function escapeRegExp(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(JSON.stringify(value));
}

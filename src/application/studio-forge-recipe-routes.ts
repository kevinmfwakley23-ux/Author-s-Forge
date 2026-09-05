import type { IncomingMessage, ServerResponse } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import type { FileProjectStore } from "../infrastructure/file-project-store";
import type { FileAiProposalStore } from "../infrastructure/file-ai-proposal-store";
import type { FileForgeRecipeStore } from "../infrastructure/file-forge-recipe-store";
import { generateProjectText, type AiGenerationResult, type ProjectAiGenerationRequest } from "../infrastructure/ai-provider";
import { ProjectMemoryStore } from "./project-memory-store";
import { assembleProjectBrainContext, type ProjectBrainQuery } from "./project-brain";
import { assertAiCollaborationCapability } from "../domain/ai-collaboration";
import { validateStudioWorkspace } from "../domain/studio-workspace";
import {
  createForgeRecipe,
  updateForgeRecipe,
  validateForgeRecipeStage,
  FORGE_RECIPE_OUTPUT_KINDS,
  FORGE_RECIPE_TASKS,
  type ForgeRecipe,
  type ForgeRecipeOutputKind,
  type ForgeRecipeRun,
  type ForgeRecipeRunStage,
  type ForgeRecipeStage,
} from "../domain/forge-recipes";
import { MEMORY_CLASSES, type MemoryClass } from "../domain/memory";
import type { AiProposalTarget } from "./ai-proposal-store";

export type StudioForgeRecipeRouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL, projectId: string) => Promise<boolean>;
type RecipeGenerator = (request: ProjectAiGenerationRequest) => Promise<AiGenerationResult>;

export function createStudioForgeRecipeRoutes(
  projects: Pick<FileProjectStore, "load">,
  recipes: FileForgeRecipeStore,
  proposals: FileAiProposalStore,
  generator: RecipeGenerator = generateProjectText,
): StudioForgeRecipeRouteHandler {
  return async (req, res, url, projectId) => {
    const base = `/api/projects/${projectId}/recipes`;
    const runsPath = `/api/projects/${projectId}/recipe-runs`;

    if (url.pathname === base && req.method === "GET") {
      await requireProject(projects, projectId);
      json(res, 200, { recipes: await recipes.listRecipes(projectId) });
      return true;
    }

    if (url.pathname === base && req.method === "POST") {
      await requireProject(projects, projectId);
      const input = await body(req);
      const now = new Date().toISOString();
      const recipe = createForgeRecipe({
        id: optionalId(input.id) ?? `recipe-${randomUUID()}`,
        projectId,
        name: String(input.name ?? ""),
        description: input.description === undefined ? undefined : String(input.description),
        inputLabel: input.inputLabel === undefined ? undefined : String(input.inputLabel),
        outputKind: recipeOutputKind(input.outputKind ?? "creative-alternative"),
        memoryClasses: memoryClasses(input.memoryClasses),
        relevanceTags: stringArray(input.relevanceTags, 32),
        contextQueryTerms: stringArray(input.contextQueryTerms, 32),
        includeWorkingState: input.includeWorkingState === true,
        enabled: input.enabled !== false,
        stages: recipeStages(input.stages),
        now,
      });
      json(res, 201, await recipes.createRecipe(recipe));
      return true;
    }

    if (url.pathname === runsPath && req.method === "GET") {
      await requireProject(projects, projectId);
      const recipeId = url.searchParams.get("recipeId")?.trim() || undefined;
      json(res, 200, { runs: await recipes.listRuns(projectId, recipeId) });
      return true;
    }

    const recipeMatch = url.pathname.match(new RegExp(`^${escapeRegex(base)}/([^/]+)$`));
    if (recipeMatch) {
      const recipeId = decodeURIComponent(recipeMatch[1]);
      if (req.method === "GET") {
        await requireProject(projects, projectId);
        const recipe = await requireRecipe(recipes, projectId, recipeId);
        json(res, 200, recipe);
        return true;
      }
      if (req.method === "PUT") {
        await requireProject(projects, projectId);
        const existing = await requireRecipe(recipes, projectId, recipeId);
        const input = await body(req);
        if (input.id !== undefined && String(input.id) !== existing.id) throw new Error("Forge Recipe id cannot be changed after creation.");
        const updated = updateForgeRecipe(existing, {
          name: input.name === undefined ? undefined : String(input.name),
          description: input.description === undefined ? undefined : String(input.description),
          inputLabel: input.inputLabel === undefined ? undefined : String(input.inputLabel),
          outputKind: input.outputKind === undefined ? undefined : recipeOutputKind(input.outputKind),
          memoryClasses: input.memoryClasses === undefined ? undefined : memoryClasses(input.memoryClasses),
          relevanceTags: input.relevanceTags === undefined ? undefined : stringArray(input.relevanceTags, 32),
          contextQueryTerms: input.contextQueryTerms === undefined ? undefined : stringArray(input.contextQueryTerms, 32),
          includeWorkingState: input.includeWorkingState === undefined ? undefined : input.includeWorkingState === true,
          enabled: input.enabled === undefined ? undefined : input.enabled === true,
          stages: input.stages === undefined ? undefined : recipeStages(input.stages),
          now: new Date().toISOString(),
        });
        json(res, 200, await recipes.replaceRecipe(updated));
        return true;
      }
      if (req.method === "DELETE") {
        await requireProject(projects, projectId);
        await recipes.deleteRecipe(projectId, recipeId);
        json(res, 200, { deleted: true, recipeId });
        return true;
      }
    }

    const runMatch = url.pathname.match(new RegExp(`^${escapeRegex(base)}/([^/]+)/run$`));
    if (runMatch && req.method === "POST") {
      const recipeId = decodeURIComponent(runMatch[1]);
      const project = await requireProject(projects, projectId);
      const recipe = await requireRecipe(recipes, projectId, recipeId);
      if (!recipe.enabled) throw new Error(`Forge Recipe "${recipe.name}" is disabled.`);
      const input = await body(req);
      const target = optionalTarget(input.target);
      const targetScene = target ? findTargetScene(project, target) : undefined;
      if (recipe.outputKind === "manuscript-edit" && !target) throw new Error("A manuscript-edit Forge Recipe requires a book/chapter/scene target.");
      const userInput = normalizeRunInput(input.input, targetScene?.content);
      const runId = `recipe-run-${randomUUID()}`;
      const startedAt = new Date().toISOString();
      const recipeRevisionSha256 = sha256(JSON.stringify(recipe));
      const memory = new ProjectMemoryStore();
      memory.restore(project.memories);
      const contextQuery = recipeContextQuery(recipe, projectId);
      const selectedContext = assembleProjectBrainContext(memory, contextQuery);
      const sourceMemoryIds = selectedContext.evidence.map((item) => item.memoryId);
      const stageHistory: ForgeRecipeRunStage[] = [];
      let previousOutput = "";

      try {
        for (const stage of recipe.stages) {
          assertAiCollaborationCapability(project.aiCollaborationPolicy, collaborationCapability(stage), `Forge Recipe stage "${stage.name}"`, "author-requested");
          const result = await generator({
            memory,
            context: contextQuery,
            system: recipeSystemPrompt(recipe, stage),
            user: recipeUserPrompt(recipe, stage, userInput, previousOutput, targetScene?.content),
            task: stage.task,
            temperature: stage.temperature,
            maxOutputTokens: stage.maxOutputTokens,
            preferProvider: stage.preferProvider,
            preferModel: stage.preferModel,
            requiresReasoning: stage.requiresReasoning,
            requiresCreativeWriting: stage.requiresCreativeWriting,
            requiresInstructionFollowing: stage.requiresInstructionFollowing ?? true,
          });
          previousOutput = result.text;
          stageHistory.push(runStage(stage, result));
        }

        const finalOutput = previousOutput.trim();
        if (!finalOutput) throw new Error("Forge Recipe completed without a final output.");
        const proposalLedger = await proposals.load();
        const proposalId = `recipe-proposal-${randomUUID()}`;
        const proposal = proposalLedger.propose({
          id: proposalId,
          projectId,
          kind: recipe.outputKind,
          title: `${recipe.name} — recipe output`,
          rationale: `Generated by author-created Forge Recipe "${recipe.name}" revision ${recipeRevisionSha256}. Run ${runId} preserves stage/provider/model provenance. Output remains a proposal until the author reviews it.`,
          proposedContent: finalOutput,
          sourceMemoryIds,
          ...(target ? { target, baseContentSha256: sha256(targetScene?.content ?? "") } : {}),
          now: new Date().toISOString(),
        });
        await proposals.save();
        const completedAt = new Date().toISOString();
        const run: ForgeRecipeRun = {
          id: runId, projectId, recipeId: recipe.id, recipeRevisionSha256, status: "completed", input: userInput,
          ...(target ? { target } : {}), sourceMemoryIds, stages: stageHistory, proposalId: proposal.id, startedAt, completedAt,
        };
        await recipes.appendRun(run);
        json(res, 201, { recipe, run, proposal });
      } catch (error) {
        const completedAt = new Date().toISOString();
        const message = errorMessage(error);
        const failedRun: ForgeRecipeRun = {
          id: runId, projectId, recipeId: recipe.id, recipeRevisionSha256, status: "failed", input: userInput,
          ...(target ? { target } : {}), sourceMemoryIds, stages: stageHistory, error: message, startedAt, completedAt,
        };
        await recipes.appendRun(failedRun);
        throw new Error(`Forge Recipe "${recipe.name}" failed truthfully after ${stageHistory.length} completed stage(s). ${message}`);
      }
      return true;
    }

    return false;
  };
}

function recipeSystemPrompt(recipe: ForgeRecipe, stage: ForgeRecipeStage): string {
  return [
    `You are running the author-created Author's Forge Recipe "${recipe.name}".`,
    `This is stage "${stage.name}" (${stage.task}).`,
    "Follow the author's stage instruction exactly while respecting Project Brain context supplied separately by Forge.",
    "Do not claim that manuscript, canon, files, research, publishing state, or external systems were changed. Your output is candidate material until the author explicitly reviews it.",
    recipe.description ? `Recipe purpose: ${recipe.description}` : "",
  ].filter(Boolean).join("\n");
}

function recipeUserPrompt(recipe: ForgeRecipe, stage: ForgeRecipeStage, input: string, previous: string, targetContent?: string): string {
  const blocks = [
    `STAGE INSTRUCTION:\n${stage.instruction}`,
    `${recipe.inputLabel.toUpperCase()}:\n${input || "(No direct input; rely on the author-approved recipe instruction and available Project Brain context.)"}`,
  ];
  if (targetContent !== undefined) blocks.push(`CURRENT TARGET SCENE (read-only source revision):\n${targetContent}`);
  if (stage.usePreviousOutput) blocks.push(`PREVIOUS STAGE OUTPUT:\n${previous || "(No previous stage output.)"}`);
  blocks.push("Return only the useful result for this stage. Do not add fake completion claims or say the result has already been applied.");
  return blocks.join("\n\n");
}

function recipeContextQuery(recipe: ForgeRecipe, projectId: string): ProjectBrainQuery {
  return {
    projectId,
    ...(recipe.memoryClasses.length ? { taskMemoryClasses: recipe.memoryClasses } : {}),
    ...(recipe.relevanceTags.length ? { relevanceTags: recipe.relevanceTags } : {}),
    ...(recipe.contextQueryTerms.length ? { queryTerms: recipe.contextQueryTerms } : {}),
    includeWorkingState: recipe.includeWorkingState,
    includeDiagnostics: true,
    limit: 96,
  };
}

function runStage(stage: ForgeRecipeStage, result: AiGenerationResult): ForgeRecipeRunStage {
  return {
    stageId: stage.id,
    stageName: stage.name,
    provider: result.provider,
    model: result.model,
    output: result.text,
    ...(result.requestId ? { requestId: result.requestId } : {}),
    ...(result.usage ? { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, totalTokens: result.usage.totalTokens } : {}),
    ...(result.cacheHit === undefined ? {} : { cacheHit: result.cacheHit }),
    ...(result.attempts ? { attempts: result.attempts.map((attempt) => ({ ...attempt })) } : {}),
  };
}

function recipeStages(value: unknown): ForgeRecipeStage[] {
  if (!Array.isArray(value)) throw new Error("Forge Recipe stages must be an array.");
  return value.map((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`Forge Recipe stage ${index + 1} must be an object.`);
    const item = raw as Record<string, unknown>;
    const task = String(item.task ?? "writing");
    if (!FORGE_RECIPE_TASKS.includes(task as (typeof FORGE_RECIPE_TASKS)[number])) throw new Error(`Unsupported recipe stage task "${task}".`);
    return validateForgeRecipeStage({
      id: String(item.id ?? `stage-${index + 1}`),
      name: String(item.name ?? `Stage ${index + 1}`),
      instruction: String(item.instruction ?? ""),
      task: task as ForgeRecipeStage["task"],
      usePreviousOutput: item.usePreviousOutput === true,
      ...(item.temperature === undefined ? {} : { temperature: Number(item.temperature) }),
      ...(item.maxOutputTokens === undefined ? {} : { maxOutputTokens: Number(item.maxOutputTokens) }),
      ...(item.preferProvider === undefined ? {} : { preferProvider: String(item.preferProvider) }),
      ...(item.preferModel === undefined ? {} : { preferModel: String(item.preferModel) }),
      ...(item.requiresReasoning === undefined ? {} : { requiresReasoning: item.requiresReasoning === true }),
      ...(item.requiresCreativeWriting === undefined ? {} : { requiresCreativeWriting: item.requiresCreativeWriting === true }),
      ...(item.requiresInstructionFollowing === undefined ? {} : { requiresInstructionFollowing: item.requiresInstructionFollowing === true }),
    });
  });
}

function recipeOutputKind(value: unknown): ForgeRecipeOutputKind {
  const kind = String(value);
  if (!FORGE_RECIPE_OUTPUT_KINDS.includes(kind as ForgeRecipeOutputKind)) throw new Error(`Unsupported Forge Recipe output kind "${kind}".`);
  return kind as ForgeRecipeOutputKind;
}

function memoryClasses(value: unknown): MemoryClass[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("Recipe memoryClasses must be an array.");
  return value.map((item) => {
    const memoryClass = String(item);
    if (!MEMORY_CLASSES.includes(memoryClass as MemoryClass)) throw new Error(`Unsupported recipe memory class "${memoryClass}".`);
    return memoryClass as MemoryClass;
  });
}

function stringArray(value: unknown, max: number): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > max) throw new Error(`Recipe string list must be an array with at most ${max} values.`);
  return value.map((item) => String(item));
}

function optionalTarget(value: unknown): AiProposalTarget | undefined {
  if (value === undefined || value === null) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Recipe target must be an object.");
  const raw = value as Record<string, unknown>;
  const target = { bookId: String(raw.bookId ?? "").trim(), chapterId: String(raw.chapterId ?? "").trim(), sceneId: String(raw.sceneId ?? "").trim() };
  if (!target.bookId || !target.chapterId || !target.sceneId) throw new Error("Recipe target requires bookId, chapterId, and sceneId.");
  return target;
}

function findTargetScene(project: Awaited<ReturnType<typeof requireProject>>, target: AiProposalTarget): { content: string } {
  const workspace = project.studioWorkspace ? validateStudioWorkspace(project.studioWorkspace) : undefined;
  const book = workspace?.books.find((item) => item.id === target.bookId);
  const chapter = book?.chapters.find((item) => item.id === target.chapterId);
  const scene = chapter?.scenes.find((item) => item.id === target.sceneId);
  if (!scene) throw new Error("Forge Recipe target scene does not exist in the current project revision.");
  return { content: scene.content };
}

function normalizeRunInput(value: unknown, fallback?: string): string {
  const text = value === undefined || value === null ? (fallback ?? "") : String(value);
  if (text.length > 200_000) throw new Error("Forge Recipe input exceeds 200000 characters.");
  return text;
}

function collaborationCapability(stage: ForgeRecipeStage): "draft" | "revise" | "bulk-work" {
  if (stage.task === "editing" || stage.task === "continuity" || stage.task === "voice-preservation") return "revise";
  if (stage.task === "tool-use") return "bulk-work";
  return "draft";
}

async function requireProject(store: Pick<FileProjectStore, "load">, projectId: string) {
  const project = await store.load(projectId);
  if (!project) throw new Error(`Project "${projectId}" not found.`);
  return project;
}

async function requireRecipe(store: FileForgeRecipeStore, projectId: string, recipeId: string): Promise<ForgeRecipe> {
  const recipe = await store.getRecipe(projectId, recipeId);
  if (!recipe) throw new Error(`Forge Recipe "${recipeId}" not found in project "${projectId}".`);
  return recipe;
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of req) {
    raw += String(chunk);
    if (raw.length > 1_048_576) throw new Error("Forge Recipe request body exceeds 1 MiB.");
  }
  if (!raw.trim()) return {};
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Forge Recipe request body must be a JSON object.");
  return parsed as Record<string, unknown>;
}

function optionalId(value: unknown): string | undefined {
  if (value === undefined || value === null || String(value).trim() === "") return undefined;
  const id = String(value).trim();
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error("Forge Recipe id may contain only letters, numbers, underscores, and hyphens.");
  return id;
}

function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(JSON.stringify(value));
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function escapeRegex(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

import { randomUUID } from "node:crypto";
import { createMemoryRecord, type MemoryRecord } from "../domain/memory";
import { withProjectMemories, type ProjectState } from "../domain/project";
import { createAiCollaborationPolicy, resolveAiCollaborationPolicy } from "../domain/ai-collaboration";
import { createStudioWorkspace, validateStudioWorkspace } from "../domain/studio-workspace";
import type { FileProjectStore } from "../infrastructure/file-project-store";
import {
  CREATIVE_AGENT_PLAN_FORMAT_VERSION,
  type CreativeAgentPlan,
  type CreativeAgentPlanScope,
  type CreativeAgentPlanStep,
} from "./creative-agent-plan";
import { creativeToolById, type CreativeToolDescriptor } from "./creative-tool-registry";

export const CREATIVE_AGENT_RECIPE_FORMAT_VERSION = 1 as const;
const RECIPE_TAG = "agent-recipe";
const RECIPE_ID_PREFIX = "agent-recipe-";

export interface CreativeAgentRecipeStep {
  readonly toolId: string;
  readonly instruction?: string;
}

export interface CreativeAgentRecipe {
  readonly formatVersion: typeof CREATIVE_AGENT_RECIPE_FORMAT_VERSION;
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly steps: readonly CreativeAgentRecipeStep[];
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface StoredRecipeEnvelope {
  readonly formatVersion: typeof CREATIVE_AGENT_RECIPE_FORMAT_VERSION;
  readonly recipe: CreativeAgentRecipe;
  readonly deleted: boolean;
}

export interface SaveCreativeAgentRecipeInput {
  readonly id?: string;
  readonly title: string;
  readonly description?: string;
  readonly steps: readonly CreativeAgentRecipeStep[];
  readonly now?: string;
}

export interface UpdateCreativeAgentRecipeInput {
  readonly title?: string;
  readonly description?: string;
  readonly steps?: readonly CreativeAgentRecipeStep[];
  readonly now?: string;
}

export interface CompileCreativeAgentRecipeInput {
  readonly goal?: string;
  readonly bookId?: string;
  readonly chapterId?: string;
  readonly sceneId?: string;
}

export class CreativeAgentRecipeService {
  public constructor(private readonly store: FileProjectStore) {}

  public async list(projectId: string): Promise<readonly CreativeAgentRecipe[]> {
    const project = await this.requireProject(projectId);
    const latest = latestEnvelopes(project);
    return [...latest.values()]
      .filter((entry) => !entry.deleted)
      .map((entry) => entry.recipe)
      .sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
  }

  public async get(projectId: string, recipeId: string): Promise<CreativeAgentRecipe> {
    const project = await this.requireProject(projectId);
    const normalizedId = id(recipeId, "Recipe id");
    const entry = latestEnvelopes(project).get(normalizedId);
    if (!entry || entry.deleted) throw new Error(`Forge Recipe "${normalizedId}" was not found.`);
    return entry.recipe;
  }

  public async create(projectId: string, input: SaveCreativeAgentRecipeInput): Promise<CreativeAgentRecipe> {
    const project = await this.requireProject(projectId);
    const recipeId = input.id === undefined ? `recipe-${randomUUID()}` : id(input.id, "Recipe id");
    const previous = latestEnvelopes(project).get(recipeId);
    if (previous && !previous.deleted) throw new Error(`Forge Recipe "${recipeId}" already exists.`);
    const now = timestamp(input.now);
    const recipe = validateRecipe({
      formatVersion: CREATIVE_AGENT_RECIPE_FORMAT_VERSION,
      id: recipeId,
      title: requiredText(input.title, "Recipe title", 160),
      description: optionalText(input.description, "Recipe description", 2_000) ?? "",
      steps: normalizeSteps(input.steps),
      version: (previous?.recipe.version ?? 0) + 1,
      createdAt: previous?.recipe.createdAt ?? now,
      updatedAt: now,
    });
    await this.append(project, recipe, false, now);
    return recipe;
  }

  public async update(projectId: string, recipeId: string, input: UpdateCreativeAgentRecipeInput): Promise<CreativeAgentRecipe> {
    const project = await this.requireProject(projectId);
    const normalizedId = id(recipeId, "Recipe id");
    const previous = latestEnvelopes(project).get(normalizedId);
    if (!previous || previous.deleted) throw new Error(`Forge Recipe "${normalizedId}" was not found.`);
    const now = timestamp(input.now);
    const recipe = validateRecipe({
      ...previous.recipe,
      title: input.title === undefined ? previous.recipe.title : requiredText(input.title, "Recipe title", 160),
      description: input.description === undefined ? previous.recipe.description : optionalText(input.description, "Recipe description", 2_000) ?? "",
      steps: input.steps === undefined ? previous.recipe.steps : normalizeSteps(input.steps),
      version: previous.recipe.version + 1,
      updatedAt: now,
    });
    await this.append(project, recipe, false, now);
    return recipe;
  }

  public async remove(projectId: string, recipeId: string, nowValue?: string): Promise<{ readonly id: string; readonly deleted: true; readonly version: number }> {
    const project = await this.requireProject(projectId);
    const normalizedId = id(recipeId, "Recipe id");
    const previous = latestEnvelopes(project).get(normalizedId);
    if (!previous || previous.deleted) throw new Error(`Forge Recipe "${normalizedId}" was not found.`);
    const now = timestamp(nowValue);
    const tombstone = validateRecipe({ ...previous.recipe, version: previous.recipe.version + 1, updatedAt: now });
    await this.append(project, tombstone, true, now);
    return { id: normalizedId, deleted: true, version: tombstone.version };
  }

  public async compile(projectId: string, recipeId: string, input: CompileCreativeAgentRecipeInput = {}): Promise<{ readonly recipe: CreativeAgentRecipe; readonly target: { readonly bookId: string | null; readonly chapterId: string | null; readonly sceneId: string | null }; readonly plan: CreativeAgentPlan }> {
    const project = await this.requireProject(projectId);
    const recipe = await this.get(projectId, recipeId);
    const workspace = project.studioWorkspace ? validateStudioWorkspace(project.studioWorkspace) : createStudioWorkspace();
    const bookId = optionalId(input.bookId) ?? workspace.activeBookId ?? undefined;
    const book = bookId ? workspace.books.find((candidate) => candidate.id === bookId) : undefined;
    const chapterId = optionalId(input.chapterId);
    const chapter = book && chapterId ? book.chapters.find((candidate) => candidate.id === chapterId) : undefined;
    const sceneId = optionalId(input.sceneId);
    const scene = chapter && sceneId ? chapter.scenes.find((candidate) => candidate.id === sceneId) : undefined;
    const scope: CreativeAgentPlanScope = {
      project: true,
      book: Boolean(book),
      chapter: Boolean(chapter),
      scene: Boolean(scene),
      sceneHasContent: Boolean(scene?.content.trim()),
    };
    const policy = resolveAiCollaborationPolicy(project.aiCollaborationPolicy);
    const goal = optionalText(input.goal, "Recipe goal", 10_000) || recipe.description || recipe.title;
    const recipeSteps = recipe.steps.filter((step) => step.toolId !== "memory.record-working");
    recipeSteps.push({ toolId: "memory.record-working", instruction: "Record the author-approved recipe run evidence as working memory after all other recipe operations finish." });
    const steps = recipeSteps.map((step, index) => planStep(step, index, recipe, goal, scope, policy.mode));
    const plan: CreativeAgentPlan = Object.freeze({
      formatVersion: CREATIVE_AGENT_PLAN_FORMAT_VERSION,
      goal,
      mode: policy.mode,
      policy: Object.freeze({
        authorApprovalRequiredForMajorDecisions: true as const,
        bulkExecutionEligible: policy.aiMayExecuteBulkWork,
        directCanonMutationAllowed: false as const,
        directManuscriptMutationAllowed: false as const,
        writingMustUseProposalBoundary: true as const,
      }),
      steps: Object.freeze(steps),
    });
    return { recipe, target: { bookId: book?.id ?? null, chapterId: chapter?.id ?? null, sceneId: scene?.id ?? null }, plan };
  }

  private async append(project: ProjectState, recipe: CreativeAgentRecipe, deleted: boolean, now: string): Promise<void> {
    const envelope: StoredRecipeEnvelope = { formatVersion: CREATIVE_AGENT_RECIPE_FORMAT_VERSION, recipe, deleted };
    const memory = createMemoryRecord({
      id: `${RECIPE_ID_PREFIX}${recipe.id}-v${recipe.version}`,
      projectId: project.metadata.id,
      class: "creative-note",
      authority: "working",
      summary: `${deleted ? "Deleted " : ""}Forge Recipe v${recipe.version}: ${recipe.title}`,
      content: JSON.stringify(envelope),
      provenance: [{ kind: "author", reference: "forge-agent-recipe", recordedAt: now }],
      relevanceTags: [RECIPE_TAG, `${RECIPE_TAG}:${recipe.id}`, "agent-workflow"],
      now,
    });
    await this.store.save(withProjectMemories(project, [...project.memories, memory], now));
  }

  private async requireProject(projectId: string): Promise<ProjectState> {
    const normalizedId = id(projectId, "Project id");
    const project = await this.store.load(normalizedId);
    if (!project) throw new Error(`Project "${normalizedId}" not found.`);
    return project;
  }
}

function latestEnvelopes(project: ProjectState): Map<string, StoredRecipeEnvelope> {
  const result = new Map<string, StoredRecipeEnvelope>();
  for (const memory of project.memories.filter((item) => item.relevanceTags.includes(RECIPE_TAG))) {
    const envelope = parseEnvelope(memory);
    const previous = result.get(envelope.recipe.id);
    if (!previous || envelope.recipe.version > previous.recipe.version || (envelope.recipe.version === previous.recipe.version && envelope.recipe.updatedAt > previous.recipe.updatedAt)) result.set(envelope.recipe.id, envelope);
  }
  return result;
}

function parseEnvelope(memory: MemoryRecord): StoredRecipeEnvelope {
  let value: unknown;
  try { value = JSON.parse(memory.content); } catch { throw new Error(`Forge Recipe memory "${memory.id}" contains invalid JSON.`); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Forge Recipe memory "${memory.id}" is invalid.`);
  const envelope = value as Record<string, unknown>;
  if (envelope.formatVersion !== CREATIVE_AGENT_RECIPE_FORMAT_VERSION || typeof envelope.deleted !== "boolean") throw new Error(`Forge Recipe memory "${memory.id}" has an unsupported envelope.`);
  return { formatVersion: CREATIVE_AGENT_RECIPE_FORMAT_VERSION, recipe: validateRecipe(envelope.recipe), deleted: envelope.deleted };
}

function validateRecipe(value: unknown): CreativeAgentRecipe {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Forge Recipe must be an object.");
  const input = value as Record<string, unknown>;
  if (input.formatVersion !== CREATIVE_AGENT_RECIPE_FORMAT_VERSION) throw new Error("Unsupported Forge Recipe format version.");
  const version = Number(input.version);
  if (!Number.isInteger(version) || version < 1) throw new Error("Forge Recipe version must be a positive integer.");
  const createdAt = timestamp(input.createdAt);
  const updatedAt = timestamp(input.updatedAt);
  if (Date.parse(updatedAt) < Date.parse(createdAt)) throw new Error("Forge Recipe updatedAt cannot precede createdAt.");
  return Object.freeze({
    formatVersion: CREATIVE_AGENT_RECIPE_FORMAT_VERSION,
    id: id(input.id, "Recipe id"),
    title: requiredText(input.title, "Recipe title", 160),
    description: optionalText(input.description, "Recipe description", 2_000) ?? "",
    steps: Object.freeze(normalizeSteps(input.steps)),
    version,
    createdAt,
    updatedAt,
  });
}

function normalizeSteps(value: unknown): CreativeAgentRecipeStep[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) throw new Error("Forge Recipe requires 1 through 20 steps.");
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`Forge Recipe step ${index + 1} must be an object.`);
    const row = entry as Record<string, unknown>;
    const toolId = requiredText(row.toolId, `Forge Recipe step ${index + 1} tool id`, 160);
    creativeToolById(toolId);
    const instruction = optionalText(row.instruction, `Forge Recipe step ${index + 1} instruction`, 2_000);
    return Object.freeze({ toolId, ...(instruction ? { instruction } : {}) });
  });
}

function planStep(step: CreativeAgentRecipeStep, index: number, recipe: CreativeAgentRecipe, goal: string, scope: CreativeAgentPlanScope, mode: ReturnType<typeof createAiCollaborationPolicy>["mode"]): CreativeAgentPlanStep {
  const tool = creativeToolById(step.toolId);
  const policy = createAiCollaborationPolicy(mode);
  let blockedReason = missingScopeReason(tool, scope);
  if (!blockedReason && tool.id === "writing.propose" && !policy.aiMayDraft) blockedReason = `Collaboration mode "${policy.mode}" is configured not to draft new prose. Change mode before running this Forge Recipe.`;
  if (!blockedReason && tool.id === "editing.analyze" && scope.scene && !scope.sceneHasContent) blockedReason = "The selected scene has no manuscript text to analyze.";
  return Object.freeze({
    sequence: index + 1,
    id: `recipe-${recipe.id}-step-${index + 1}-${tool.id}`,
    toolId: tool.id,
    title: tool.title,
    reason: step.instruction || `Forge Recipe "${recipe.title}" step for: ${goal}`,
    approvalClass: tool.approvalClass,
    providerRequirement: tool.providerRequirement,
    stateEffect: tool.stateEffect,
    requiredScope: tool.requiredScope,
    ...(blockedReason ? { blockedReason } : {}),
    eligibleForApprovedRunGroup: !blockedReason && policy.aiMayExecuteBulkWork && tool.approvalClass === "read-only" && tool.stateEffect === "none",
  });
}

function missingScopeReason(tool: CreativeToolDescriptor, scope: CreativeAgentPlanScope): string | undefined {
  const missing = tool.requiredScope.filter((required) => required !== "project" && !scope[required]);
  return missing.length ? `Tool "${tool.id}" requires ${missing.join(", ")} scope before it can run.` : undefined;
}

function id(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/u.test(value.trim())) throw new Error(`${label} may contain only letters, numbers, hyphens, and underscores.`);
  return value.trim();
}

function optionalId(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return id(value, "Creative agent target id");
}

function requiredText(value: unknown, label: string, max: number): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  const normalized = value.trim();
  if (normalized.length > max) throw new Error(`${label} exceeds ${max} characters.`);
  return normalized;
}

function optionalText(value: unknown, label: string, max: number): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error(`${label} must be a string.`);
  const normalized = value.trim();
  if (normalized.length > max) throw new Error(`${label} exceeds ${max} characters.`);
  return normalized || undefined;
}

function timestamp(value: unknown): string {
  const result = value === undefined ? new Date().toISOString() : String(value);
  if (!result.trim() || Number.isNaN(Date.parse(result))) throw new Error("Forge Recipe timestamp must be valid ISO-compatible time.");
  return new Date(Date.parse(result)).toISOString();
}

import type { AiTask } from "../application/ai-model-broker";
import { MEMORY_CLASSES, type MemoryClass } from "./memory";
import type { AiProposalKind, AiProposalTarget } from "../application/ai-proposal-store";

export const FORGE_RECIPE_FORMAT_VERSION = 1 as const;
export const FORGE_RECIPE_MAX_STAGES = 8 as const;
export const FORGE_RECIPE_TASKS = Object.freeze([
  "writing", "editing", "research", "vision", "cover", "marketing", "tool-use", "voice-preservation", "continuity",
] as const satisfies readonly AiTask[]);
export const FORGE_RECIPE_OUTPUT_KINDS = Object.freeze([
  "creative-alternative", "manuscript-edit", "research-note", "continuity-finding",
] as const satisfies readonly AiProposalKind[]);

export type ForgeRecipeOutputKind = (typeof FORGE_RECIPE_OUTPUT_KINDS)[number];

export interface ForgeRecipeStage {
  readonly id: string;
  readonly name: string;
  readonly instruction: string;
  readonly task: AiTask;
  readonly usePreviousOutput: boolean;
  readonly temperature?: number;
  readonly maxOutputTokens?: number;
  readonly preferProvider?: string;
  readonly preferModel?: string;
  readonly requiresReasoning?: boolean;
  readonly requiresCreativeWriting?: boolean;
  readonly requiresInstructionFollowing?: boolean;
}

export interface ForgeRecipe {
  readonly formatVersion: typeof FORGE_RECIPE_FORMAT_VERSION;
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly description: string;
  readonly inputLabel: string;
  readonly outputKind: ForgeRecipeOutputKind;
  readonly memoryClasses: readonly MemoryClass[];
  readonly relevanceTags: readonly string[];
  readonly contextQueryTerms: readonly string[];
  readonly includeWorkingState: boolean;
  readonly enabled: boolean;
  readonly stages: readonly ForgeRecipeStage[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ForgeRecipeRunStage {
  readonly stageId: string;
  readonly stageName: string;
  readonly provider: string;
  readonly model: string;
  readonly output: string;
  readonly requestId?: string;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly totalTokens?: number;
  readonly cacheHit?: boolean;
  readonly attempts?: readonly { provider: string; model?: string; success: boolean; latencyMs: number; error?: string }[];
}

export interface ForgeRecipeRun {
  readonly id: string;
  readonly projectId: string;
  readonly recipeId: string;
  readonly recipeRevisionSha256: string;
  readonly status: "completed" | "failed";
  readonly input: string;
  readonly target?: AiProposalTarget;
  readonly sourceMemoryIds: readonly string[];
  readonly stages: readonly ForgeRecipeRunStage[];
  readonly proposalId?: string;
  readonly error?: string;
  readonly startedAt: string;
  readonly completedAt: string;
}

export function createForgeRecipe(input: {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  inputLabel?: string;
  outputKind?: ForgeRecipeOutputKind;
  memoryClasses?: readonly MemoryClass[];
  relevanceTags?: readonly string[];
  contextQueryTerms?: readonly string[];
  includeWorkingState?: boolean;
  enabled?: boolean;
  stages: readonly ForgeRecipeStage[];
  now?: string;
}): ForgeRecipe {
  const now = validTimestamp(input.now ?? new Date().toISOString(), "Recipe timestamp");
  return validateForgeRecipe({
    formatVersion: FORGE_RECIPE_FORMAT_VERSION,
    id: requiredText(input.id, "Recipe id", 120),
    projectId: requiredText(input.projectId, "Recipe project id", 120),
    name: requiredText(input.name, "Recipe name", 160),
    description: optionalText(input.description, 2_000) ?? "",
    inputLabel: optionalText(input.inputLabel, 160) ?? "Input",
    outputKind: input.outputKind ?? "creative-alternative",
    memoryClasses: uniqueMemoryClasses(input.memoryClasses ?? []),
    relevanceTags: uniqueStrings(input.relevanceTags ?? [], "Recipe relevance tags", 32, 120),
    contextQueryTerms: uniqueStrings(input.contextQueryTerms ?? [], "Recipe context query terms", 32, 160),
    includeWorkingState: input.includeWorkingState === true,
    enabled: input.enabled !== false,
    stages: input.stages.map(validateForgeRecipeStage),
    createdAt: now,
    updatedAt: now,
  });
}

export function updateForgeRecipe(existing: ForgeRecipe, input: Partial<Omit<ForgeRecipe, "formatVersion" | "projectId" | "createdAt" | "updatedAt">> & { now?: string }): ForgeRecipe {
  const now = validTimestamp(input.now ?? new Date().toISOString(), "Recipe update timestamp");
  if (Date.parse(now) < Date.parse(existing.createdAt)) throw new Error("Recipe update cannot precede recipe creation.");
  return validateForgeRecipe({
    ...existing,
    ...(input.id === undefined ? {} : { id: input.id }),
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.description === undefined ? {} : { description: input.description }),
    ...(input.inputLabel === undefined ? {} : { inputLabel: input.inputLabel }),
    ...(input.outputKind === undefined ? {} : { outputKind: input.outputKind }),
    ...(input.memoryClasses === undefined ? {} : { memoryClasses: input.memoryClasses }),
    ...(input.relevanceTags === undefined ? {} : { relevanceTags: input.relevanceTags }),
    ...(input.contextQueryTerms === undefined ? {} : { contextQueryTerms: input.contextQueryTerms }),
    ...(input.includeWorkingState === undefined ? {} : { includeWorkingState: input.includeWorkingState }),
    ...(input.enabled === undefined ? {} : { enabled: input.enabled }),
    ...(input.stages === undefined ? {} : { stages: input.stages }),
    updatedAt: now,
  });
}

export function validateForgeRecipe(value: ForgeRecipe): ForgeRecipe {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Forge Recipe must be an object.");
  if (value.formatVersion !== FORGE_RECIPE_FORMAT_VERSION) throw new Error("Unsupported Forge Recipe format.");
  const id = requiredText(value.id, "Recipe id", 120);
  const projectId = requiredText(value.projectId, "Recipe project id", 120);
  const name = requiredText(value.name, "Recipe name", 160);
  const description = optionalText(value.description, 2_000) ?? "";
  const inputLabel = requiredText(value.inputLabel, "Recipe input label", 160);
  if (!FORGE_RECIPE_OUTPUT_KINDS.includes(value.outputKind)) throw new Error(`Unsupported recipe output kind "${String(value.outputKind)}".`);
  const memoryClasses = uniqueMemoryClasses(value.memoryClasses);
  const relevanceTags = uniqueStrings(value.relevanceTags, "Recipe relevance tags", 32, 120);
  const contextQueryTerms = uniqueStrings(value.contextQueryTerms, "Recipe context query terms", 32, 160);
  if (typeof value.includeWorkingState !== "boolean" || typeof value.enabled !== "boolean") throw new Error("Recipe boolean controls are invalid.");
  if (!Array.isArray(value.stages) || value.stages.length < 1 || value.stages.length > FORGE_RECIPE_MAX_STAGES) throw new Error(`Recipe requires between 1 and ${FORGE_RECIPE_MAX_STAGES} stages.`);
  const stages = value.stages.map(validateForgeRecipeStage);
  const stageIds = new Set<string>();
  for (const stage of stages) {
    if (stageIds.has(stage.id)) throw new Error(`Duplicate recipe stage id "${stage.id}".`);
    stageIds.add(stage.id);
  }
  const createdAt = validTimestamp(value.createdAt, "Recipe createdAt");
  const updatedAt = validTimestamp(value.updatedAt, "Recipe updatedAt");
  if (Date.parse(updatedAt) < Date.parse(createdAt)) throw new Error("Recipe updatedAt cannot precede createdAt.");
  return Object.freeze({
    formatVersion: FORGE_RECIPE_FORMAT_VERSION,
    id, projectId, name, description, inputLabel, outputKind: value.outputKind,
    memoryClasses: Object.freeze(memoryClasses), relevanceTags: Object.freeze(relevanceTags), contextQueryTerms: Object.freeze(contextQueryTerms),
    includeWorkingState: value.includeWorkingState, enabled: value.enabled,
    stages: Object.freeze(stages), createdAt, updatedAt,
  });
}

export function validateForgeRecipeStage(value: ForgeRecipeStage): ForgeRecipeStage {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Recipe stage must be an object.");
  const id = requiredText(value.id, "Recipe stage id", 120);
  const name = requiredText(value.name, "Recipe stage name", 160);
  const instruction = requiredText(value.instruction, "Recipe stage instruction", 12_000);
  if (!FORGE_RECIPE_TASKS.includes(value.task)) throw new Error(`Unsupported recipe stage task "${String(value.task)}".`);
  if (typeof value.usePreviousOutput !== "boolean") throw new Error("Recipe stage usePreviousOutput must be boolean.");
  if (value.temperature !== undefined && (!Number.isFinite(value.temperature) || value.temperature < 0 || value.temperature > 2)) throw new Error("Recipe stage temperature must be between 0 and 2.");
  if (value.maxOutputTokens !== undefined && (!Number.isInteger(value.maxOutputTokens) || value.maxOutputTokens < 128 || value.maxOutputTokens > 32_000)) throw new Error("Recipe stage maxOutputTokens must be an integer between 128 and 32000.");
  const preferProvider = optionalText(value.preferProvider, 120);
  const preferModel = optionalText(value.preferModel, 240);
  for (const [label, flag] of [["requiresReasoning", value.requiresReasoning], ["requiresCreativeWriting", value.requiresCreativeWriting], ["requiresInstructionFollowing", value.requiresInstructionFollowing]] as const) {
    if (flag !== undefined && typeof flag !== "boolean") throw new Error(`Recipe stage ${label} must be boolean.`);
  }
  return Object.freeze({
    id, name, instruction, task: value.task, usePreviousOutput: value.usePreviousOutput,
    ...(value.temperature === undefined ? {} : { temperature: value.temperature }),
    ...(value.maxOutputTokens === undefined ? {} : { maxOutputTokens: value.maxOutputTokens }),
    ...(preferProvider ? { preferProvider } : {}), ...(preferModel ? { preferModel } : {}),
    ...(value.requiresReasoning === undefined ? {} : { requiresReasoning: value.requiresReasoning }),
    ...(value.requiresCreativeWriting === undefined ? {} : { requiresCreativeWriting: value.requiresCreativeWriting }),
    ...(value.requiresInstructionFollowing === undefined ? {} : { requiresInstructionFollowing: value.requiresInstructionFollowing }),
  });
}

export function validateForgeRecipeRun(value: ForgeRecipeRun): ForgeRecipeRun {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Forge Recipe run must be an object.");
  const id = requiredText(value.id, "Recipe run id", 160);
  const projectId = requiredText(value.projectId, "Recipe run project id", 120);
  const recipeId = requiredText(value.recipeId, "Recipe run recipe id", 120);
  if (!/^[a-f0-9]{64}$/.test(value.recipeRevisionSha256)) throw new Error("Recipe run revision hash is invalid.");
  if (value.status !== "completed" && value.status !== "failed") throw new Error("Recipe run status is invalid.");
  if (typeof value.input !== "string" || value.input.length > 200_000) throw new Error("Recipe run input is invalid.");
  const sourceMemoryIds = uniqueStrings(value.sourceMemoryIds, "Recipe run source memory ids", 512, 160);
  if (!Array.isArray(value.stages) || value.stages.length > FORGE_RECIPE_MAX_STAGES) throw new Error("Recipe run stage history is invalid.");
  const stages = value.stages.map((stage) => validateRunStage(stage));
  const proposalId = optionalText(value.proposalId, 160);
  const error = optionalText(value.error, 8_000);
  if (value.status === "completed" && !proposalId) throw new Error("Completed recipe run requires a proposal id.");
  if (value.status === "failed" && !error) throw new Error("Failed recipe run requires an error.");
  const startedAt = validTimestamp(value.startedAt, "Recipe run startedAt");
  const completedAt = validTimestamp(value.completedAt, "Recipe run completedAt");
  if (Date.parse(completedAt) < Date.parse(startedAt)) throw new Error("Recipe run completion cannot precede start.");
  return Object.freeze({
    id, projectId, recipeId, recipeRevisionSha256: value.recipeRevisionSha256, status: value.status,
    input: value.input, ...(value.target ? { target: validateTarget(value.target) } : {}),
    sourceMemoryIds: Object.freeze(sourceMemoryIds), stages: Object.freeze(stages),
    ...(proposalId ? { proposalId } : {}), ...(error ? { error } : {}), startedAt, completedAt,
  });
}

function validateRunStage(stage: ForgeRecipeRunStage): ForgeRecipeRunStage {
  if (!stage || typeof stage !== "object" || Array.isArray(stage)) throw new Error("Recipe run stage must be an object.");
  const stageId = requiredText(stage.stageId, "Recipe run stage id", 120);
  const stageName = requiredText(stage.stageName, "Recipe run stage name", 160);
  const provider = requiredText(stage.provider, "Recipe run provider", 120);
  const model = requiredText(stage.model, "Recipe run model", 240);
  const output = requiredText(stage.output, "Recipe run stage output", 400_000);
  const requestId = optionalText(stage.requestId, 240);
  for (const [label, count] of [["inputTokens", stage.inputTokens], ["outputTokens", stage.outputTokens], ["totalTokens", stage.totalTokens]] as const) {
    if (count !== undefined && (!Number.isInteger(count) || count < 0)) throw new Error(`Recipe run ${label} is invalid.`);
  }
  if (stage.cacheHit !== undefined && typeof stage.cacheHit !== "boolean") throw new Error("Recipe run cacheHit is invalid.");
  return Object.freeze({ ...stage, stageId, stageName, provider, model, output, ...(requestId ? { requestId } : {}) });
}

function validateTarget(target: AiProposalTarget): AiProposalTarget {
  return Object.freeze({
    bookId: requiredText(target.bookId, "Recipe target book id", 160),
    chapterId: requiredText(target.chapterId, "Recipe target chapter id", 160),
    sceneId: requiredText(target.sceneId, "Recipe target scene id", 160),
  });
}

function uniqueMemoryClasses(values: readonly MemoryClass[]): MemoryClass[] {
  if (!Array.isArray(values)) throw new Error("Recipe memory classes must be an array.");
  const unique = [...new Set(values)];
  if (unique.length > MEMORY_CLASSES.length || unique.some((value) => !MEMORY_CLASSES.includes(value))) throw new Error("Recipe contains an unsupported memory class.");
  return unique;
}

function uniqueStrings(values: readonly string[], label: string, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(values)) throw new Error(`${label} must be an array.`);
  if (values.length > maxItems) throw new Error(`${label} exceeds ${maxItems} items.`);
  const output = [...new Set(values.map((value) => requiredText(value, label, maxLength)))];
  return output;
}

function requiredText(value: unknown, label: string, max: number): string {
  if (typeof value !== "string") throw new Error(`${label} is required.`);
  const text = value.normalize("NFKC").trim();
  if (!text) throw new Error(`${label} is required.`);
  if (text.length > max) throw new Error(`${label} exceeds ${max} characters.`);
  return text;
}

function optionalText(value: unknown, max: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new Error("Optional recipe text must be a string.");
  const text = value.normalize("NFKC").trim();
  if (!text) return undefined;
  if (text.length > max) throw new Error(`Optional recipe text exceeds ${max} characters.`);
  return text;
}

function validTimestamp(value: unknown, label: string): string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new Error(`${label} must be a valid timestamp.`);
  return value;
}

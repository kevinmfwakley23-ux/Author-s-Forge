import { randomUUID } from "node:crypto";
import type { AiWritingTask } from "./ai-writing";
import type { AiWritingStudioService, StudioAiContextOptions } from "./ai-writing-studio";
import type { StudioWorkspaceState } from "../domain/studio-workspace";
import { getBook } from "../domain/studio-workspace";
import { CONTEXT_INCLUSION_MODES, type ContextSectionPolicy } from "../domain/context-assembly";

const AI_WRITING_TASKS: readonly AiWritingTask[] = ["draft", "continue", "rewrite", "expand", "dialogue", "description", "outline", "brainstorm"];

export interface StudioAiWritingHttpDependencies {
  readonly studio: Pick<AiWritingStudioService, "previewContext" | "generateWithProjectContext">;
  readonly workspace: StudioWorkspaceState;
  readonly projectId: string;
}

export async function previewStudioAiWritingContext(
  dependencies: Pick<StudioAiWritingHttpDependencies, "studio" | "projectId">,
  input: Record<string, unknown>,
) {
  return dependencies.studio.previewContext(dependencies.projectId, contextOptions(input));
}

export async function generateStudioAiWritingProposal(
  dependencies: StudioAiWritingHttpDependencies,
  input: Record<string, unknown>,
) {
  const { studio, workspace, projectId } = dependencies;
  const book = getBook(workspace, String(input.bookId ?? workspace.activeBookId ?? ""));
  const chapterId = String(input.chapterId ?? "");
  const chapter = chapterId ? book.chapters.find((item) => item.id === chapterId) : undefined;
  if (!chapter) throw new Error("A valid chapter is required for AI writing.");
  const sceneId = String(input.sceneId ?? "");
  const scene = sceneId ? chapter.scenes.find((item) => item.id === sceneId) : undefined;
  if (!scene) throw new Error("A valid scene is required for AI writing.");
  const task = writingTask(input.task ?? "continue");
  const instruction = String(input.instruction ?? "").trim();
  if (!instruction) throw new Error("AI writing instruction is required.");

  return studio.generateWithProjectContext({
    projectId,
    bookId: book.id,
    chapterId: chapter.id,
    sceneId: scene.id,
    task,
    instruction,
    existingContent: scene.content,
    context: contextOptions({ ...input, query: input.contextQuery ?? input.query ?? instruction }),
    proposalId: String(input.proposalId ?? `proposal-${randomUUID()}`),
    now: input.now === undefined ? undefined : String(input.now),
  });
}

function contextOptions(input: Record<string, unknown>): StudioAiContextOptions {
  return {
    query: input.query === undefined ? undefined : String(input.query),
    characterIds: Array.isArray(input.characterIds) ? input.characterIds.map(String) : undefined,
    characterAsOf: input.characterAsOf === undefined ? undefined : String(input.characterAsOf),
    characterMemoryLimit: input.characterMemoryLimit === undefined ? undefined : finitePositiveInteger(input.characterMemoryLimit, "character memory limit"),
    memoryLimitPerSection: input.memoryLimitPerSection === undefined ? undefined : finitePositiveInteger(input.memoryLimitPerSection, "memory limit per section"),
    policies: parsePolicies(input.policies),
  };
}

function parsePolicies(value: unknown): readonly ContextSectionPolicy[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error("Context policies must be an array.");
  return value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Context policy must be an object.");
    const policy = item as Record<string, unknown>;
    const key = String(policy.key ?? "").trim();
    if (!key) throw new Error("Context policy key is required.");
    const mode = String(policy.mode ?? "");
    if (!CONTEXT_INCLUSION_MODES.includes(mode as (typeof CONTEXT_INCLUSION_MODES)[number])) throw new Error("Invalid context inclusion mode.");
    return {
      key,
      mode: mode as (typeof CONTEXT_INCLUSION_MODES)[number],
      ...(policy.maxWords === undefined ? {} : { maxWords: finitePositiveInteger(policy.maxWords, "context max words") }),
    };
  });
}

function writingTask(value: unknown): AiWritingTask {
  if (typeof value !== "string" || !AI_WRITING_TASKS.includes(value as AiWritingTask)) throw new Error("Invalid AI writing task.");
  return value as AiWritingTask;
}

function finitePositiveInteger(value: unknown, label: string): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new Error(`Invalid ${label}.`);
  return number;
}

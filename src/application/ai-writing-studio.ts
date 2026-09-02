import type { AiProposal } from "./ai-proposal-store";
import { AiWritingCoordinator } from "./ai-writing-coordinator";
import { selectContextBudget, type ContextPriority } from "./context-budget-manager";
import { assertApprovedSceneCardGeneration } from "./scene-card-generation-guard";
import { assembleWritingContext, type AssembledWritingContext, type ContextAssemblyRequest } from "../domain/context-assembly";
import { assessVoiceDrift, buildAuthorVoiceContext, type AuthorVoiceMemory, type VoiceDriftReport } from "../domain/author-voice-memory";
import { createCharacterContinuityEvidence, verifyCharacterContinuityEvidence, type CharacterContinuityEvidence } from "../domain/character-continuity-evidence";
import type { CharacterRecord } from "../domain/character-bible";
import { assertAiCollaborationCapability, type AiCollaborationPolicy } from "../domain/ai-collaboration";
import { chapterCardApprovalFor, type ChapterCardWorkflowState } from "../domain/chapter-card-workflow";
import type { SceneCardWorkflowState } from "../domain/scene-card-workflow";
import { validateStoryMapPlanningState, type StoryMapChapterCard, type StoryMapPlanningState } from "../domain/story-map-planning";
import { saveSceneContent, validateStudioWorkspace, type StudioWorkspaceState } from "../domain/studio-workspace";
import type { FileProjectStore } from "../infrastructure/file-project-store";
import { createHash } from "node:crypto";

export interface StudioAiProjectState {
  readonly metadata: { readonly id: string };
  readonly studioWorkspace?: StudioWorkspaceState;
  readonly authorVoiceMemory?: AuthorVoiceMemory;
  readonly characters?: readonly CharacterRecord[];
  readonly storyMapPlanning?: StoryMapPlanningState;
  readonly chapterCardWorkflow?: ChapterCardWorkflowState;
  readonly sceneCardWorkflow?: SceneCardWorkflowState;
  readonly aiCollaborationPolicy?: AiCollaborationPolicy;
  readonly [key: string]: unknown;
}

export type StudioAiContextOptions = Pick<ContextAssemblyRequest, "policies" | "query" | "characterIds" | "characterAsOf" | "characterMemoryLimit" | "memoryLimitPerSection"> & {
  readonly contextTokenBudget?: number;
};

export interface StudioAiContextBudget {
  readonly requestedBudget?: number;
  readonly originalEstimatedTokens: number;
  readonly selectedEstimatedTokens: number;
  readonly tokensSaved: number;
  readonly constrained: boolean;
  readonly overBudget: boolean;
  readonly includedSectionKeys: readonly string[];
  readonly omittedSectionKeys: readonly string[];
  readonly canonPreserved: boolean;
  readonly authorVoiceIncluded: boolean;
  readonly authorVoiceEstimatedTokens: number;
}

export type StudioAiWritingRequest = Omit<Parameters<AiWritingCoordinator["generate"]>[0], "assembledContext" | "sourceMemoryIds" | "characterContinuity"> & {
  readonly context?: StudioAiContextOptions;
  readonly sceneCardSha256?: string;
};

export type StudioAiWritingResult = Awaited<ReturnType<AiWritingCoordinator["generate"]>> & {
  readonly context: AssembledWritingContext;
  readonly contextBudget: StudioAiContextBudget;
  readonly voiceDrift?: VoiceDriftReport;
  readonly characterContinuity: CharacterContinuityEvidence;
};

export interface StudioAiContextPreview {
  readonly context: AssembledWritingContext;
  readonly contextBudget: StudioAiContextBudget;
  readonly authorVoice: {
    readonly available: boolean;
    readonly sampleCount: number;
    readonly canonicalSampleCount: number;
  };
}

/**
 * Application boundary for the Studio's author-controlled AI writing loop.
 * Generation creates a durable pending proposal; approval never mutates the
 * manuscript by itself; apply is a separate, explicit operation with stale
 * scene and character-continuity guards.
 */
export class AiWritingStudioService {
  constructor(
    private readonly projects: Pick<FileProjectStore, "load" | "save">,
    private readonly coordinator: AiWritingCoordinator,
  ) {}

  async list(projectId: string): Promise<AiProposal[]> {
    await this.requireProject(projectId);
    return this.coordinator.list(projectId);
  }

  async get(projectId: string, proposalId: string): Promise<AiProposal> {
    await this.requireProject(projectId);
    const proposal = await this.coordinator.get(proposalId);
    if (!proposal || proposal.projectId !== projectId) throw new Error(`AI proposal "${proposalId}" not found in project "${projectId}".`);
    return proposal;
  }

  async generate(request: Parameters<AiWritingCoordinator["generate"]>[0]): Promise<StudioAiWritingResult> {
    const legacyCharacterIds = selectedCharacterIdsFromAssembledContext(request.assembledContext);
    return this.generateWithProjectContext({
      projectId: request.projectId,
      bookId: request.bookId,
      chapterId: request.chapterId,
      sceneId: request.sceneId,
      task: request.task,
      instruction: request.instruction,
      existingContent: request.existingContent,
      proposalId: request.proposalId,
      baseContentSha256: request.baseContentSha256,
      now: request.now,
      context: {
        query: request.instruction,
        ...(legacyCharacterIds.length ? { characterIds: legacyCharacterIds } : {}),
      },
    });
  }

  async previewContext(projectId: string, options: StudioAiContextOptions = {}): Promise<StudioAiContextPreview> {
    const project = await this.requireProject(projectId);
    const assembled = this.assembleProjectContext(project, projectId, options);
    const voiceMemory = project.authorVoiceMemory;
    if (voiceMemory && voiceMemory.projectId !== projectId) throw new Error("Author voice memory belongs to another project.");
    const voiceContext = voiceMemory ? buildAuthorVoiceContext(voiceMemory) : undefined;
    const budgeted = applyGovernedContextBudget(assembled, options.contextTokenBudget, voiceContext);
    return {
      context: budgeted.context,
      contextBudget: budgeted.budget,
      authorVoice: {
        available: Boolean(voiceMemory?.samples.length),
        sampleCount: voiceMemory?.samples.length ?? 0,
        canonicalSampleCount: voiceMemory?.canonicalSampleIds.length ?? 0,
      },
    };
  }

  async generateWithProjectContext(request: StudioAiWritingRequest): Promise<StudioAiWritingResult> {
    const { sceneCardSha256, ...writingRequest } = request;
    const project = await this.requireProject(request.projectId);
    assertAiCollaborationCapability(project.aiCollaborationPolicy, collaborationCapabilityForWritingTask(request.task), `AI ${request.task} writing`, "author-requested");
    const workspace = project.studioWorkspace ? validateStudioWorkspace(project.studioWorkspace) : validateStudioWorkspace({ formatVersion: 1, activeBookId: null, books: [] });
    const scene = findScene(workspace, request.bookId, request.chapterId, request.sceneId);
    if (sceneCardSha256) {
      assertApprovedSceneCardGeneration(project, workspace, {
        bookId: request.bookId,
        chapterId: request.chapterId,
        sceneId: request.sceneId,
        expectedCardSha256: sceneCardSha256,
      });
    }
    const chapterCard = chapterCardFor(project, workspace, request.chapterId);
    const chapterCharacterIds = chapterCard ? [...chapterCard.povCharacterIds, ...chapterCard.characterIds] : [];
    const characterIds = uniqueStrings([...(request.context?.characterIds ?? []), ...chapterCharacterIds]);
    let assembled = this.assembleProjectContext(project, request.projectId, {
      query: request.context?.query ?? request.instruction,
      characterIds: characterIds.length ? characterIds : undefined,
      characterAsOf: request.context?.characterAsOf,
      characterMemoryLimit: request.context?.characterMemoryLimit,
      memoryLimitPerSection: request.context?.memoryLimitPerSection,
      policies: request.context?.policies,
      contextTokenBudget: request.context?.contextTokenBudget,
    });
    if (chapterCard) assembled = withChapterCardContext(assembled, request.chapterId, chapterCard);
    const voiceMemory = project.authorVoiceMemory;
    if (voiceMemory && voiceMemory.projectId !== request.projectId) throw new Error("Author voice memory belongs to another project.");
    const voiceContext = voiceMemory ? buildAuthorVoiceContext(voiceMemory) : undefined;
    const budgeted = applyGovernedContextBudget(assembled, request.context?.contextTokenBudget, voiceContext);
    const context = budgeted.context;
    const existingContent = request.existingContent ?? scene.content;
    const selectedCharacterIds = context.evidence.filter((item) => item.sectionKey === "characters").map((item) => item.sourceId);
    const characterEvidence = Object.fromEntries(context.evidence.filter((item) => item.sectionKey === "characters").map((item) => [item.sourceId, item.reasons]));
    const characterContinuity = createCharacterContinuityEvidence({
      projectId: request.projectId,
      characters: project.characters ?? [],
      selectedCharacterIds,
      evidence: characterEvidence,
      checkedAt: request.now,
    });
    const generated = await this.coordinator.generate({
      ...writingRequest,
      existingContent,
      assembledContext: formatContext(context, voiceMemory),
      sourceMemoryIds: context.sourceIds,
      characterContinuity,
      baseContentSha256: request.baseContentSha256 ?? sha256(existingContent),
    }, voiceMemory ? (candidate) => assessVoiceDrift(candidate, voiceMemory) : undefined);
    const voiceDrift = generated.proposal.voiceDrift;
    return { ...generated, context, contextBudget: budgeted.budget, characterContinuity, ...(voiceDrift ? { voiceDrift } : {}) };
  }

  async review(projectId: string, proposalId: string, decision: "accepted" | "rejected", note?: string, now?: string) {
    const proposal = await this.get(projectId, proposalId);
    return this.coordinator.review(proposal.id, decision, note, now);
  }

  async applyAccepted(projectId: string, proposalId: string, now?: string): Promise<{ proposal: AiProposal; workspace: StudioWorkspaceState }> {
    const proposal = await this.get(projectId, proposalId);
    if (proposal.status !== "accepted") throw new Error(`AI proposal "${proposalId}" must be accepted by the author before it can enter the manuscript.`);
    if (!proposal.target) throw new Error(`AI proposal "${proposalId}" has no manuscript target.`);

    const project = await this.requireProject(projectId);
    const workspace = project.studioWorkspace ? validateStudioWorkspace(project.studioWorkspace) : validateStudioWorkspace({ formatVersion: 1, activeBookId: null, books: [] });
    const target = proposal.target;
    const book = workspace.books.find((item) => item.id === target.bookId);
    if (!book) throw new Error(`AI proposal target book "${target.bookId}" no longer exists.`);
    const chapter = book.chapters.find((item) => item.id === target.chapterId);
    if (!chapter) throw new Error(`AI proposal target chapter "${target.chapterId}" no longer exists.`);
    const scene = chapter.scenes.find((item) => item.id === target.sceneId);
    if (!scene) throw new Error(`AI proposal target scene "${target.sceneId}" no longer exists.`);

    const expectedBaseHash = proposal.baseContentSha256;
    if (expectedBaseHash && sha256(scene.content) !== expectedBaseHash && scene.content !== proposal.proposedContent) {
      throw new Error(`AI proposal "${proposalId}" is stale because the target scene changed after the proposal was generated.`);
    }

    if (proposal.characterContinuity) {
      const continuity = verifyCharacterContinuityEvidence(proposal.characterContinuity, project.characters ?? []);
      if (!continuity.valid) throw new Error(`AI proposal "${proposalId}" requires a new continuity review: ${continuity.findings.join(" ")}`);
    }

    if (scene.content === proposal.proposedContent) return { proposal, workspace };
    const updated = saveSceneContent(workspace, target.bookId, target.chapterId, target.sceneId, proposal.proposedContent, now);
    await this.projects.save({ ...project, studioWorkspace: updated, metadata: { ...project.metadata, updatedAt: now ?? new Date().toISOString() } } as never);
    return { proposal, workspace: updated };
  }

  private assembleProjectContext(project: StudioAiProjectState, projectId: string, options: StudioAiContextOptions) {
    return assembleWritingContext(project as never, {
      projectId,
      query: options.query,
      characterIds: options.characterIds,
      characterAsOf: options.characterAsOf,
      characterMemoryLimit: options.characterMemoryLimit,
      memoryLimitPerSection: options.memoryLimitPerSection,
      policies: options.policies,
    });
  }

  private async requireProject(projectId: string): Promise<StudioAiProjectState> {
    if (!projectId.trim()) throw new Error("Project id is required.");
    const project = await this.projects.load(projectId);
    if (!project) throw new Error(`Project "${projectId}" not found.`);
    return project as unknown as StudioAiProjectState;
  }
}

const CONTEXT_SECTION_PRIORITY: Readonly<Record<string, ContextPriority>> = {
  canon: "critical",
  "chapter-card": "critical",
  characters: "high",
  voice: "high",
  relationships: "normal",
  timeline: "normal",
  "unresolved-threads": "normal",
  research: "optional",
};

const AUTHOR_VOICE_BUDGET_ID = "author-voice-memory";

export function applyGovernedContextBudget(
  context: AssembledWritingContext,
  requestedBudget?: number,
  authorVoiceContext?: string,
): { context: AssembledWritingContext; budget: StudioAiContextBudget } {
  const voiceContext = authorVoiceContext?.trim() ?? "";
  const budgetSections = context.sections.map((section, order) => ({
    id: section.key,
    content: section.text,
    priority: CONTEXT_SECTION_PRIORITY[section.key] ?? "normal" as ContextPriority,
    order,
  }));
  if (voiceContext) {
    budgetSections.push({
      id: AUTHOR_VOICE_BUDGET_ID,
      content: voiceContext,
      priority: "critical",
      order: context.sections.length,
    });
  }
  const result = selectContextBudget(budgetSections, requestedBudget);
  const included = new Set(result.includedIds);
  const sections = context.sections.filter((section) => included.has(section.key));
  const sourceIds = [...new Set(sections.flatMap((section) => section.sourceIds))];
  const sourceSet = new Set(sourceIds);
  const evidence = context.evidence.filter((item) => included.has(item.sectionKey) && sourceSet.has(item.sourceId));
  const budgetedContext: AssembledWritingContext = {
    ...context,
    sections,
    totalWords: sections.reduce((total, section) => total + section.wordCount, 0),
    sourceIds,
    evidence,
  };
  const includedSectionKeys = result.includedIds.filter((id) => id !== AUTHOR_VOICE_BUDGET_ID);
  const omittedSectionKeys = result.omittedIds.filter((id) => id !== AUTHOR_VOICE_BUDGET_ID);
  const authorVoiceIncluded = !voiceContext || result.includedIds.includes(AUTHOR_VOICE_BUDGET_ID);
  const authorVoiceEstimatedTokens = voiceContext ? selectContextBudget([{ id: AUTHOR_VOICE_BUDGET_ID, content: voiceContext, priority: "critical" }], undefined).selectedEstimatedTokens : 0;
  return {
    context: budgetedContext,
    budget: {
      ...(requestedBudget === undefined ? {} : { requestedBudget }),
      originalEstimatedTokens: result.originalEstimatedTokens,
      selectedEstimatedTokens: result.selectedEstimatedTokens,
      tokensSaved: result.tokensSaved,
      constrained: result.constrained,
      overBudget: requestedBudget !== undefined && result.selectedEstimatedTokens > requestedBudget,
      includedSectionKeys,
      omittedSectionKeys,
      canonPreserved: !context.sections.some((section) => section.key === "canon") || includedSectionKeys.includes("canon"),
      authorVoiceIncluded,
      authorVoiceEstimatedTokens,
    },
  };
}

function findScene(workspace: StudioWorkspaceState, bookId: string, chapterId: string, sceneId: string) {
  const book = workspace.books.find((item) => item.id === bookId);
  if (!book) throw new Error(`AI writing target book "${bookId}" not found.`);
  const chapter = book.chapters.find((item) => item.id === chapterId);
  if (!chapter) throw new Error(`AI writing target chapter "${chapterId}" not found.`);
  const scene = chapter.scenes.find((item) => item.id === sceneId);
  if (!scene) throw new Error(`AI writing target scene "${sceneId}" not found.`);
  return scene;
}

function chapterCardFor(project: StudioAiProjectState, workspace: StudioWorkspaceState, chapterId: string): StoryMapChapterCard | undefined {
  if (!project.storyMapPlanning) return undefined;
  const planning = validateStoryMapPlanningState(project.storyMapPlanning);
  const card = planning.chapterCards[chapterId];
  if (!card) return undefined;
  const matches = workspace.books.reduce((count, book) => count + book.chapters.filter((chapter) => chapter.id === chapterId).length, 0);
  if (matches !== 1) throw new Error(`Chapter Card for chapter "${chapterId}" is ambiguous across books. Give the chapters globally unique ids before AI generation.`);
  if (!chapterCardApprovalFor(project.chapterCardWorkflow, chapterId, card)) return undefined;
  return card;
}

function withChapterCardContext(context: AssembledWritingContext, chapterId: string, card: StoryMapChapterCard): AssembledWritingContext {
  const text = formatChapterCard(card);
  const section = {
    key: "chapter-card",
    title: "Approved Chapter Card — Author-Controlled Plan",
    mode: "full" as const,
    text,
    sourceIds: [] as string[],
    wordCount: wordCount(text),
  };
  const sections = [section, ...context.sections.filter((item) => item.key !== "chapter-card")];
  return {
    ...context,
    sections,
    totalWords: sections.reduce((total, item) => total + item.wordCount, 0),
  };
}

function formatChapterCard(card: StoryMapChapterCard): string {
  const list = (label: string, values: readonly string[]) => values.length ? `${label}:\n${values.map((value) => `- ${value}`).join("\n")}` : "";
  return [
    "This Chapter Card was explicitly approved by the author for AI drafting. Honor it before generating prose. Required events, continuity dependencies, and forbidden deviations are constraints, not suggestions. Do not invent around a forbidden deviation.",
    card.povCharacterIds.length ? `POV character ids: ${card.povCharacterIds.join(", ")}` : "",
    card.location ? `Location: ${card.location}` : "",
    card.storyTime ? `Date / story time: ${card.storyTime}` : "",
    card.emotionalObjective ? `Emotional objective: ${card.emotionalObjective}` : "",
    card.plotObjective ? `Plot objective: ${card.plotObjective}` : "",
    card.characterIds.length ? `Characters present ids: ${card.characterIds.join(", ")}` : "",
    list("Required events", card.requiredEvents),
    list("Clues", card.clues),
    list("Reveals", card.reveals),
    list("Continuity dependencies", card.continuityDependencies),
    card.atmosphere ? `Atmosphere: ${card.atmosphere}` : "",
    card.endingHook ? `Ending hook: ${card.endingHook}` : "",
    card.approximateWordCount ? `Approximate chapter word target: ${card.approximateWordCount}` : "",
    list("FORBIDDEN DEVIATIONS — NON-NEGOTIABLE", card.forbiddenDeviations),
  ].filter(Boolean).join("\n\n");
}

function formatContext(context: AssembledWritingContext, voiceMemory?: AuthorVoiceMemory): string {
  const sections = context.sections.map((section) => `## ${section.title}\n${section.text}`);
  if (voiceMemory) sections.push(`## Author Voice Memory\n${buildAuthorVoiceContext(voiceMemory)}`);
  return sections.join("\n\n");
}

function selectedCharacterIdsFromAssembledContext(serialized: string): string[] {
  if (!serialized.trim()) return [];
  try {
    const parsed = JSON.parse(serialized) as { evidence?: unknown };
    if (!Array.isArray(parsed.evidence)) return [];
    const ids = parsed.evidence.flatMap((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const evidence = item as { sectionKey?: unknown; sourceId?: unknown };
      if (evidence.sectionKey !== "characters" || typeof evidence.sourceId !== "string" || !evidence.sourceId.trim()) return [];
      return [evidence.sourceId];
    });
    return [...new Set(ids)];
  } catch {
    return [];
  }
}

function collaborationCapabilityForWritingTask(task: StudioAiWritingRequest["task"]): "draft" | "revise" {
  return task === "rewrite" || task === "expand" ? "revise" : "draft";
}
function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
function wordCount(value: string): number {
  const normalized = value.trim();
  return normalized ? normalized.split(/\s+/u).length : 0;
}

export function sha256(value: string): string { return createHash("sha256").update(value, "utf8").digest("hex"); }

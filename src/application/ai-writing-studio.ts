import type { AiProposal } from "./ai-proposal-store";
import { AiWritingCoordinator } from "./ai-writing-coordinator";
import { assembleWritingContext, type ContextAssemblyRequest } from "../domain/context-assembly";
import { assessVoiceDrift, buildAuthorVoiceContext, type AuthorVoiceMemory, type VoiceDriftReport } from "../domain/author-voice-memory";
import { createCharacterContinuityEvidence, verifyCharacterContinuityEvidence, type CharacterContinuityEvidence } from "../domain/character-continuity-evidence";
import type { CharacterRecord } from "../domain/character-bible";
import { saveSceneContent, validateStudioWorkspace, type StudioWorkspaceState } from "../domain/studio-workspace";
import type { FileProjectStore } from "../infrastructure/file-project-store";
import { createHash } from "node:crypto";

export interface StudioAiProjectState {
  readonly metadata: { readonly id: string };
  readonly studioWorkspace?: StudioWorkspaceState;
  readonly authorVoiceMemory?: AuthorVoiceMemory;
  readonly characters?: readonly CharacterRecord[];
  readonly [key: string]: unknown;
}

export type StudioAiContextOptions = Pick<ContextAssemblyRequest, "policies" | "query" | "characterIds" | "characterAsOf" | "characterMemoryLimit">;

export type StudioAiWritingRequest = Omit<Parameters<AiWritingCoordinator["generate"]>[0], "assembledContext" | "sourceMemoryIds" | "characterContinuity"> & {
  readonly context?: StudioAiContextOptions;
};

export type StudioAiWritingResult = Awaited<ReturnType<AiWritingCoordinator["generate"]>> & {
  readonly context: Awaited<ReturnType<typeof assembleWritingContext>>;
  readonly voiceDrift?: VoiceDriftReport;
  readonly characterContinuity: CharacterContinuityEvidence;
};

export interface StudioAiContextPreview {
  readonly context: Awaited<ReturnType<typeof assembleWritingContext>>;
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
      context: { query: request.instruction },
    });
  }

  async previewContext(projectId: string, options: StudioAiContextOptions = {}): Promise<StudioAiContextPreview> {
    const project = await this.requireProject(projectId);
    const context = this.assembleProjectContext(project, projectId, options);
    const voiceMemory = project.authorVoiceMemory;
    if (voiceMemory && voiceMemory.projectId !== projectId) throw new Error("Author voice memory belongs to another project.");
    return {
      context,
      authorVoice: {
        available: Boolean(voiceMemory?.samples.length),
        sampleCount: voiceMemory?.samples.length ?? 0,
        canonicalSampleCount: voiceMemory?.canonicalSampleIds.length ?? 0,
      },
    };
  }

  async generateWithProjectContext(request: StudioAiWritingRequest): Promise<StudioAiWritingResult> {
    const project = await this.requireProject(request.projectId);
    const workspace = project.studioWorkspace ? validateStudioWorkspace(project.studioWorkspace) : validateStudioWorkspace({ formatVersion: 1, activeBookId: null, books: [] });
    const scene = findScene(workspace, request.bookId, request.chapterId, request.sceneId);
    const context = this.assembleProjectContext(project, request.projectId, {
      query: request.context?.query ?? request.instruction,
      characterIds: request.context?.characterIds,
      characterAsOf: request.context?.characterAsOf,
      characterMemoryLimit: request.context?.characterMemoryLimit,
      policies: request.context?.policies,
    });
    const voiceMemory = project.authorVoiceMemory;
    if (voiceMemory && voiceMemory.projectId !== request.projectId) throw new Error("Author voice memory belongs to another project.");
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
      ...request,
      existingContent,
      assembledContext: formatContext(context, voiceMemory),
      sourceMemoryIds: context.sourceIds,
      characterContinuity,
      baseContentSha256: request.baseContentSha256 ?? sha256(existingContent),
    }, voiceMemory ? (candidate) => assessVoiceDrift(candidate, voiceMemory) : undefined);
    const voiceDrift = generated.proposal.voiceDrift;
    return { ...generated, context, characterContinuity, ...(voiceDrift ? { voiceDrift } : {}) };
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

function findScene(workspace: StudioWorkspaceState, bookId: string, chapterId: string, sceneId: string) {
  const book = workspace.books.find((item) => item.id === bookId);
  if (!book) throw new Error(`AI writing target book "${bookId}" not found.`);
  const chapter = book.chapters.find((item) => item.id === chapterId);
  if (!chapter) throw new Error(`AI writing target chapter "${chapterId}" not found.`);
  const scene = chapter.scenes.find((item) => item.id === sceneId);
  if (!scene) throw new Error(`AI writing target scene "${sceneId}" not found.`);
  return scene;
}

function formatContext(context: Awaited<ReturnType<typeof assembleWritingContext>>, voiceMemory?: AuthorVoiceMemory): string {
  const sections = context.sections.map((section) => `## ${section.title}\n${section.text}`);
  if (voiceMemory) sections.push(`## Author Voice Memory\n${buildAuthorVoiceContext(voiceMemory)}`);
  return sections.join("\n\n");
}

export function sha256(value: string): string { return createHash("sha256").update(value, "utf8").digest("hex"); }

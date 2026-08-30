import type { AiProposal } from "./ai-proposal-store";
import { AiWritingCoordinator } from "./ai-writing-coordinator";
import { assembleWritingContext, type ContextAssemblyRequest } from "../domain/context-assembly";
import { assessVoiceDrift, buildAuthorVoiceContext, type AuthorVoiceMemory, type VoiceDriftReport } from "../domain/author-voice-memory";
import { saveSceneContent, validateStudioWorkspace, type StudioWorkspaceState } from "../domain/studio-workspace";
import type { FileProjectStore } from "../infrastructure/file-project-store";
import { createHash } from "node:crypto";

export interface StudioAiProjectState {
  readonly metadata: { readonly id: string };
  readonly studioWorkspace?: StudioWorkspaceState;
  readonly authorVoiceMemory?: AuthorVoiceMemory;
  readonly [key: string]: unknown;
}

export type StudioAiContextOptions = Pick<ContextAssemblyRequest, "policies" | "query" | "characterIds" | "characterAsOf" | "characterMemoryLimit">;

export type StudioAiWritingRequest = Omit<Parameters<AiWritingCoordinator["generate"]>[0], "assembledContext" | "sourceMemoryIds"> & {
  readonly context?: StudioAiContextOptions;
};

export type StudioAiWritingResult = Awaited<ReturnType<AiWritingCoordinator["generate"]>> & {
  readonly context: Awaited<ReturnType<typeof assembleWritingContext>>;
  readonly voiceDrift?: VoiceDriftReport;
};

/**
 * Application boundary for the Studio's author-controlled AI writing loop.
 * Generation creates a durable pending proposal; approval never mutates the
 * manuscript by itself; apply is a separate, explicit operation with a stale
 * scene guard so an older proposal cannot overwrite newer author work.
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

  async generate(request: Parameters<AiWritingCoordinator["generate"]>[0]) {
    await this.requireTarget(request.projectId, request.bookId, request.chapterId, request.sceneId);
    return this.coordinator.generate(request);
  }

  /**
   * Production Studio entry point: builds governed context from the authoritative
   * project immediately before generation. Callers cannot accidentally supply a
   * stale character or author-voice dump as the source of truth.
   */
  async generateWithProjectContext(request: StudioAiWritingRequest): Promise<StudioAiWritingResult> {
    const project = await this.requireProject(request.projectId);
    const workspace = project.studioWorkspace ? validateStudioWorkspace(project.studioWorkspace) : validateStudioWorkspace({ formatVersion: 1, activeBookId: null, books: [] });
    const scene = findScene(workspace, request.bookId, request.chapterId, request.sceneId);
    const context = assembleWritingContext(project as never, {
      projectId: request.projectId,
      query: request.context?.query ?? request.instruction,
      characterIds: request.context?.characterIds,
      characterAsOf: request.context?.characterAsOf,
      characterMemoryLimit: request.context?.characterMemoryLimit,
      policies: request.context?.policies,
    });
    const voiceMemory = project.authorVoiceMemory;
    if (voiceMemory && voiceMemory.projectId !== request.projectId) throw new Error("Author voice memory belongs to another project.");
    const existingContent = request.existingContent ?? scene.content;
    const generated = await this.coordinator.generate({
      ...request,
      existingContent,
      assembledContext: formatContext(context, voiceMemory),
      sourceMemoryIds: context.sourceIds,
      baseContentSha256: request.baseContentSha256 ?? sha256(existingContent),
    }, voiceMemory ? (candidate) => assessVoiceDrift(candidate, voiceMemory) : undefined);
    const voiceDrift = generated.proposal.voiceDrift;
    return { ...generated, context, ...(voiceDrift ? { voiceDrift } : {}) };
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

    if (scene.content === proposal.proposedContent) return { proposal, workspace };
    const updated = saveSceneContent(workspace, target.bookId, target.chapterId, target.sceneId, proposal.proposedContent, now);
    await this.projects.save({ ...project, studioWorkspace: updated, metadata: { ...project.metadata, updatedAt: now ?? new Date().toISOString() } } as never);
    return { proposal, workspace: updated };
  }

  private async requireProject(projectId: string): Promise<StudioAiProjectState> {
    if (!projectId.trim()) throw new Error("Project id is required.");
    const project = await this.projects.load(projectId);
    if (!project) throw new Error(`Project "${projectId}" not found.`);
    return project as unknown as StudioAiProjectState;
  }

  private async requireTarget(projectId: string, bookId: string, chapterId: string, sceneId: string): Promise<void> {
    const project = await this.requireProject(projectId);
    const workspace = project.studioWorkspace ? validateStudioWorkspace(project.studioWorkspace) : validateStudioWorkspace({ formatVersion: 1, activeBookId: null, books: [] });
    findScene(workspace, bookId, chapterId, sceneId);
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

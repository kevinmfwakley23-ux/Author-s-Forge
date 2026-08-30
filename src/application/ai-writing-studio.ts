import type { AiProposal } from "./ai-proposal-store";
import { AiWritingCoordinator } from "./ai-writing-coordinator";
import { saveSceneContent, validateStudioWorkspace, type StudioWorkspaceState } from "../domain/studio-workspace";
import type { FileProjectStore } from "../infrastructure/file-project-store";
import { createHash } from "node:crypto";

export interface StudioAiProjectState {
  readonly metadata: { readonly id: string };
  readonly studioWorkspace?: StudioWorkspaceState;
  readonly [key: string]: unknown;
}

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

    const expectedBaseHash = (proposal as AiProposal & { baseContentSha256?: string }).baseContentSha256;
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
    const book = workspace.books.find((item) => item.id === bookId);
    if (!book) throw new Error(`AI writing target book "${bookId}" not found.`);
    const chapter = book.chapters.find((item) => item.id === chapterId);
    if (!chapter) throw new Error(`AI writing target chapter "${chapterId}" not found.`);
    if (!chapter.scenes.some((item) => item.id === sceneId)) throw new Error(`AI writing target scene "${sceneId}" not found.`);
  }
}

export function sha256(value: string): string { return createHash("sha256").update(value, "utf8").digest("hex"); }

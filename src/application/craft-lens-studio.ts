import { assembleWritingContext } from "../domain/context-assembly";
import { assessVoiceDrift, buildAuthorVoiceContext } from "../domain/author-voice-memory";
import { createCharacterContinuityEvidence } from "../domain/character-continuity-evidence";
import { analyzeCraft, createCraftLensProposalEvidence, type CraftLensReport } from "../domain/craft-lens";
import { validateStudioWorkspace } from "../domain/studio-workspace";
import type { ProjectState } from "../domain/project";
import type { ProjectStorePort } from "./project-store-port";
import type { AiProposal } from "./ai-proposal-store";
import { AiEditingStudioService } from "./ai-editing-studio";
import { sha256EditingContent } from "./ai-editing-proposals";

export interface StudioCraftLensTarget {
  readonly projectId: string;
  readonly bookId: string;
  readonly chapterId: string;
  readonly sceneId: string;
}

export interface StudioCraftLensAnalysis {
  readonly target: Omit<StudioCraftLensTarget, "projectId">;
  readonly sourceContentSha256: string;
  readonly report: CraftLensReport;
}

export interface StudioCraftLensProposalRequest extends StudioCraftLensTarget {
  readonly findingId: string;
  readonly selectedSuggestion: string;
  readonly instruction?: string;
  readonly proposalId: string;
  readonly now?: string;
}

/**
 * Governed Editing Room boundary for Craft Lens.
 *
 * The browser supplies only a project target, deterministic finding id, and an
 * author-selected strategy. This service reloads the authoritative project and
 * scene, reruns the deterministic lens, verifies the strategy belongs to that
 * exact finding, assembles current project context, and then creates a durable
 * author-reviewable proposal. Analysis never mutates manuscript or canon.
 */
export class StudioCraftLensService {
  constructor(
    private readonly projects: Pick<ProjectStorePort, "load">,
    private readonly editing: AiEditingStudioService,
  ) {}

  async analyze(target: StudioCraftLensTarget): Promise<StudioCraftLensAnalysis> {
    const { scene } = await this.authoritativeScene(target);
    return {
      target: { bookId: target.bookId, chapterId: target.chapterId, sceneId: target.sceneId },
      sourceContentSha256: sha256EditingContent(scene.content),
      report: analyzeCraft(scene.content),
    };
  }

  async propose(request: StudioCraftLensProposalRequest): Promise<AiProposal> {
    validateProposalRequest(request);
    const { project, scene } = await this.authoritativeScene(request);
    if (!scene.content.trim()) throw new Error("Craft Lens requires a non-empty authoritative scene before a rewrite proposal can be created.");

    const report = analyzeCraft(scene.content);
    const sourceContentSha256 = sha256EditingContent(scene.content);
    const craftLensEvidence = createCraftLensProposalEvidence({
      report,
      findingId: request.findingId,
      selectedSuggestion: request.selectedSuggestion,
      sourceContentSha256,
      analyzedAt: request.now,
    });

    const context = assembleWritingContext(project, {
      projectId: request.projectId,
      query: `${craftLensEvidence.message} ${craftLensEvidence.selectedSuggestion}`,
    });
    const selectedCharacterIds = context.evidence.filter((item) => item.sectionKey === "characters").map((item) => item.sourceId);
    const characterEvidence = Object.fromEntries(
      context.evidence.filter((item) => item.sectionKey === "characters").map((item) => [item.sourceId, item.reasons]),
    );
    const characterContinuity = createCharacterContinuityEvidence({
      projectId: request.projectId,
      characters: project.characters ?? [],
      selectedCharacterIds,
      evidence: characterEvidence,
      checkedAt: request.now,
    });
    const voiceMemory = project.authorVoiceMemory;
    if (voiceMemory && voiceMemory.projectId !== request.projectId) throw new Error("Author voice memory belongs to another project.");

    return this.editing.propose({
      projectId: request.projectId,
      bookId: request.bookId,
      chapterId: request.chapterId,
      sceneId: request.sceneId,
      sourceContent: scene.content,
      findingMessage: craftLensEvidence.message,
      recommendation: craftLensEvidence.selectedSuggestion,
      findingStart: 0,
      findingEnd: scene.content.length,
      instruction: request.instruction,
      assembledContext: formatContext(context, voiceMemory ? buildAuthorVoiceContext(voiceMemory) : undefined),
      sourceMemoryIds: context.sourceIds,
      characterContinuity,
      craftLensEvidence,
      proposalId: request.proposalId,
      now: request.now,
    }, voiceMemory ? (candidate) => assessVoiceDrift(candidate, voiceMemory) : undefined);
  }

  private async authoritativeScene(target: StudioCraftLensTarget): Promise<{ project: ProjectState; scene: { readonly content: string } }> {
    validateTarget(target);
    const project = await this.projects.load(target.projectId);
    if (!project) throw new Error(`Project "${target.projectId}" not found.`);
    const workspace = project.studioWorkspace ? validateStudioWorkspace(project.studioWorkspace) : validateStudioWorkspace({ formatVersion: 1, activeBookId: null, books: [] });
    const book = workspace.books.find((item) => item.id === target.bookId);
    if (!book) throw new Error(`Craft Lens target book "${target.bookId}" not found.`);
    const chapter = book.chapters.find((item) => item.id === target.chapterId);
    if (!chapter) throw new Error(`Craft Lens target chapter "${target.chapterId}" not found.`);
    const scene = chapter.scenes.find((item) => item.id === target.sceneId);
    if (!scene) throw new Error(`Craft Lens target scene "${target.sceneId}" not found.`);
    return { project, scene };
  }
}

function formatContext(context: ReturnType<typeof assembleWritingContext>, voiceContext?: string): string {
  const sections = context.sections.map((section) => `## ${section.title}\n${section.text}`);
  if (voiceContext?.trim()) sections.push(`## Author Voice Memory\n${voiceContext.trim()}`);
  return sections.join("\n\n");
}

function validateTarget(target: StudioCraftLensTarget): void {
  for (const [name, value] of Object.entries(target)) if (!value.trim()) throw new Error(`Craft Lens ${name} is required.`);
}

function validateProposalRequest(request: StudioCraftLensProposalRequest): void {
  validateTarget(request);
  if (!request.findingId.trim()) throw new Error("Craft Lens finding id is required.");
  if (!request.selectedSuggestion.trim()) throw new Error("Craft Lens revision strategy is required.");
  if (!request.proposalId.trim()) throw new Error("Craft Lens proposal id is required.");
}

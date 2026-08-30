import type { AiProposal, AiProposalKind, AiProposalTarget } from "./ai-proposal-store";
import type { AiProposalStore } from "./ai-proposal-store";

export const AI_WRITING_FORMAT_VERSION = 1 as const;

export type AiWritingTask = "draft" | "continue" | "rewrite" | "expand" | "dialogue" | "description" | "outline" | "brainstorm";

export interface AiWritingRequest {
  readonly projectId: string;
  readonly bookId: string;
  readonly chapterId: string;
  readonly sceneId: string;
  readonly task: AiWritingTask;
  readonly instruction: string;
  readonly existingContent: string;
  readonly assembledContext: string;
  readonly sourceMemoryIds: readonly string[];
  readonly proposalId: string;
  readonly now?: string;
}

export interface AiWritingProviderRequest {
  readonly task: AiWritingTask;
  readonly instruction: string;
  readonly existingContent: string;
  readonly assembledContext: string;
}

export interface AiWritingProvider {
  generate(request: AiWritingProviderRequest): Promise<string>;
}

export interface AiWritingResult {
  readonly formatVersion: typeof AI_WRITING_FORMAT_VERSION;
  readonly proposal: AiProposal;
  readonly task: AiWritingTask;
  readonly target: AiProposalTarget;
}

/**
 * The writing boundary deliberately produces a proposal instead of mutating
 * manuscript state. The caller must obtain explicit author approval before
 * applying the candidate to a scene. The target is persisted with the
 * proposal so approval remains recoverable after a process restart.
 */
export class AiWritingService {
  constructor(private readonly provider: AiWritingProvider, private readonly proposals: AiProposalStore) {}

  async generate(request: AiWritingRequest): Promise<AiWritingResult> {
    validateRequest(request);
    const proposedContent = (await this.provider.generate({
      task: request.task,
      instruction: request.instruction.trim(),
      existingContent: request.existingContent,
      assembledContext: request.assembledContext,
    })).trim();
    if (!proposedContent) throw new Error("AI writing provider returned empty content.");

    const kind: AiProposalKind = request.task === "brainstorm" || request.task === "outline" ? "creative-alternative" : "manuscript-edit";
    const target: AiProposalTarget = { bookId: request.bookId, chapterId: request.chapterId, sceneId: request.sceneId };
    const proposal = this.proposals.propose({
      id: request.proposalId,
      projectId: request.projectId,
      kind,
      title: `${labelForTask(request.task)} proposal`,
      rationale: request.instruction.trim(),
      proposedContent,
      sourceMemoryIds: request.sourceMemoryIds,
      target,
      now: request.now,
    });
    return { formatVersion: AI_WRITING_FORMAT_VERSION, proposal, task: request.task, target };
  }
}

function validateRequest(request: AiWritingRequest): void {
  for (const [name, value] of Object.entries({ projectId: request.projectId, bookId: request.bookId, chapterId: request.chapterId, sceneId: request.sceneId, proposalId: request.proposalId })) {
    if (!value.trim()) throw new Error(`AI writing ${name} is required.`);
  }
  if (!request.instruction.trim()) throw new Error("AI writing instruction is required.");
  if (!request.existingContent.trim() && request.task !== "draft" && request.task !== "outline" && request.task !== "brainstorm") {
    throw new Error(`AI writing task \"${request.task}\" requires existing scene content.`);
  }
  if (!Array.isArray(request.sourceMemoryIds)) throw new Error("AI writing source memory ids must be an array.");
}

function labelForTask(task: AiWritingTask): string { return task.charAt(0).toUpperCase() + task.slice(1); }

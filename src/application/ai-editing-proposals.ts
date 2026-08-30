import { createHash } from "node:crypto";
import { AiProposalStore, type AiProposal, type AiProposalTarget } from "./ai-proposal-store";
import type { AiWritingGenerator } from "./ai-writing-coordinator";

export interface AiEditingProposalRequest {
  readonly projectId: string;
  readonly bookId: string;
  readonly chapterId: string;
  readonly sceneId: string;
  readonly sourceContent: string;
  readonly findingMessage: string;
  readonly recommendation: string;
  readonly findingStart: number;
  readonly findingEnd: number;
  readonly instruction?: string;
  readonly sourceMemoryIds?: readonly string[];
  readonly proposalId: string;
  readonly now?: string;
}

/** Converts a deterministic editorial finding into an author-reviewable AI rewrite proposal. */
export class AiEditingProposalService {
  constructor(private readonly proposals: AiProposalStore, private readonly generator: AiWritingGenerator) {}

  async proposeRewrite(request: AiEditingProposalRequest): Promise<AiProposal> {
    validateRequest(request);
    const excerpt = request.sourceContent.slice(request.findingStart, request.findingEnd);
    const result = await this.generator({
      system: "You are Author's Forge's editorial rewrite engine. Return only the complete revised scene text. Preserve canon, facts, point of view, tense, and author intent. Improve the identified issue without inventing unsupported facts. Never return commentary or claim that the revision is canon.",
      user: [
        `EDITORIAL FINDING:\n${request.findingMessage}`,
        `EDITORIAL RECOMMENDATION:\n${request.recommendation}`,
        `TARGETED EXCERPT:\n${excerpt}`,
        `AUTHOR INSTRUCTION:\n${request.instruction?.trim() || "Resolve the finding while preserving the surrounding voice and meaning."}`,
        `COMPLETE SOURCE SCENE:\n${request.sourceContent}`,
      ].join("\n\n"),
      temperature: 0.35,
      maxOutputTokens: 7000,
    });
    const proposedContent = result.text.trim();
    if (!proposedContent) throw new Error("AI editing provider returned empty content.");
    const target: AiProposalTarget = { bookId: request.bookId, chapterId: request.chapterId, sceneId: request.sceneId };
    return this.proposals.propose({ id: request.proposalId, projectId: request.projectId, kind: "manuscript-edit", title: "Editorial rewrite proposal", rationale: `${request.findingMessage.trim()} ${request.recommendation.trim()}`.trim(), proposedContent, sourceMemoryIds: request.sourceMemoryIds ?? [], target, baseContentSha256: sha256(request.sourceContent), now: request.now });
  }
}

export function sha256EditingContent(value: string): string { return sha256(value); }
function sha256(value: string): string { return createHash("sha256").update(value, "utf8").digest("hex"); }
function validateRequest(request: AiEditingProposalRequest): void {
  for (const [name, value] of Object.entries({ projectId: request.projectId, bookId: request.bookId, chapterId: request.chapterId, sceneId: request.sceneId, proposalId: request.proposalId })) if (!value.trim()) throw new Error(`AI editing ${name} is required.`);
  if (!request.sourceContent.trim()) throw new Error("AI editing source content is required.");
  if (!request.findingMessage.trim()) throw new Error("AI editing finding message is required.");
  if (!request.recommendation.trim()) throw new Error("AI editing recommendation is required.");
  if (!Number.isInteger(request.findingStart) || !Number.isInteger(request.findingEnd) || request.findingStart < 0 || request.findingEnd <= request.findingStart || request.findingEnd > request.sourceContent.length) throw new Error("AI editing finding range is invalid.");
}

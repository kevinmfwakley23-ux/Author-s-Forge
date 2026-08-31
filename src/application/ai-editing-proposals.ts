import { createHash } from "node:crypto";
import { AiProposalStore, type AiProposal, type AiProposalTarget } from "./ai-proposal-store";
import type { AiWritingGenerator } from "./ai-writing-coordinator";
import type { AiWritingCandidateAssessor } from "./ai-writing";
import type { CharacterContinuityEvidence } from "../domain/character-continuity-evidence";
import { analyzeCraft, createCraftLensProposalEvidence, type CraftLensProposalEvidence } from "../domain/craft-lens";

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
  readonly assembledContext?: string;
  readonly sourceMemoryIds?: readonly string[];
  readonly characterContinuity?: CharacterContinuityEvidence;
  readonly proposalId: string;
  readonly now?: string;
}

/** Converts an editorial finding into an author-reviewable AI rewrite proposal. */
export class AiEditingProposalService {
  constructor(
    private readonly proposals: AiProposalStore,
    private readonly generator: AiWritingGenerator,
    private readonly assessCandidate?: AiWritingCandidateAssessor,
  ) {}

  async proposeRewrite(request: AiEditingProposalRequest): Promise<AiProposal> {
    validateRequest(request);
    const baseContentSha256 = sha256(request.sourceContent);
    // Craft provenance is never caller-supplied. It is inferred fresh from the
    // exact source revision, finding message, and author-selected strategy.
    const craftLensEvidence = inferCraftLensEvidence(request, baseContentSha256);
    const excerpt = request.sourceContent.slice(request.findingStart, request.findingEnd);
    const result = await this.generator({
      system: "You are Author's Forge's editorial rewrite engine. Return only the complete revised scene text. Preserve canon, facts, point of view, tense, author voice, character continuity, and author intent. Improve only the identified issue without inventing unsupported facts. Treat editorial diagnostics as evidence for author consideration, not universal style rules. Never return commentary or claim that the revision is canon.",
      user: [
        `EDITORIAL FINDING:\n${request.findingMessage}`,
        `AUTHOR-SELECTED REVISION STRATEGY:\n${request.recommendation}`,
        craftLensEvidence ? `CRAFT LENS EVIDENCE:\n${craftLensEvidence.evidence}` : "",
        `TARGETED EXCERPT:\n${excerpt}`,
        request.assembledContext?.trim() ? `GOVERNED PROJECT CONTEXT:\n${request.assembledContext.trim()}` : "",
        `AUTHOR INSTRUCTION:\n${request.instruction?.trim() || "Resolve the finding while preserving the surrounding voice and meaning."}`,
        `COMPLETE SOURCE SCENE:\n${request.sourceContent}`,
      ].filter(Boolean).join("\n\n"),
      temperature: 0.35,
      maxOutputTokens: 7000,
    });
    const proposedContent = result.text.trim();
    if (!proposedContent) throw new Error("AI editing provider returned empty content.");
    const voiceDrift = this.assessCandidate?.(proposedContent);
    const target: AiProposalTarget = { bookId: request.bookId, chapterId: request.chapterId, sceneId: request.sceneId };
    return this.proposals.propose({
      id: request.proposalId,
      projectId: request.projectId,
      kind: "manuscript-edit",
      title: craftLensEvidence ? `Craft Lens: ${craftLensEvidence.dimension} proposal` : "Editorial rewrite proposal",
      rationale: `${request.findingMessage.trim()} ${request.recommendation.trim()}`.trim(),
      proposedContent,
      sourceMemoryIds: request.sourceMemoryIds ?? [],
      target,
      baseContentSha256,
      ...(voiceDrift ? { voiceDrift } : {}),
      ...(request.characterContinuity ? { characterContinuity: request.characterContinuity } : {}),
      ...(craftLensEvidence ? { craftLensEvidence } : {}),
      now: request.now,
    });
  }
}

export function sha256EditingContent(value: string): string { return sha256(value); }
function sha256(value: string): string { return createHash("sha256").update(value, "utf8").digest("hex"); }

function inferCraftLensEvidence(request: AiEditingProposalRequest, sourceContentSha256: string): CraftLensProposalEvidence | undefined {
  const report = analyzeCraft(request.sourceContent);
  const finding = report.findings.find((item) => item.message === request.findingMessage.trim() && item.suggestions.includes(request.recommendation.trim()));
  if (!finding) return undefined;
  return createCraftLensProposalEvidence({
    report,
    findingId: finding.id,
    selectedSuggestion: request.recommendation,
    sourceContentSha256,
    analyzedAt: request.now,
  });
}

function validateRequest(request: AiEditingProposalRequest): void {
  for (const [name, value] of Object.entries({ projectId: request.projectId, bookId: request.bookId, chapterId: request.chapterId, sceneId: request.sceneId, proposalId: request.proposalId })) if (!value.trim()) throw new Error(`AI editing ${name} is required.`);
  if (!request.sourceContent.trim()) throw new Error("AI editing source content is required.");
  if (!request.findingMessage.trim()) throw new Error("AI editing finding message is required.");
  if (!request.recommendation.trim()) throw new Error("AI editing recommendation is required.");
  if (!Number.isInteger(request.findingStart) || !Number.isInteger(request.findingEnd) || request.findingStart < 0 || request.findingEnd <= request.findingStart || request.findingEnd > request.sourceContent.length) throw new Error("AI editing finding range is invalid.");
}

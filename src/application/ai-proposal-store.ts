import type { VoiceDriftReport } from "../domain/author-voice-memory";
import { validateCharacterContinuityEvidence, type CharacterContinuityEvidence } from "../domain/character-continuity-evidence";

export type AiProposalKind = "memory" | "manuscript-edit" | "research-note" | "continuity-finding" | "creative-alternative";
export type AiProposalStatus = "pending" | "accepted" | "rejected" | "superseded";

export interface AiProposalTarget {
  readonly bookId: string;
  readonly chapterId: string;
  readonly sceneId: string;
}

export interface AiProposal {
  readonly id: string;
  readonly projectId: string;
  readonly kind: AiProposalKind;
  readonly status: AiProposalStatus;
  readonly title: string;
  readonly rationale: string;
  readonly proposedContent: string;
  readonly sourceMemoryIds: readonly string[];
  readonly createdAt: string;
  readonly target?: AiProposalTarget;
  readonly baseContentSha256?: string;
  readonly voiceDrift?: VoiceDriftReport;
  readonly characterContinuity?: CharacterContinuityEvidence;
  readonly reviewedAt?: string;
  readonly reviewedBy?: "author" | "system";
  readonly reviewNote?: string;
}

export interface ProposalReviewDecision {
  readonly proposalId: string;
  readonly from: AiProposalStatus;
  readonly to: "accepted" | "rejected";
  readonly reviewer: "author" | "system";
  readonly note?: string;
  readonly reviewedAt: string;
}

type ProposalInput = Omit<AiProposal, "status" | "createdAt"> & { now?: string };

export class AiProposalStore {
  private readonly proposals = new Map<string, AiProposal>();

  propose(input: ProposalInput): AiProposal {
    if (!input.id.trim()) throw new Error("AI proposal id is required.");
    if (!input.projectId.trim()) throw new Error("AI proposal project id is required.");
    if (!input.title.trim()) throw new Error("AI proposal title is required.");
    if (!input.proposedContent.trim()) throw new Error("AI proposal content is required.");
    if (this.proposals.has(input.id)) throw new Error(`Duplicate AI proposal id \"${input.id}\".`);
    validateTarget(input.target);
    if (input.baseContentSha256 !== undefined && !/^[a-f0-9]{64}$/.test(input.baseContentSha256)) throw new Error("AI proposal base content hash is invalid.");
    validateVoiceDrift(input.voiceDrift);
    if (input.characterContinuity) {
      const continuity = validateCharacterContinuityEvidence(input.characterContinuity);
      if (continuity.projectId !== input.projectId) throw new Error("AI proposal character continuity evidence belongs to another project.");
    }
    const { now, ...fields } = input;
    const proposal: AiProposal = {
      ...fields,
      title: input.title.trim(),
      rationale: input.rationale.trim(),
      proposedContent: input.proposedContent,
      sourceMemoryIds: [...new Set(input.sourceMemoryIds)].sort(),
      status: "pending",
      createdAt: now ?? new Date().toISOString(),
      ...(input.target ? { target: { ...input.target } } : {}),
      ...(input.baseContentSha256 ? { baseContentSha256: input.baseContentSha256 } : {}),
      ...(input.voiceDrift ? { voiceDrift: cloneVoiceDrift(input.voiceDrift) } : {}),
      ...(input.characterContinuity ? { characterContinuity: cloneCharacterContinuity(input.characterContinuity) } : {}),
    };
    this.proposals.set(proposal.id, cloneProposal(proposal));
    return cloneProposal(proposal);
  }

  get(proposalId: string): AiProposal | undefined {
    const proposal = this.proposals.get(proposalId);
    return proposal ? cloneProposal(proposal) : undefined;
  }

  list(projectId?: string): AiProposal[] {
    return [...this.proposals.values()]
      .filter((proposal) => projectId === undefined || proposal.projectId === projectId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(cloneProposal);
  }

  review(proposalId: string, decision: "accepted" | "rejected", reviewer: "author" | "system", note?: string, now = new Date().toISOString()): ProposalReviewDecision {
    const existing = this.proposals.get(proposalId);
    if (!existing) throw new Error(`AI proposal \"${proposalId}\" not found.`);
    if (existing.status !== "pending") throw new Error(`AI proposal \"${proposalId}\" has already been reviewed.`);
    if (reviewer !== "author") throw new Error("AI proposals require author review before they become durable.");
    const reviewed: AiProposal = { ...existing, status: decision, reviewedAt: now, reviewedBy: reviewer, ...(note?.trim() ? { reviewNote: note.trim() } : {}) };
    this.proposals.set(proposalId, cloneProposal(reviewed));
    return { proposalId, from: existing.status, to: decision, reviewer, ...(note?.trim() ? { note: note.trim() } : {}), reviewedAt: now };
  }

  pending(projectId?: string): AiProposal[] { return this.list(projectId).filter((proposal) => proposal.status === "pending"); }

  snapshot(): AiProposal[] { return this.list(); }

  restore(proposals: readonly AiProposal[]): void {
    if (this.proposals.size > 0) throw new Error("AI proposal store is already populated.");
    const ids = new Set<string>();
    for (const proposal of proposals) {
      if (!proposal.id.trim()) throw new Error("AI proposal id is required.");
      if (ids.has(proposal.id)) throw new Error(`Duplicate AI proposal id \"${proposal.id}\".`);
      ids.add(proposal.id);
      validateTarget(proposal.target);
      if (proposal.baseContentSha256 !== undefined && !/^[a-f0-9]{64}$/.test(proposal.baseContentSha256)) throw new Error("AI proposal base content hash is invalid.");
      validateVoiceDrift(proposal.voiceDrift);
      if (proposal.characterContinuity) {
        const continuity = validateCharacterContinuityEvidence(proposal.characterContinuity);
        if (continuity.projectId !== proposal.projectId) throw new Error("AI proposal character continuity evidence belongs to another project.");
      }
      this.proposals.set(proposal.id, cloneProposal(proposal));
    }
  }
}

function validateTarget(target: AiProposalTarget | undefined): void {
  if (!target) return;
  for (const [name, value] of Object.entries(target)) {
    if (!value.trim()) throw new Error(`AI proposal target ${name} is required.`);
  }
}

function validateVoiceDrift(report: VoiceDriftReport | undefined): void {
  if (!report) return;
  if (!Number.isFinite(report.distance) || report.distance < 0) throw new Error("AI proposal voice drift distance is invalid.");
  if (!["low", "medium", "high"].includes(report.confidence)) throw new Error("AI proposal voice drift confidence is invalid.");
  for (const value of Object.values(report.dimensions)) if (!Number.isFinite(value)) throw new Error("AI proposal voice drift dimensions must be finite.");
}

function cloneVoiceDrift(report: VoiceDriftReport): VoiceDriftReport {
  return {
    ...report,
    matchedSamples: [...report.matchedSamples],
    warnings: [...report.warnings],
    dimensions: { ...report.dimensions },
    recommendations: [...report.recommendations],
  };
}

function cloneCharacterContinuity(evidence: CharacterContinuityEvidence): CharacterContinuityEvidence {
  return {
    ...evidence,
    characters: evidence.characters.map((character) => ({ ...character, evidence: [...character.evidence] })),
  };
}

function cloneProposal(proposal: AiProposal): AiProposal {
  return {
    ...proposal,
    sourceMemoryIds: [...proposal.sourceMemoryIds],
    ...(proposal.target ? { target: { ...proposal.target } } : {}),
    ...(proposal.baseContentSha256 ? { baseContentSha256: proposal.baseContentSha256 } : {}),
    ...(proposal.voiceDrift ? { voiceDrift: cloneVoiceDrift(proposal.voiceDrift) } : {}),
    ...(proposal.characterContinuity ? { characterContinuity: cloneCharacterContinuity(proposal.characterContinuity) } : {}),
  };
}

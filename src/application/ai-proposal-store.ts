export type AiProposalKind = "memory" | "manuscript-edit" | "research-note" | "continuity-finding" | "creative-alternative";
export type AiProposalStatus = "pending" | "accepted" | "rejected" | "superseded";

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

export class AiProposalStore {
  private readonly proposals = new Map<string, AiProposal>();

  propose(input: Omit<AiProposal, "status" | "createdAt"> & { now?: string }): AiProposal {
    if (!input.id.trim()) throw new Error("AI proposal id is required.");
    if (!input.projectId.trim()) throw new Error("AI proposal project id is required.");
    if (!input.title.trim()) throw new Error("AI proposal title is required.");
    if (!input.proposedContent.trim()) throw new Error("AI proposal content is required.");
    if (this.proposals.has(input.id)) throw new Error(`Duplicate AI proposal id \"${input.id}\".`);
    const proposal: AiProposal = {
      ...input,
      title: input.title.trim(),
      rationale: input.rationale.trim(),
      proposedContent: input.proposedContent,
      sourceMemoryIds: [...new Set(input.sourceMemoryIds)].sort(),
      status: "pending",
      createdAt: input.now ?? new Date().toISOString(),
    };
    delete (proposal as { now?: string }).now;
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
}

function cloneProposal(proposal: AiProposal): AiProposal { return { ...proposal, sourceMemoryIds: [...proposal.sourceMemoryIds] }; }

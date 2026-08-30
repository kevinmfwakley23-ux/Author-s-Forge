export const AI_PROPOSAL_FORMAT_VERSION = 1 as const;
export const AI_PROPOSAL_STATUSES = ["pending", "accepted", "rejected", "superseded"] as const;
export type AiProposalStatus = typeof AI_PROPOSAL_STATUSES[number];

export interface AiProposal {
  readonly formatVersion: typeof AI_PROPOSAL_FORMAT_VERSION;
  readonly id: string;
  readonly projectId: string;
  readonly operation: string;
  readonly targetType: string;
  readonly targetId?: string;
  readonly proposedValue: unknown;
  readonly rationale?: string;
  readonly createdAt: string;
  readonly decidedAt?: string;
  readonly decidedBy?: "author" | "system";
  readonly status: AiProposalStatus;
  readonly sourceRequestId?: string;
}

export function createAiProposal(input: Omit<AiProposal, "formatVersion" | "status">): AiProposal {
  if (!input.id.trim()) throw new Error("AI proposal id is required.");
  if (!input.projectId.trim()) throw new Error("AI proposal project id is required.");
  if (!input.operation.trim()) throw new Error("AI proposal operation is required.");
  if (!input.targetType.trim()) throw new Error("AI proposal target type is required.");
  return Object.freeze({
    formatVersion: AI_PROPOSAL_FORMAT_VERSION,
    id: input.id,
    projectId: input.projectId,
    operation: input.operation,
    targetType: input.targetType,
    ...(input.targetId ? { targetId: input.targetId } : {}),
    proposedValue: clone(input.proposedValue),
    ...(input.rationale ? { rationale: input.rationale } : {}),
    createdAt: input.createdAt,
    status: "pending" as const,
    ...(input.sourceRequestId ? { sourceRequestId: input.sourceRequestId } : {}),
  });
}

export function decideAiProposal(proposal: AiProposal, decision: "accepted" | "rejected", decidedBy: "author" | "system" = "author", now = new Date().toISOString()): AiProposal {
  if (proposal.status !== "pending") throw new Error(`AI proposal "${proposal.id}" is already ${proposal.status}.`);
  return Object.freeze({ ...proposal, status: decision, decidedAt: now, decidedBy });
}

export function supersedeAiProposal(proposal: AiProposal, now = new Date().toISOString()): AiProposal {
  if (proposal.status !== "pending") throw new Error(`AI proposal "${proposal.id}" is already ${proposal.status}.`);
  return Object.freeze({ ...proposal, status: "superseded", decidedAt: now, decidedBy: "system" as const });
}

function clone<T>(value: T): T { return value === undefined ? value : JSON.parse(JSON.stringify(value)) as T; }

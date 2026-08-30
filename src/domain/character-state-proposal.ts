import type { CharacterField, CharacterProfileUpdate } from "./character-bible";

export const CHARACTER_STATE_PROPOSAL_FORMAT_VERSION = 1 as const;
export type CharacterStateProposalStatus = "pending" | "accepted" | "rejected";
export interface CharacterStateEvidence { readonly quote: string; readonly start?: number; readonly end?: number; readonly rationale: string; }
export interface CharacterStateChangeProposal { readonly formatVersion: typeof CHARACTER_STATE_PROPOSAL_FORMAT_VERSION; readonly id: string; readonly projectId: string; readonly characterId: string; readonly sceneId: string; readonly status: CharacterStateProposalStatus; readonly confidence: number; readonly changes: CharacterProfileUpdate; readonly changedFields: readonly CharacterField[]; readonly evidence: readonly CharacterStateEvidence[]; readonly rationale: string; readonly sourceContentSha256: string; readonly createdAt: string; readonly reviewedAt?: string; readonly reviewNote?: string; }

export function createCharacterStateProposal(input: Omit<CharacterStateChangeProposal, "formatVersion" | "status">): CharacterStateChangeProposal {
  if (!input.id.trim() || !input.projectId.trim() || !input.characterId.trim() || !input.sceneId.trim()) throw new Error("Character state proposal identifiers are required.");
  if (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) throw new Error("Character state proposal confidence must be between 0 and 1.");
  if (!Object.keys(input.changes).length) throw new Error("Character state proposal requires at least one change.");
  if (!input.changedFields.length) throw new Error("Character state proposal requires changed fields.");
  if (!input.evidence.length) throw new Error("Character state proposal requires manuscript evidence.");
  return { ...input, formatVersion: CHARACTER_STATE_PROPOSAL_FORMAT_VERSION, status: "pending", changedFields: [...new Set(input.changedFields)], evidence: input.evidence.map((item) => ({ ...item })) };
}
export function reviewCharacterStateProposal(proposal: CharacterStateChangeProposal, decision: "accepted" | "rejected", input: { reviewedAt?: string; note?: string } = {}): CharacterStateChangeProposal {
  if (proposal.status !== "pending") throw new Error(`Character state proposal "${proposal.id}" has already been reviewed.`);
  const reviewedAt = new Date(input.reviewedAt ?? new Date().toISOString());
  if (Number.isNaN(reviewedAt.getTime())) throw new Error("Character state proposal review timestamp is invalid.");
  return { ...proposal, status: decision, reviewedAt: reviewedAt.toISOString(), ...(input.note?.trim() ? { reviewNote: input.note.trim() } : {}) };
}
export function validateCharacterStateProposal(value: unknown): CharacterStateChangeProposal {
  if (!value || typeof value !== "object") throw new Error("Invalid character state proposal.");
  const item = value as Record<string, unknown>;
  if (item.formatVersion !== CHARACTER_STATE_PROPOSAL_FORMAT_VERSION || typeof item.id !== "string" || typeof item.projectId !== "string" || typeof item.characterId !== "string" || typeof item.sceneId !== "string" || !["pending","accepted","rejected"].includes(String(item.status)) || typeof item.confidence !== "number" || !item.changes || typeof item.changes !== "object" || !Array.isArray(item.changedFields) || !Array.isArray(item.evidence) || typeof item.rationale !== "string" || typeof item.sourceContentSha256 !== "string" || !/^[a-f0-9]{64}$/.test(item.sourceContentSha256) || typeof item.createdAt !== "string") throw new Error("Invalid character state proposal format.");
  if (item.confidence < 0 || item.confidence > 1 || item.changedFields.length === 0 || item.evidence.length === 0) throw new Error("Invalid character state proposal values.");
  return JSON.parse(JSON.stringify(value)) as CharacterStateChangeProposal;
}

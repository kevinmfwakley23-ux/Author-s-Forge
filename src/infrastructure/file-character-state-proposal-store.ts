import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { validateCharacterStateProposal, type CharacterStateChangeProposal } from "../domain/character-state-proposal";

export const CHARACTER_STATE_PROPOSAL_STORE_FORMAT_VERSION = 1 as const;
export interface CharacterStateProposalStoreState { readonly formatVersion: typeof CHARACTER_STATE_PROPOSAL_STORE_FORMAT_VERSION; readonly proposals: readonly CharacterStateChangeProposal[]; }
export class FileCharacterStateProposalStore {
  private state: CharacterStateProposalStoreState = { formatVersion: CHARACTER_STATE_PROPOSAL_STORE_FORMAT_VERSION, proposals: [] };
  private loaded = false;
  constructor(private readonly root: string) {}
  async load(): Promise<readonly CharacterStateChangeProposal[]> { if (!this.loaded) { try { const raw = await readFile(this.path(), "utf8"); const parsed = JSON.parse(raw) as CharacterStateProposalStoreState; if (parsed.formatVersion !== CHARACTER_STATE_PROPOSAL_STORE_FORMAT_VERSION || !Array.isArray(parsed.proposals)) throw new Error("Invalid character state proposal store format."); this.state = { formatVersion: CHARACTER_STATE_PROPOSAL_STORE_FORMAT_VERSION, proposals: parsed.proposals.map(validateCharacterStateProposal) }; } catch (error) { if (!(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ENOENT")) throw error; } this.loaded = true; } return this.state.proposals.map((proposal) => JSON.parse(JSON.stringify(proposal))); }
  async save(proposal: CharacterStateChangeProposal): Promise<CharacterStateChangeProposal> { const proposals = [...await this.load()]; const index = proposals.findIndex((item) => item.id === proposal.id); if (index >= 0) proposals[index] = validateCharacterStateProposal(proposal); else proposals.push(validateCharacterStateProposal(proposal)); this.state = { formatVersion: CHARACTER_STATE_PROPOSAL_STORE_FORMAT_VERSION, proposals }; await mkdir(this.root, { recursive: true }); await writeFile(this.path(), JSON.stringify(this.state, null, 2), "utf8"); return JSON.parse(JSON.stringify(proposal)); }
  async get(projectId: string, proposalId: string): Promise<CharacterStateChangeProposal | undefined> { return (await this.load()).find((proposal) => proposal.id === proposalId && proposal.projectId === projectId); }
  async list(projectId: string): Promise<CharacterStateChangeProposal[]> { return (await this.load()).filter((proposal) => proposal.projectId === projectId).map((proposal) => JSON.parse(JSON.stringify(proposal))); }
  private path(): string { return join(this.root, "character-state-proposals.json"); }
}

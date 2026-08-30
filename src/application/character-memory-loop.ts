import { updateCharacter, type CharacterRecord } from "../domain/character-bible";
import { captureCharacterSceneState, createCharacterStateMemory, type CharacterStateMemory } from "../domain/character-state-memory";
import type { CharacterStateChangeProposal } from "../domain/character-state-proposal";

/** Author-controlled completion boundary for character memory: proposal -> approve -> snapshot. */
export class CharacterMemoryLoopService {
  acceptProposal(character: CharacterRecord, memory: CharacterStateMemory | undefined, proposal: CharacterStateChangeProposal, input: { now?: string; note?: string }): { character: CharacterRecord; memory: CharacterStateMemory; proposal: CharacterStateChangeProposal } {
    if (proposal.status !== "accepted") throw new Error("Only an author-accepted character state proposal can update character memory.");
    if (proposal.projectId !== character.projectId || proposal.characterId !== character.id) throw new Error("Character state proposal does not belong to the character.");
    const updated = updateCharacter(character, { characterId: character.id, changes: proposal.changes, effectiveAt: input.now, reason: input.note?.trim() || `Accepted character state proposal ${proposal.id}`, actor: "author" });
    const nextMemory = captureCharacterSceneState(memory ?? createCharacterStateMemory(character), updated, { sceneId: proposal.sceneId, capturedAt: input.now, source: "author", changedFields: proposal.changedFields });
    return { character: updated, memory: nextMemory, proposal };
  }
}

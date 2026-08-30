import {
  type CharacterChange,
  type CharacterField,
  type CharacterFieldVersion,
  type CharacterProfile,
  type CharacterRecord,
  type CharacterUpdateInput,
  createCharacter,
  getCharacterAt,
  getCharacterChanges,
  getCharacterFieldHistory,
  updateCharacter,
  validateCharacterRecord
} from "../domain/character-bible";

export interface CharacterQuery { readonly projectId?: string; readonly name?: string; readonly currentLocation?: string; }
export interface CharacterHistoryQuery { readonly characterId: string; readonly field?: CharacterField; readonly asOf?: string; }
export interface CharacterMemoryQuery { readonly projectId: string; readonly characterIds?: readonly string[]; readonly asOf?: string; readonly includeFields?: readonly CharacterField[]; readonly queryTerms?: readonly string[]; readonly limit?: number; }
export interface CharacterMemoryHit { readonly characterId: string; readonly characterName: string; readonly score: number; readonly evidence: readonly string[]; readonly profile: CharacterProfile; readonly asOf: string; }

export class CharacterBibleService {
  private readonly records = new Map<string, CharacterRecord>();
  create(input: { id: string; projectId: string; profile: CharacterProfile; now?: string; reason?: string; actor?: "author" | "system" }): CharacterRecord { const character = createCharacter(input); if (this.records.has(character.id)) throw new Error(`Duplicate character id "${character.id}".`); this.records.set(character.id, character); return cloneCharacter(character); }
  get(characterId: string): CharacterRecord | undefined { const character = this.records.get(characterId); return character ? cloneCharacter(character) : undefined; }
  require(characterId: string): CharacterRecord { const character = this.records.get(characterId); if (!character) throw new Error(`Character "${characterId}" not found.`); return cloneCharacter(character); }
  update(input: CharacterUpdateInput): CharacterRecord { const existing = this.records.get(input.characterId); if (!existing) throw new Error(`Character "${input.characterId}" not found.`); const updated = updateCharacter(existing, input); this.records.set(updated.id, updated); return cloneCharacter(updated); }
  at(characterId: string, asOf: string): CharacterProfile { return getCharacterAt(this.require(characterId), asOf); }
  history(query: CharacterHistoryQuery): readonly CharacterFieldVersion[] | readonly CharacterChange[] | CharacterProfile { const character = this.require(query.characterId); if (query.asOf !== undefined) return getCharacterAt(character, query.asOf); if (query.field !== undefined) return getCharacterFieldHistory(character, query.field); return getCharacterChanges(character); }
  changes(characterId: string): readonly CharacterChange[] { return getCharacterChanges(this.require(characterId)); }
  list(query: CharacterQuery = {}): CharacterRecord[] { return [...this.records.values()].filter((character) => { if (query.projectId !== undefined && character.projectId !== query.projectId) return false; if (query.name !== undefined && character.profile.name !== query.name) return false; if (query.currentLocation !== undefined && character.profile.currentLocation !== query.currentLocation) return false; return true; }).sort((a, b) => a.id.localeCompare(b.id)).map(cloneCharacter); }

  /** Retrieve the most relevant character state for drafting without exposing the whole bible. */
  memory(query: CharacterMemoryQuery): CharacterMemoryHit[] {
    if (!query.projectId.trim()) throw new Error("Character memory project id is required.");
    const limit = query.limit === undefined ? 8 : Math.max(1, Math.min(50, Math.floor(query.limit)));
    const allowed = new Set(query.characterIds ?? []);
    const fields = query.includeFields?.length ? query.includeFields : ["name", "personality", "goals", "motivations", "relationships", "knowledge", "currentEmotionalState", "currentLocation", "characterArc"] as CharacterField[];
    const terms = [...new Set((query.queryTerms ?? []).map((term) => term.trim().toLowerCase()).filter(Boolean))];
    const asOf = query.asOf ?? new Date().toISOString();
    return this.list({ projectId: query.projectId }).filter((character) => !allowed.size || allowed.has(character.id)).map((character) => {
      const profile = query.asOf ? getCharacterAt(character, query.asOf) : character.profile;
      const evidence: string[] = [];
      let score = allowed.has(character.id) ? 10 : 0;
      for (const field of fields) {
        const value = profile[field];
        const text = Array.isArray(value) ? JSON.stringify(value) : String(value);
        const lower = text.toLowerCase();
        const matches = terms.filter((term) => lower.includes(term));
        if (matches.length) { score += matches.length * 5; evidence.push(`${field}: matched ${matches.join(", ")}`); }
        if (field === "name" && terms.some((term) => lower === term)) score += 10;
      }
      if (profile.currentEmotionalState && terms.length === 0) evidence.push(`currentEmotionalState: ${profile.currentEmotionalState}`);
      if (profile.currentLocation && terms.length === 0) evidence.push(`currentLocation: ${profile.currentLocation}`);
      return { characterId: character.id, characterName: profile.name, score, evidence, profile, asOf };
    }).filter((hit) => terms.length === 0 || hit.score > 0).sort((a, b) => b.score - a.score || a.characterId.localeCompare(b.characterId)).slice(0, limit).map((hit) => ({ ...hit, profile: JSON.parse(JSON.stringify(hit.profile)) }));
  }

  remove(characterId: string): void { if (!this.records.delete(characterId)) throw new Error(`Character "${characterId}" not found.`); }
  toPortableState(projectId?: string): readonly CharacterRecord[] { return this.list({ projectId }); }
  restore(records: readonly CharacterRecord[]): void { this.records.clear(); for (const record of records) { const validated = validateCharacterRecord(record); if (this.records.has(validated.id)) throw new Error(`Duplicate character id "${validated.id}".`); this.records.set(validated.id, cloneCharacter(validated)); } }
  restoreProject(projectId: string, records: readonly CharacterRecord[]): void { if (!projectId.trim()) throw new Error("Project id is required."); if (records.some((record) => record.projectId !== projectId)) throw new Error("Character state contains a character from another project."); this.restore(records); }
}
function cloneCharacter(character: CharacterRecord): CharacterRecord { return validateCharacterRecord(JSON.parse(JSON.stringify(character))); }

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

export interface CharacterQuery {
  readonly projectId?: string;
  readonly name?: string;
  readonly currentLocation?: string;
}

export interface CharacterHistoryQuery {
  readonly characterId: string;
  readonly field?: CharacterField;
  readonly asOf?: string;
}

export class CharacterBibleService {
  private readonly records = new Map<string, CharacterRecord>();

  create(input: { id: string; projectId: string; profile: CharacterProfile; now?: string; reason?: string; actor?: "author" | "system" }): CharacterRecord {
    const character = createCharacter(input);
    if (this.records.has(character.id)) throw new Error(`Duplicate character id "${character.id}".`);
    this.records.set(character.id, character);
    return cloneCharacter(character);
  }

  get(characterId: string): CharacterRecord | undefined {
    const character = this.records.get(characterId);
    return character ? cloneCharacter(character) : undefined;
  }

  require(characterId: string): CharacterRecord {
    const character = this.records.get(characterId);
    if (!character) throw new Error(`Character "${characterId}" not found.`);
    return cloneCharacter(character);
  }

  update(input: CharacterUpdateInput): CharacterRecord {
    const existing = this.records.get(input.characterId);
    if (!existing) throw new Error(`Character "${input.characterId}" not found.`);
    const updated = updateCharacter(existing, input);
    this.records.set(updated.id, updated);
    return cloneCharacter(updated);
  }

  at(characterId: string, asOf: string): CharacterProfile {
    return getCharacterAt(this.require(characterId), asOf);
  }

  history(query: CharacterHistoryQuery): readonly CharacterFieldVersion[] | readonly CharacterChange[] | CharacterProfile {
    const character = this.require(query.characterId);
    if (query.asOf !== undefined) return getCharacterAt(character, query.asOf);
    if (query.field !== undefined) return getCharacterFieldHistory(character, query.field);
    return getCharacterChanges(character);
  }

  changes(characterId: string): readonly CharacterChange[] {
    return getCharacterChanges(this.require(characterId));
  }

  list(query: CharacterQuery = {}): CharacterRecord[] {
    return [...this.records.values()]
      .filter((character) => {
        if (query.projectId !== undefined && character.projectId !== query.projectId) return false;
        if (query.name !== undefined && character.profile.name !== query.name) return false;
        if (query.currentLocation !== undefined && character.profile.currentLocation !== query.currentLocation) return false;
        return true;
      })
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(cloneCharacter);
  }

  remove(characterId: string): void {
    if (!this.records.delete(characterId)) throw new Error(`Character "${characterId}" not found.`);
  }

  toPortableState(projectId?: string): readonly CharacterRecord[] {
    return this.list({ projectId });
  }

  restore(records: readonly CharacterRecord[]): void {
    this.records.clear();
    for (const record of records) {
      const validated = validateCharacterRecord(record);
      if (this.records.has(validated.id)) throw new Error(`Duplicate character id "${validated.id}".`);
      this.records.set(validated.id, cloneCharacter(validated));
    }
  }

  restoreProject(projectId: string, records: readonly CharacterRecord[]): void {
    if (!projectId.trim()) throw new Error("Project id is required.");
    if (records.some((record) => record.projectId !== projectId)) throw new Error("Character state contains a character from another project.");
    this.restore(records);
  }
}

function cloneCharacter(character: CharacterRecord): CharacterRecord {
  return validateCharacterRecord(JSON.parse(JSON.stringify(character)));
}

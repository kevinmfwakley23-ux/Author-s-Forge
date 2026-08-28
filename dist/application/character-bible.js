"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CharacterBibleService = void 0;
const character_bible_1 = require("../domain/character-bible");
class CharacterBibleService {
    records = new Map();
    create(input) {
        const character = (0, character_bible_1.createCharacter)(input);
        if (this.records.has(character.id))
            throw new Error(`Duplicate character id "${character.id}".`);
        this.records.set(character.id, character);
        return cloneCharacter(character);
    }
    get(characterId) {
        const character = this.records.get(characterId);
        return character ? cloneCharacter(character) : undefined;
    }
    require(characterId) {
        const character = this.records.get(characterId);
        if (!character)
            throw new Error(`Character "${characterId}" not found.`);
        return cloneCharacter(character);
    }
    update(input) {
        const existing = this.records.get(input.characterId);
        if (!existing)
            throw new Error(`Character "${input.characterId}" not found.`);
        const updated = (0, character_bible_1.updateCharacter)(existing, input);
        this.records.set(updated.id, updated);
        return cloneCharacter(updated);
    }
    at(characterId, asOf) {
        return (0, character_bible_1.getCharacterAt)(this.require(characterId), asOf);
    }
    history(query) {
        const character = this.require(query.characterId);
        if (query.asOf !== undefined)
            return (0, character_bible_1.getCharacterAt)(character, query.asOf);
        if (query.field !== undefined)
            return (0, character_bible_1.getCharacterFieldHistory)(character, query.field);
        return (0, character_bible_1.getCharacterChanges)(character);
    }
    changes(characterId) {
        return (0, character_bible_1.getCharacterChanges)(this.require(characterId));
    }
    list(query = {}) {
        return [...this.records.values()]
            .filter((character) => {
            if (query.projectId !== undefined && character.projectId !== query.projectId)
                return false;
            if (query.name !== undefined && character.profile.name !== query.name)
                return false;
            if (query.currentLocation !== undefined && character.profile.currentLocation !== query.currentLocation)
                return false;
            return true;
        })
            .sort((a, b) => a.id.localeCompare(b.id))
            .map(cloneCharacter);
    }
    remove(characterId) {
        if (!this.records.delete(characterId))
            throw new Error(`Character "${characterId}" not found.`);
    }
    toPortableState(projectId) {
        return this.list({ projectId });
    }
    restore(records) {
        this.records.clear();
        for (const record of records) {
            const validated = (0, character_bible_1.validateCharacterRecord)(record);
            if (this.records.has(validated.id))
                throw new Error(`Duplicate character id "${validated.id}".`);
            this.records.set(validated.id, cloneCharacter(validated));
        }
    }
    restoreProject(projectId, records) {
        if (!projectId.trim())
            throw new Error("Project id is required.");
        if (records.some((record) => record.projectId !== projectId))
            throw new Error("Character state contains a character from another project.");
        this.restore(records);
    }
}
exports.CharacterBibleService = CharacterBibleService;
function cloneCharacter(character) {
    return (0, character_bible_1.validateCharacterRecord)(JSON.parse(JSON.stringify(character)));
}
//# sourceMappingURL=character-bible.js.map
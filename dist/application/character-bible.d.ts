import { type CharacterChange, type CharacterField, type CharacterFieldVersion, type CharacterProfile, type CharacterRecord, type CharacterUpdateInput } from "../domain/character-bible";
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
export declare class CharacterBibleService {
    private readonly records;
    create(input: {
        id: string;
        projectId: string;
        profile: CharacterProfile;
        now?: string;
        reason?: string;
        actor?: "author" | "system";
    }): CharacterRecord;
    get(characterId: string): CharacterRecord | undefined;
    require(characterId: string): CharacterRecord;
    update(input: CharacterUpdateInput): CharacterRecord;
    at(characterId: string, asOf: string): CharacterProfile;
    history(query: CharacterHistoryQuery): readonly CharacterFieldVersion[] | readonly CharacterChange[] | CharacterProfile;
    changes(characterId: string): readonly CharacterChange[];
    list(query?: CharacterQuery): CharacterRecord[];
    remove(characterId: string): void;
    toPortableState(projectId?: string): readonly CharacterRecord[];
    restore(records: readonly CharacterRecord[]): void;
    restoreProject(projectId: string, records: readonly CharacterRecord[]): void;
}

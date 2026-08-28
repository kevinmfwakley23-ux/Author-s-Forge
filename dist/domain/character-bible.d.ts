export declare const CHARACTER_BIBLE_FORMAT_VERSION: 1;
export declare const CHARACTER_FIELDS: readonly ["name", "age", "birthDate", "physicalAppearance", "height", "build", "hair", "eyes", "skin", "clothing", "voice", "speechPatterns", "personality", "values", "fears", "secrets", "goals", "motivations", "relationships", "history", "knowledge", "skills", "weaknesses", "characterArc", "importantObjects", "currentEmotionalState", "currentLocation", "currentInjuries"];
export type CharacterField = typeof CHARACTER_FIELDS[number];
export interface CharacterRelationship {
    readonly characterId: string;
    readonly relationship: string;
    readonly status: string;
    readonly notes: string;
}
export interface CharacterProfile {
    readonly name: string;
    readonly age: number;
    readonly birthDate: string;
    readonly physicalAppearance: string;
    readonly height: string;
    readonly build: string;
    readonly hair: string;
    readonly eyes: string;
    readonly skin: string;
    readonly clothing: string;
    readonly voice: string;
    readonly speechPatterns: readonly string[];
    readonly personality: string;
    readonly values: readonly string[];
    readonly fears: readonly string[];
    readonly secrets: readonly string[];
    readonly goals: readonly string[];
    readonly motivations: readonly string[];
    readonly relationships: readonly CharacterRelationship[];
    readonly history: string;
    readonly knowledge: readonly string[];
    readonly skills: readonly string[];
    readonly weaknesses: readonly string[];
    readonly characterArc: string;
    readonly importantObjects: readonly string[];
    readonly currentEmotionalState: string;
    readonly currentLocation: string;
    readonly currentInjuries: readonly string[];
}
export type CharacterFieldValue = CharacterProfile[CharacterField];
export interface CharacterFieldVersion<F extends CharacterField = CharacterField> {
    readonly field: F;
    readonly value: CharacterProfile[F];
    readonly effectiveAt: string;
    readonly sequence: number;
    readonly reason: string;
    readonly actor: "author" | "system";
}
export interface CharacterChange {
    readonly field: CharacterField;
    readonly previousValue: CharacterFieldValue;
    readonly nextValue: CharacterFieldValue;
    readonly effectiveAt: string;
    readonly sequence: number;
    readonly reason: string;
    readonly actor: "author" | "system";
}
export interface CharacterRecord {
    readonly formatVersion: typeof CHARACTER_BIBLE_FORMAT_VERSION;
    readonly id: string;
    readonly projectId: string;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly profile: CharacterProfile;
    readonly fieldHistory: Readonly<{
        [F in CharacterField]: readonly CharacterFieldVersion<F>[];
    }>;
}
export type CharacterProfileUpdate = Partial<CharacterProfile>;
export interface CharacterUpdateInput {
    readonly characterId: string;
    readonly changes: CharacterProfileUpdate;
    readonly effectiveAt?: string;
    readonly reason: string;
    readonly actor?: "author" | "system";
}
export declare function createCharacter(input: {
    id: string;
    projectId: string;
    profile: CharacterProfile;
    now?: string;
    reason?: string;
    actor?: "author" | "system";
}): CharacterRecord;
export declare function updateCharacter(character: CharacterRecord, input: CharacterUpdateInput): CharacterRecord;
export declare function getCharacterAt(character: CharacterRecord, asOf: string): CharacterProfile;
export declare function getCharacterFieldHistory<F extends CharacterField>(character: CharacterRecord, field: F): readonly CharacterFieldVersion<F>[];
export declare function getCharacterChanges(character: CharacterRecord): readonly CharacterChange[];
export declare function validateCharacterRecord(value: unknown): CharacterRecord;

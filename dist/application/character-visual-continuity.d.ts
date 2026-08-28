import { type VisualCharacterIdentity, type VisualIdentityPackage, type VisualIdentityState, type VisualIdentityUpdateInput } from "../domain/character-visual-continuity";
export interface VisualIdentityQuery {
    readonly projectId?: string;
    readonly characterId?: string;
    readonly seriesId?: string;
}
export declare class CharacterVisualContinuityService {
    private readonly records;
    create(input: {
        id: string;
        projectId: string;
        characterId: string;
        seriesId: string;
        state: VisualIdentityState;
        now?: string;
    }): VisualCharacterIdentity;
    get(identityId: string): VisualCharacterIdentity | undefined;
    require(identityId: string): VisualCharacterIdentity;
    update(input: VisualIdentityUpdateInput): VisualCharacterIdentity;
    resolve(identityId: string, storyOrder: number): VisualIdentityState;
    generatePackage(identityId: string, storyOrder: number, generatedAt?: string): VisualIdentityPackage;
    list(query?: VisualIdentityQuery): VisualCharacterIdentity[];
    restore(records: readonly VisualCharacterIdentity[]): void;
    restoreProject(projectId: string, records: readonly VisualCharacterIdentity[]): void;
    toPortableState(projectId?: string): readonly VisualCharacterIdentity[];
}

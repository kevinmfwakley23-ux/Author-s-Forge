import { type CharacterDesignLock, type CreateCharacterDesignLockInput, type CreateIllustrationAssetInput, type IllustrationAsset, type IllustrationAssetLibraryState, type UpdateIllustrationAssetInput } from "../domain/illustration-asset-library";
export interface IllustrationAssetQuery {
    readonly projectId?: string;
    readonly bookId?: string;
    readonly chapterId?: string;
    readonly sceneId?: string;
    readonly characterId?: string;
    readonly locationId?: string;
    readonly approvalStatus?: IllustrationAsset["approvalStatus"];
}
export declare class IllustrationAssetLibraryService {
    private readonly assets;
    private readonly locks;
    create(input: CreateIllustrationAssetInput): IllustrationAsset;
    get(id: string): IllustrationAsset | undefined;
    require(id: string): IllustrationAsset;
    update(input: UpdateIllustrationAssetInput): IllustrationAsset;
    reuse(sourceAssetId: string, input: Omit<CreateIllustrationAssetInput, "characterId" | "locationId" | "prompt" | "references" | "style" | "generationSettings" | "version" | "approvalStatus" | "assetUri" | "reusedFromAssetId">): IllustrationAsset;
    list(query?: IllustrationAssetQuery): IllustrationAsset[];
    lockCharacterDesign(input: CreateCharacterDesignLockInput): CharacterDesignLock;
    resolveCharacterDesign(projectId: string, characterId: string, at?: string): IllustrationAsset | undefined;
    listCharacterDesignLocks(projectId?: string): CharacterDesignLock[];
    restore(state: IllustrationAssetLibraryState): void;
    toPortableState(projectId: string): IllustrationAssetLibraryState;
    private state;
    private assertProjectAssetUniqueness;
}

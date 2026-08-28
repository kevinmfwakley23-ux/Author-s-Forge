export declare const ILLUSTRATION_ASSET_LIBRARY_FORMAT_VERSION: 1;
export declare const ILLUSTRATION_APPROVAL_STATUSES: readonly ["draft", "pending", "approved", "rejected"];
export type IllustrationApprovalStatus = typeof ILLUSTRATION_APPROVAL_STATUSES[number];
export interface IllustrationAssetReference {
    readonly id: string;
    readonly uri: string;
    readonly label: string;
    readonly kind: "source" | "character" | "location" | "style" | "pose" | "other";
    readonly notes: string;
}
export type IllustrationGenerationSettingValue = string | number | boolean;
export interface IllustrationAsset {
    readonly formatVersion: typeof ILLUSTRATION_ASSET_LIBRARY_FORMAT_VERSION;
    readonly id: string;
    readonly projectId: string;
    readonly bookId: string;
    readonly chapterId: string;
    readonly sceneId: string;
    readonly characterId: string;
    readonly locationId: string;
    readonly prompt: string;
    readonly references: readonly IllustrationAssetReference[];
    readonly style: string;
    readonly generationSettings: Readonly<Record<string, IllustrationGenerationSettingValue>>;
    readonly version: number;
    readonly date: string;
    readonly approvalStatus: IllustrationApprovalStatus;
    readonly assetUri: string;
    readonly reusedFromAssetId?: string;
    readonly createdAt: string;
    readonly updatedAt: string;
}
export interface CharacterDesignLock {
    readonly id: string;
    readonly projectId: string;
    readonly seriesId: string;
    readonly characterId: string;
    readonly assetId: string;
    readonly effectiveAt: string;
    readonly reason: string;
    readonly createdAt: string;
    readonly active: boolean;
}
export interface IllustrationAssetLibraryState {
    readonly formatVersion: typeof ILLUSTRATION_ASSET_LIBRARY_FORMAT_VERSION;
    readonly projectId: string;
    readonly assets: readonly IllustrationAsset[];
    readonly characterDesignLocks: readonly CharacterDesignLock[];
}
export interface CreateIllustrationAssetInput {
    readonly id: string;
    readonly projectId: string;
    readonly bookId: string;
    readonly chapterId: string;
    readonly sceneId: string;
    readonly characterId: string;
    readonly locationId: string;
    readonly prompt: string;
    readonly references: readonly IllustrationAssetReference[];
    readonly style: string;
    readonly generationSettings: Readonly<Record<string, IllustrationGenerationSettingValue>>;
    readonly version?: number;
    readonly date?: string;
    readonly approvalStatus?: IllustrationApprovalStatus;
    readonly assetUri: string;
    readonly reusedFromAssetId?: string;
    readonly now?: string;
}
export interface UpdateIllustrationAssetInput {
    readonly id: string;
    readonly prompt?: string;
    readonly references?: readonly IllustrationAssetReference[];
    readonly style?: string;
    readonly generationSettings?: Readonly<Record<string, IllustrationGenerationSettingValue>>;
    readonly approvalStatus?: IllustrationApprovalStatus;
    readonly assetUri?: string;
    readonly version?: number;
    readonly date?: string;
    readonly now?: string;
}
export interface CreateCharacterDesignLockInput {
    readonly id: string;
    readonly projectId: string;
    readonly seriesId: string;
    readonly characterId: string;
    readonly assetId: string;
    readonly effectiveAt?: string;
    readonly reason: string;
    readonly createdAt?: string;
}
export declare function createIllustrationAsset(input: CreateIllustrationAssetInput): IllustrationAsset;
export declare function updateIllustrationAsset(asset: IllustrationAsset, input: UpdateIllustrationAssetInput): IllustrationAsset;
export declare function createCharacterDesignLock(input: CreateCharacterDesignLockInput): CharacterDesignLock;
export declare function resolveCharacterDesignLock(state: IllustrationAssetLibraryState, characterId: string, at?: string): CharacterDesignLock | undefined;
export declare function reuseIllustrationAsset(asset: IllustrationAsset, input: {
    readonly id: string;
    readonly projectId: string;
    readonly bookId: string;
    readonly chapterId: string;
    readonly sceneId: string;
    readonly date?: string;
    readonly now?: string;
}): IllustrationAsset;
export declare function validateIllustrationAssetLibraryState(value: unknown): IllustrationAssetLibraryState;

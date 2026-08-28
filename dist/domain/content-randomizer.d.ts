export declare const CONTENT_RANDOMIZER_FORMAT_VERSION: 1;
export interface RandomizerItem {
    readonly id: string;
    readonly category: string;
    readonly content: string;
    readonly tags?: readonly string[];
}
export interface RandomizerSet {
    readonly id: string;
    readonly itemIds: readonly string[];
    readonly categories: readonly string[];
    readonly seed: number;
}
export interface RandomizerRequest {
    readonly sourceItems: readonly RandomizerItem[];
    readonly setCount: number;
    readonly itemsPerSet: number;
    readonly avoidDuplicateItemsAcrossSets?: boolean;
    readonly balanceCategories?: boolean;
    readonly seed?: number;
    readonly previousSets?: readonly RandomizerSet[];
}
export interface RandomizerResult {
    readonly formatVersion: typeof CONTENT_RANDOMIZER_FORMAT_VERSION;
    readonly sets: readonly RandomizerSet[];
    readonly usedItemIds: readonly string[];
    readonly seed: number;
}
export declare function randomizeContent(input: RandomizerRequest): RandomizerResult;
export declare function validateRandomizerResult(result: RandomizerResult): RandomizerResult;

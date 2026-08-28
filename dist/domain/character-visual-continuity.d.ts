export declare const VISUAL_IDENTITY_FORMAT_VERSION: 1;
export declare const VISUAL_REFERENCE_KINDS: readonly ["face", "body", "wardrobe", "hairstyle", "pose"];
export type VisualReferenceKind = typeof VISUAL_REFERENCE_KINDS[number];
export interface VisualReference {
    readonly id: string;
    readonly kind: VisualReferenceKind;
    readonly uri: string;
    readonly label: string;
    readonly notes: string;
}
export interface VisualIdentityState {
    readonly distinguishingMarks: readonly string[];
    readonly scars: readonly string[];
    readonly tattoos: readonly string[];
    readonly accessories: readonly string[];
    readonly colorPalette: readonly string[];
    readonly artisticStyle: string;
    readonly wardrobe: readonly string[];
    readonly hairstyle: string;
    readonly age: number;
    readonly faceReferences: readonly VisualReference[];
    readonly bodyReferences: readonly VisualReference[];
    readonly poseReferences: readonly VisualReference[];
}
export interface VisualIdentitySnapshot extends VisualIdentityState {
    readonly storyOrder: number;
    readonly effectiveAt: string;
    readonly sequence: number;
    readonly reason: string;
    readonly actor: "author" | "system";
}
export interface VisualCharacterIdentity {
    readonly formatVersion: typeof VISUAL_IDENTITY_FORMAT_VERSION;
    readonly id: string;
    readonly projectId: string;
    readonly characterId: string;
    readonly seriesId: string;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly base: VisualIdentityState;
    readonly snapshots: readonly VisualIdentitySnapshot[];
}
export interface VisualIdentityUpdateInput {
    readonly identityId: string;
    readonly state: Partial<VisualIdentityState>;
    readonly storyOrder: number;
    readonly effectiveAt?: string;
    readonly reason: string;
    readonly actor?: "author" | "system";
}
export interface VisualIdentityPackage {
    readonly packageVersion: typeof VISUAL_IDENTITY_FORMAT_VERSION;
    readonly identityId: string;
    readonly projectId: string;
    readonly characterId: string;
    readonly seriesId: string;
    readonly generatedAt: string;
    readonly storyOrder: number;
    readonly identity: VisualIdentityState;
    readonly references: readonly VisualReference[];
    readonly continuity: readonly VisualIdentitySnapshot[];
}
export declare function createVisualCharacterIdentity(input: {
    id: string;
    projectId: string;
    characterId: string;
    seriesId: string;
    state: VisualIdentityState;
    now?: string;
}): VisualCharacterIdentity;
export declare function updateVisualCharacterIdentity(identity: VisualCharacterIdentity, input: VisualIdentityUpdateInput): VisualCharacterIdentity;
export declare function resolveVisualCharacterIdentity(identity: VisualCharacterIdentity, storyOrder: number): VisualIdentityState;
export declare function generateVisualCharacterIdentityPackage(identity: VisualCharacterIdentity, storyOrder: number, generatedAt?: string): VisualIdentityPackage;
export declare function validateVisualCharacterIdentity(value: unknown): VisualCharacterIdentity;

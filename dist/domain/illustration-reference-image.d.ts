export declare const ILLUSTRATION_REFERENCE_IMAGE_FORMAT_VERSION: 1;
export declare const ILLUSTRATION_REFERENCE_IMAGE_MIME_TYPES: readonly ["image/png", "image/jpeg", "image/webp"];
export type IllustrationReferenceImageMimeType = typeof ILLUSTRATION_REFERENCE_IMAGE_MIME_TYPES[number];
export interface IllustrationReferenceImage {
    readonly formatVersion: typeof ILLUSTRATION_REFERENCE_IMAGE_FORMAT_VERSION;
    readonly id: string;
    readonly projectId: string;
    readonly originalFileName: string;
    readonly mimeType: IllustrationReferenceImageMimeType;
    readonly byteLength: number;
    readonly assetUri: string;
    readonly createdAt: string;
    readonly updatedAt: string;
}
export interface CreateIllustrationReferenceImageInput {
    readonly id: string;
    readonly projectId: string;
    readonly originalFileName: string;
    readonly mimeType: IllustrationReferenceImageMimeType;
    readonly byteLength: number;
    readonly assetUri: string;
    readonly now?: string;
}
export declare const MAX_ILLUSTRATION_REFERENCE_IMAGE_BYTES: number;
export declare function createIllustrationReferenceImage(input: CreateIllustrationReferenceImageInput): IllustrationReferenceImage;
export declare function validateIllustrationReferenceImage(value: unknown): IllustrationReferenceImage;

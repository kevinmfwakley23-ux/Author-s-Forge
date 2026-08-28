import { type IllustrationReferenceImage, type IllustrationReferenceImageMimeType } from "../domain/illustration-reference-image";
export interface IllustrationReferenceUpload {
    readonly id?: string;
    readonly projectId: string;
    readonly originalFileName: string;
    readonly mimeType: IllustrationReferenceImageMimeType;
    readonly bytes: Uint8Array;
    readonly assetUri: string;
}
export interface IllustrationEditRequest {
    readonly prompt: string;
    readonly reference: IllustrationReferenceImage;
    readonly referenceBytes: Uint8Array;
    readonly size: "1024x1024" | "1024x1536" | "1536x1024";
    readonly quality: "low" | "medium" | "high";
    readonly model?: string;
}
export interface IllustrationEditResult {
    readonly id: string;
    readonly provider: "openai";
    readonly model: string;
    readonly b64Json: string;
}
export declare class IllustrationReferencePipeline {
    createReference(input: IllustrationReferenceUpload, now?: string): IllustrationReferenceImage;
    editWithOpenAi(input: IllustrationEditRequest, apiKey: string): Promise<IllustrationEditResult>;
}

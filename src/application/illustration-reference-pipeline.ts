import { randomUUID } from "node:crypto";
import { createIllustrationReferenceImage, type IllustrationReferenceImage, type IllustrationReferenceImageMimeType } from "../domain/illustration-reference-image";

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

export class IllustrationReferencePipeline {
  createReference(input: IllustrationReferenceUpload, now?: string): IllustrationReferenceImage {
    return createIllustrationReferenceImage({
      id: input.id ?? `reference-${randomUUID()}`,
      projectId: input.projectId,
      originalFileName: input.originalFileName,
      mimeType: input.mimeType,
      byteLength: input.bytes.byteLength,
      assetUri: input.assetUri,
      now,
    });
  }

  async editWithOpenAi(input: IllustrationEditRequest, apiKey: string): Promise<IllustrationEditResult> {
    const key = apiKey.trim();
    if (!key) throw new Error("OPENAI_API_KEY is required for reference-image editing.");
    const prompt = input.prompt.trim();
    if (!prompt) throw new Error("Image edit prompt is required.");

    const form = new FormData();
    form.append("model", input.model?.trim() || "gpt-image-1");
    form.append("prompt", prompt);
    form.append("size", input.size);
    form.append("quality", input.quality);
    form.append("output_format", "png");
    form.append("image", new Blob([input.referenceBytes], { type: input.reference.mimeType }), input.reference.originalFileName);

    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { authorization: `Bearer ${key}` },
      body: form,
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      const providerError = payload.error;
      const message = providerError && typeof providerError === "object"
        ? String((providerError as Record<string, unknown>).message ?? `Image edit failed (${response.status}).`)
        : `Image edit failed (${response.status}).`;
      throw new Error(message);
    }
    const first = Array.isArray(payload.data) ? payload.data[0] as Record<string, unknown> | undefined : undefined;
    if (!first || typeof first.b64_json !== "string") throw new Error("Image edit provider returned no PNG data.");

    return {
      id: `image-${randomUUID()}`,
      provider: "openai",
      model: input.model?.trim() || "gpt-image-1",
      b64Json: first.b64_json,
    };
  }
}

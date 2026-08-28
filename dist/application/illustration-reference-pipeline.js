"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IllustrationReferencePipeline = void 0;
const node_crypto_1 = require("node:crypto");
const illustration_reference_image_1 = require("../domain/illustration-reference-image");
class IllustrationReferencePipeline {
    createReference(input, now) {
        return (0, illustration_reference_image_1.createIllustrationReferenceImage)({
            id: input.id ?? `reference-${(0, node_crypto_1.randomUUID)()}`,
            projectId: input.projectId,
            originalFileName: input.originalFileName,
            mimeType: input.mimeType,
            byteLength: input.bytes.byteLength,
            assetUri: input.assetUri,
            now,
        });
    }
    async editWithOpenAi(input, apiKey) {
        const key = apiKey.trim();
        if (!key)
            throw new Error("OPENAI_API_KEY is required for reference-image editing.");
        const prompt = input.prompt.trim();
        if (!prompt)
            throw new Error("Image edit prompt is required.");
        const form = new FormData();
        const model = input.model?.trim() || "gpt-image-1";
        form.append("model", model);
        form.append("prompt", prompt);
        form.append("size", input.size);
        form.append("quality", input.quality);
        form.append("output_format", "png");
        const imageBuffer = new ArrayBuffer(input.referenceBytes.byteLength);
        new Uint8Array(imageBuffer).set(input.referenceBytes);
        form.append("image", new Blob([imageBuffer], { type: input.reference.mimeType }), input.reference.originalFileName);
        const response = await fetch("https://api.openai.com/v1/images/edits", {
            method: "POST",
            headers: { authorization: `Bearer ${key}` },
            body: form,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            const providerError = payload.error;
            const message = providerError && typeof providerError === "object"
                ? String(providerError.message ?? `Image edit failed (${response.status}).`)
                : `Image edit failed (${response.status}).`;
            throw new Error(message);
        }
        const first = Array.isArray(payload.data) ? payload.data[0] : undefined;
        if (!first || typeof first.b64_json !== "string")
            throw new Error("Image edit provider returned no PNG data.");
        return { id: `image-${(0, node_crypto_1.randomUUID)()}`, provider: "openai", model, b64Json: first.b64_json };
    }
}
exports.IllustrationReferencePipeline = IllustrationReferencePipeline;
//# sourceMappingURL=illustration-reference-pipeline.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_ILLUSTRATION_REFERENCE_IMAGE_BYTES = exports.ILLUSTRATION_REFERENCE_IMAGE_MIME_TYPES = exports.ILLUSTRATION_REFERENCE_IMAGE_FORMAT_VERSION = void 0;
exports.createIllustrationReferenceImage = createIllustrationReferenceImage;
exports.validateIllustrationReferenceImage = validateIllustrationReferenceImage;
exports.ILLUSTRATION_REFERENCE_IMAGE_FORMAT_VERSION = 1;
exports.ILLUSTRATION_REFERENCE_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];
exports.MAX_ILLUSTRATION_REFERENCE_IMAGE_BYTES = 5 * 1024 * 1024;
function createIllustrationReferenceImage(input) {
    const now = timestamp(input.now ?? new Date().toISOString());
    return {
        formatVersion: exports.ILLUSTRATION_REFERENCE_IMAGE_FORMAT_VERSION,
        id: identifier(input.id, "Reference image id"),
        projectId: identifier(input.projectId, "Reference image project id"),
        originalFileName: text(input.originalFileName, "Reference image file name"),
        mimeType: mime(input.mimeType),
        byteLength: positiveBytes(input.byteLength),
        assetUri: text(input.assetUri, "Reference image asset URI"),
        createdAt: now,
        updatedAt: now,
    };
}
function validateIllustrationReferenceImage(value) {
    if (!value || typeof value !== "object")
        throw new Error("Invalid illustration reference image.");
    const item = value;
    return createIllustrationReferenceImage({
        id: String(item.id),
        projectId: String(item.projectId),
        originalFileName: String(item.originalFileName),
        mimeType: item.mimeType,
        byteLength: Number(item.byteLength),
        assetUri: String(item.assetUri),
        now: String(item.createdAt),
    });
}
function identifier(value, label) {
    if (!value.trim() || value !== value.trim())
        throw new Error(`${label} is required and cannot have surrounding whitespace.`);
    return value;
}
function text(value, label) {
    if (!value.trim())
        throw new Error(`${label} is required.`);
    return value.trim();
}
function mime(value) {
    if (!exports.ILLUSTRATION_REFERENCE_IMAGE_MIME_TYPES.includes(value))
        throw new Error("Unsupported reference image type.");
    return value;
}
function positiveBytes(value) {
    if (!Number.isInteger(value) || value < 1)
        throw new Error("Reference image byte length must be a positive integer.");
    if (value > exports.MAX_ILLUSTRATION_REFERENCE_IMAGE_BYTES)
        throw new Error("Reference image exceeds the 5 MiB limit.");
    return value;
}
function timestamp(value) {
    if (Number.isNaN(Date.parse(value)))
        throw new Error("Reference image timestamp must be valid.");
    return new Date(value).toISOString();
}
//# sourceMappingURL=illustration-reference-image.js.map
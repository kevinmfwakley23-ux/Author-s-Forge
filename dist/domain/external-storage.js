"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryStorageProvider = exports.EXTERNAL_STORAGE_FORMAT_VERSION = void 0;
exports.createProjectStorageBinding = createProjectStorageBinding;
exports.validateProjectStorageBinding = validateProjectStorageBinding;
exports.createDownloadableProjectPackageFilename = createDownloadableProjectPackageFilename;
exports.EXTERNAL_STORAGE_FORMAT_VERSION = 1;
const text = (v, label) => { if (typeof v !== "string" || !v.trim())
    throw new Error(`${label} is required.`); return v.trim(); };
function createProjectStorageBinding(input) { return { formatVersion: exports.EXTERNAL_STORAGE_FORMAT_VERSION, projectId: text(input.projectId, "Project id"), providerId: input.providerId, keyPrefix: (input.keyPrefix ?? `projects/${input.projectId}`).replace(/^\/|\/$/g, ""), sourceOfTruth: "forge-project" }; }
function validateProjectStorageBinding(binding) { if (binding.formatVersion !== exports.EXTERNAL_STORAGE_FORMAT_VERSION)
    throw new Error("Unsupported external storage binding version."); text(binding.projectId, "Project id"); text(binding.keyPrefix, "Storage key prefix"); if (binding.sourceOfTruth !== "forge-project")
    throw new Error("Forge project must remain the source of truth."); return { ...binding }; }
function createDownloadableProjectPackageFilename(projectId) { return `${text(projectId, "Project id")}.forge-project.json`; }
class MemoryStorageProvider {
    id = "download";
    objects = new Map();
    async put(key, content, mediaType) { const value = { bytes: new Uint8Array(content), mediaType: text(mediaType, "Media type"), updatedAt: new Date().toISOString() }; this.objects.set(text(key, "Storage key"), value); return { key, size: value.bytes.byteLength, mediaType: value.mediaType, updatedAt: value.updatedAt }; }
    async get(key) { const value = this.objects.get(text(key, "Storage key")); if (!value)
        throw new Error(`Storage object "${key}" was not found.`); return new Uint8Array(value.bytes); }
    async delete(key) { this.objects.delete(text(key, "Storage key")); }
    async list(prefix = "") { return [...this.objects.entries()].filter(([key]) => key.startsWith(prefix)).map(([key, v]) => ({ key, size: v.bytes.byteLength, mediaType: v.mediaType, updatedAt: v.updatedAt })); }
}
exports.MemoryStorageProvider = MemoryStorageProvider;
//# sourceMappingURL=external-storage.js.map
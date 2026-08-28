"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROJECT_PACKAGE_NAME = exports.PROJECT_PACKAGE_FORMAT_VERSION = void 0;
exports.createProjectPackage = createProjectPackage;
exports.validateProjectPackage = validateProjectPackage;
exports.serializeProjectPackage = serializeProjectPackage;
exports.deserializeProjectPackage = deserializeProjectPackage;
exports.PROJECT_PACKAGE_FORMAT_VERSION = 1;
exports.PROJECT_PACKAGE_NAME = "AUTHOR'S FORGE PROJECT";
const text = (v, label) => { if (typeof v !== "string" || !v.trim())
    throw new Error(`${label} is required.`); return v.trim(); };
function createProjectPackage(input) { const projectId = text(input.projectId, "Project id"); const files = (input.files ?? []).map(validatePackageFile); const seen = new Set(); for (const f of files) {
    if (seen.has(f.path))
        throw new Error(`Duplicate package path "${f.path}".`);
    seen.add(f.path);
} return { manifest: { formatVersion: exports.PROJECT_PACKAGE_FORMAT_VERSION, packageName: exports.PROJECT_PACKAGE_NAME, projectId, exportedAt: input.exportedAt ?? new Date().toISOString(), paths: files.map(f => f.path) }, projectState: JSON.parse(JSON.stringify(input.projectState)), files: files.map(f => ({ ...f })) }; }
function validateProjectPackage(pkg) { if (pkg.manifest.formatVersion !== exports.PROJECT_PACKAGE_FORMAT_VERSION)
    throw new Error("Unsupported project package format version."); text(pkg.manifest.projectId, "Package project id"); if (!Number.isFinite(Date.parse(pkg.manifest.exportedAt)))
    throw new Error("Package exportedAt must be an ISO timestamp."); if (!Array.isArray(pkg.manifest.paths) || !Array.isArray(pkg.files))
    throw new Error("Project package manifest and files must be arrays."); const validated = pkg.files.map(validatePackageFile); const paths = validated.map(f => f.path); if (JSON.stringify(paths) !== JSON.stringify(pkg.manifest.paths))
    throw new Error("Package manifest paths do not match package files."); return JSON.parse(JSON.stringify({ ...pkg, manifest: { ...pkg.manifest, paths: [...paths] }, files: validated })); }
function validatePackageFile(file) { const path = text(file.path, "Package file path"); if (path.startsWith("/") || path.split("/").includes(".."))
    throw new Error("Package file paths must be relative and traversal-safe."); if (typeof file.content !== "string")
    throw new Error("Package file content is required."); if (file.encoding !== "utf8" && file.encoding !== "base64")
    throw new Error("Package file encoding must be utf8 or base64."); if (file.encoding === "base64" && !/^[A-Za-z0-9+/]*={0,2}$/.test(file.content))
    throw new Error(`Package file "${path}" contains invalid base64 content.`); return { path, content: file.content, encoding: file.encoding, mediaType: text(file.mediaType, "Package media type"), sha256: text(file.sha256, "Package file sha256") }; }
function serializeProjectPackage(pkg) { return JSON.stringify(validateProjectPackage(pkg), null, 2); }
function deserializeProjectPackage(serialized) { try {
    return validateProjectPackage(JSON.parse(serialized));
}
catch (error) {
    throw new Error(`Invalid Forge project package: ${error instanceof Error ? error.message : "unknown error"}`);
} }
//# sourceMappingURL=project-package.js.map
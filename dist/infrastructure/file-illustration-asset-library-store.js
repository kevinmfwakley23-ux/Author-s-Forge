"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileIllustrationAssetLibraryStore = void 0;
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const illustration_asset_library_1 = require("../domain/illustration-asset-library");
class FileIllustrationAssetLibraryStore {
    rootDirectory;
    constructor(rootDirectory) {
        this.rootDirectory = rootDirectory;
    }
    async save(state) { const validated = (0, illustration_asset_library_1.validateIllustrationAssetLibraryState)(state); const path = this.path(validated.projectId); await (0, promises_1.mkdir)((0, node_path_1.dirname)(path), { recursive: true }); const temporaryPath = `${path}.tmp`; await (0, promises_1.writeFile)(temporaryPath, `${JSON.stringify(validated, null, 2)}\n`, "utf8"); await (0, promises_1.rename)(temporaryPath, path); }
    async load(projectId) { this.assertProjectId(projectId); try {
        const parsed = JSON.parse(await (0, promises_1.readFile)(this.path(projectId), "utf8"));
        return (0, illustration_asset_library_1.validateIllustrationAssetLibraryState)(parsed);
    }
    catch (error) {
        if (isMissingFile(error))
            return null;
        throw error;
    } }
    async exists(projectId) { this.assertProjectId(projectId); try {
        await (0, promises_1.access)(this.path(projectId));
        return true;
    }
    catch (error) {
        if (isMissingFile(error))
            return false;
        throw error;
    } }
    path(projectId) { this.assertProjectId(projectId); return (0, node_path_1.join)(this.rootDirectory, "projects", projectId, "illustration-assets.json"); }
    assertProjectId(projectId) { if (!/^[a-zA-Z0-9_-]+$/.test(projectId))
        throw new Error("Project id contains unsupported path characters."); }
}
exports.FileIllustrationAssetLibraryStore = FileIllustrationAssetLibraryStore;
function isMissingFile(error) { return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT"; }
//# sourceMappingURL=file-illustration-asset-library-store.js.map
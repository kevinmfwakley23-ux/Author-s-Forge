"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalFileStorageProvider = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
class LocalFileStorageProvider {
    rootDirectory;
    id = "local";
    constructor(rootDirectory) {
        this.rootDirectory = rootDirectory;
        this.rootDirectory = (0, node_path_1.resolve)(rootDirectory);
    }
    pathFor(key) { const normalized = key.replaceAll("\\", "/").replace(/^\/+/, ""); if (normalized.split("/").includes(".."))
        throw new Error("Storage keys must not contain parent traversal."); const path = (0, node_path_1.resolve)(this.rootDirectory, normalized); if (path !== this.rootDirectory && !path.startsWith(`${this.rootDirectory}/`))
        throw new Error("Storage key escapes provider root."); return path; }
    async put(key, content, mediaType) { const path = this.pathFor(key); await node_fs_1.promises.mkdir((0, node_path_1.dirname)(path), { recursive: true }); await node_fs_1.promises.writeFile(path, content); const stat = await node_fs_1.promises.stat(path); return { key, size: stat.size, mediaType, updatedAt: stat.mtime.toISOString() }; }
    async get(key) { return new Uint8Array(await node_fs_1.promises.readFile(this.pathFor(key))); }
    async delete(key) { await node_fs_1.promises.rm(this.pathFor(key), { force: true }); }
    async list(prefix = "") { const root = this.pathFor(prefix); const result = []; const walk = async (dir) => { let entries; try {
        entries = await node_fs_1.promises.readdir(dir, { withFileTypes: true });
    }
    catch (error) {
        if (error.code === "ENOENT")
            return;
        throw error;
    } for (const entry of entries) {
        const full = (0, node_path_1.join)(dir, entry.name);
        if (entry.isDirectory())
            await walk(full);
        else {
            const stat = await node_fs_1.promises.stat(full);
            const key = full.slice(this.rootDirectory.length + 1).split("\\").join("/");
            result.push({ key, size: stat.size, mediaType: "application/octet-stream", updatedAt: stat.mtime.toISOString() });
        }
    } }; await walk(root); return result; }
}
exports.LocalFileStorageProvider = LocalFileStorageProvider;
//# sourceMappingURL=local-storage-provider.js.map
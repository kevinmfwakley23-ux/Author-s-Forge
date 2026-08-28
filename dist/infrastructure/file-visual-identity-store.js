"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileVisualIdentityStore = void 0;
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const character_visual_continuity_1 = require("../domain/character-visual-continuity");
class FileVisualIdentityStore {
    rootDirectory;
    constructor(rootDirectory) {
        this.rootDirectory = rootDirectory;
    }
    async save(projectId, identities) {
        this.assertProjectId(projectId);
        const validated = this.validateCollection(projectId, identities);
        const path = this.identityPath(projectId);
        await (0, promises_1.mkdir)((0, node_path_1.dirname)(path), { recursive: true });
        const temporaryPath = `${path}.tmp`;
        await (0, promises_1.writeFile)(temporaryPath, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
        await (0, promises_1.rename)(temporaryPath, path);
    }
    async load(projectId) {
        this.assertProjectId(projectId);
        try {
            const raw = await (0, promises_1.readFile)(this.identityPath(projectId), "utf8");
            const parsed = JSON.parse(raw);
            return this.validateCollection(projectId, parsed);
        }
        catch (error) {
            if (isMissingFile(error))
                return [];
            throw error;
        }
    }
    async exists(projectId) {
        this.assertProjectId(projectId);
        try {
            await (0, promises_1.access)(this.identityPath(projectId));
            return true;
        }
        catch (error) {
            if (isMissingFile(error))
                return false;
            throw error;
        }
    }
    validateCollection(projectId, value) {
        if (!Array.isArray(value))
            throw new Error("Visual identity package must contain an array.");
        const ids = new Set();
        const characters = new Set();
        const identities = value.map((item) => (0, character_visual_continuity_1.validateVisualCharacterIdentity)(item));
        for (const identity of identities) {
            if (identity.projectId !== projectId)
                throw new Error("Visual identity state contains an identity from another project.");
            if (ids.has(identity.id))
                throw new Error(`Duplicate visual identity id "${identity.id}".`);
            if (characters.has(identity.characterId))
                throw new Error(`Duplicate visual identity for character "${identity.characterId}".`);
            ids.add(identity.id);
            characters.add(identity.characterId);
        }
        return identities;
    }
    identityPath(projectId) { return (0, node_path_1.join)(this.rootDirectory, "projects", projectId, "visual-identities.json"); }
    assertProjectId(projectId) { if (!/^[a-zA-Z0-9_-]+$/.test(projectId))
        throw new Error("Project id contains unsupported path characters."); }
}
exports.FileVisualIdentityStore = FileVisualIdentityStore;
function isMissingFile(error) { return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT"; }
//# sourceMappingURL=file-visual-identity-store.js.map
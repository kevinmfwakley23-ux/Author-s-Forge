"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IllustrationAssetLibraryService = void 0;
const illustration_asset_library_1 = require("../domain/illustration-asset-library");
class IllustrationAssetLibraryService {
    assets = new Map();
    locks = new Map();
    create(input) { const asset = (0, illustration_asset_library_1.createIllustrationAsset)(input); if (this.assets.has(asset.id))
        throw new Error(`Duplicate illustration asset id \"${asset.id}\".`); this.assertProjectAssetUniqueness(asset); this.assets.set(asset.id, asset); return cloneAsset(asset); }
    get(id) { const asset = this.assets.get(id); return asset ? cloneAsset(asset) : undefined; }
    require(id) { const asset = this.assets.get(id); if (!asset)
        throw new Error(`Illustration asset \"${id}\" not found.`); return cloneAsset(asset); }
    update(input) { const existing = this.assets.get(input.id); if (!existing)
        throw new Error(`Illustration asset \"${input.id}\" not found.`); const updated = (0, illustration_asset_library_1.updateIllustrationAsset)(existing, input); this.assets.set(updated.id, updated); return cloneAsset(updated); }
    reuse(sourceAssetId, input) { const source = this.require(sourceAssetId); const asset = (0, illustration_asset_library_1.reuseIllustrationAsset)(source, input); if (this.assets.has(asset.id))
        throw new Error(`Duplicate illustration asset id \"${asset.id}\".`); this.assertProjectAssetUniqueness(asset); this.assets.set(asset.id, asset); return cloneAsset(asset); }
    list(query = {}) { return [...this.assets.values()].filter((asset) => (query.projectId === undefined || asset.projectId === query.projectId) && (query.bookId === undefined || asset.bookId === query.bookId) && (query.chapterId === undefined || asset.chapterId === query.chapterId) && (query.sceneId === undefined || asset.sceneId === query.sceneId) && (query.characterId === undefined || asset.characterId === query.characterId) && (query.locationId === undefined || asset.locationId === query.locationId) && (query.approvalStatus === undefined || asset.approvalStatus === query.approvalStatus)).sort((a, b) => a.id.localeCompare(b.id)).map(cloneAsset); }
    lockCharacterDesign(input) { const lock = (0, illustration_asset_library_1.createCharacterDesignLock)(input); if (!this.assets.has(lock.assetId))
        throw new Error(`Character design lock references missing asset \"${lock.assetId}\".`); const asset = this.assets.get(lock.assetId); if (asset.projectId !== lock.projectId || asset.characterId !== lock.characterId)
        throw new Error("Character design lock must reference an asset for the same project and character."); if (this.locks.has(lock.id))
        throw new Error(`Duplicate character design lock id \"${lock.id}\".`); this.locks.set(lock.id, lock); return cloneLock(lock); }
    resolveCharacterDesign(projectId, characterId, at) { const lock = (0, illustration_asset_library_1.resolveCharacterDesignLock)(this.state(projectId), characterId, at); return lock ? this.get(lock.assetId) : undefined; }
    listCharacterDesignLocks(projectId) { return [...this.locks.values()].filter((lock) => projectId === undefined || lock.projectId === projectId).sort((a, b) => a.effectiveAt.localeCompare(b.effectiveAt) || a.id.localeCompare(b.id)).map(cloneLock); }
    restore(state) { const validated = (0, illustration_asset_library_1.validateIllustrationAssetLibraryState)(state); this.assets.clear(); this.locks.clear(); for (const asset of validated.assets)
        this.assets.set(asset.id, cloneAsset(asset)); for (const lock of validated.characterDesignLocks)
        this.locks.set(lock.id, cloneLock(lock)); }
    toPortableState(projectId) { return this.state(projectId); }
    state(projectId) { const assets = this.list({ projectId }); const characterDesignLocks = this.listCharacterDesignLocks(projectId); return (0, illustration_asset_library_1.validateIllustrationAssetLibraryState)({ formatVersion: 1, projectId, assets, characterDesignLocks }); }
    assertProjectAssetUniqueness(asset) { if ([...this.assets.values()].some((existing) => existing.projectId === asset.projectId && existing.assetUri === asset.assetUri && existing.version === asset.version))
        throw new Error(`Illustration asset version ${asset.version} already exists for URI \"${asset.assetUri}\".`); }
}
exports.IllustrationAssetLibraryService = IllustrationAssetLibraryService;
function cloneAsset(asset) { return { ...asset, references: asset.references.map((ref) => ({ ...ref })), generationSettings: { ...asset.generationSettings } }; }
function cloneLock(lock) { return { ...lock }; }
//# sourceMappingURL=illustration-asset-library.js.map
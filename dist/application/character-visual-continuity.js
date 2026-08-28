"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CharacterVisualContinuityService = void 0;
const character_visual_continuity_1 = require("../domain/character-visual-continuity");
class CharacterVisualContinuityService {
    records = new Map();
    create(input) {
        const identity = (0, character_visual_continuity_1.createVisualCharacterIdentity)(input);
        if (this.records.has(identity.id))
            throw new Error(`Duplicate visual identity id "${identity.id}".`);
        if ([...this.records.values()].some((item) => item.projectId === identity.projectId && item.characterId === identity.characterId))
            throw new Error(`Visual identity already exists for character "${identity.characterId}".`);
        this.records.set(identity.id, identity);
        return clone(identity);
    }
    get(identityId) { const value = this.records.get(identityId); return value ? clone(value) : undefined; }
    require(identityId) { const value = this.records.get(identityId); if (!value)
        throw new Error(`Visual identity "${identityId}" not found.`); return clone(value); }
    update(input) { const existing = this.records.get(input.identityId); if (!existing)
        throw new Error(`Visual identity "${input.identityId}" not found.`); const updated = (0, character_visual_continuity_1.updateVisualCharacterIdentity)(existing, input); this.records.set(updated.id, updated); return clone(updated); }
    resolve(identityId, storyOrder) { return (0, character_visual_continuity_1.resolveVisualCharacterIdentity)(this.require(identityId), storyOrder); }
    generatePackage(identityId, storyOrder, generatedAt) { return (0, character_visual_continuity_1.generateVisualCharacterIdentityPackage)(this.require(identityId), storyOrder, generatedAt); }
    list(query = {}) { return [...this.records.values()].filter((item) => (query.projectId === undefined || item.projectId === query.projectId) && (query.characterId === undefined || item.characterId === query.characterId) && (query.seriesId === undefined || item.seriesId === query.seriesId)).sort((a, b) => a.id.localeCompare(b.id)).map(clone); }
    restore(records) { this.records.clear(); for (const record of records) {
        const identity = (0, character_visual_continuity_1.validateVisualCharacterIdentity)(record);
        if (this.records.has(identity.id))
            throw new Error(`Duplicate visual identity id "${identity.id}".`);
        if ([...this.records.values()].some((item) => item.projectId === identity.projectId && item.characterId === identity.characterId))
            throw new Error(`Visual identity already exists for character "${identity.characterId}".`);
        this.records.set(identity.id, clone(identity));
    } }
    restoreProject(projectId, records) { if (!projectId.trim())
        throw new Error("Project id is required."); if (records.some((record) => record.projectId !== projectId))
        throw new Error("Visual identity state contains an identity from another project."); this.restore(records); }
    toPortableState(projectId) { return this.list({ projectId }); }
}
exports.CharacterVisualContinuityService = CharacterVisualContinuityService;
function clone(identity) { return (0, character_visual_continuity_1.validateVisualCharacterIdentity)(JSON.parse(JSON.stringify(identity))); }
//# sourceMappingURL=character-visual-continuity.js.map
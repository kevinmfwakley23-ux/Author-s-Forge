"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectMemoryStore = void 0;
const memory_1 = require("../domain/memory");
class ProjectMemoryStore {
    records = new Map();
    register(memory) {
        if (this.records.has(memory.id))
            throw new Error(`Duplicate memory id "${memory.id}".`);
        this.records.set(memory.id, cloneMemory(memory));
    }
    get(memoryId) {
        const memory = this.records.get(memoryId);
        return memory ? cloneMemory(memory) : undefined;
    }
    list() {
        return [...this.records.values()].sort((a, b) => a.id.localeCompare(b.id)).map(cloneMemory);
    }
    query(query = {}) {
        if (query.limit !== undefined && (!Number.isInteger(query.limit) || query.limit < 0))
            throw new Error("Memory query limit must be a non-negative integer.");
        if (query.changedSince !== undefined && Number.isNaN(Date.parse(query.changedSince)))
            throw new Error("Memory changedSince must be a valid timestamp.");
        return this.list().filter((memory) => {
            if (query.projectId && memory.projectId !== query.projectId)
                return false;
            if (query.class && memory.class !== query.class)
                return false;
            if (query.authority && memory.authority !== query.authority)
                return false;
            if (query.authoritativeOnly && memory.authority !== "authoritative")
                return false;
            if (query.relatedMemoryId && !memory.relatedMemoryIds.includes(query.relatedMemoryId))
                return false;
            if (query.relevanceTags && !query.relevanceTags.every((tag) => memory.relevanceTags.includes(tag)))
                return false;
            if (query.changedSince && memory.updatedAt <= query.changedSince)
                return false;
            return true;
        }).slice(0, query.limit ?? Number.MAX_SAFE_INTEGER);
    }
    promote(memoryId, actor, reason) {
        if (!reason.trim())
            throw new Error("Promotion reason is required.");
        const existing = this.records.get(memoryId);
        if (!existing)
            throw new Error(`Memory "${memoryId}" not found.`);
        if (existing.authority === "authoritative")
            return { memoryId, from: existing.authority, to: existing.authority, actor, reason: reason.trim() };
        if (existing.provenance.length === 0)
            throw new Error(`Memory "${memoryId}" cannot be promoted without provenance.`);
        if (actor !== "author")
            throw new Error(`Memory "${memoryId}" requires author authority for promotion.`);
        if (!isPromotableAuthority(existing.authority))
            throw new Error(`Memory "${memoryId}" cannot be promoted from ${existing.authority}.`);
        const promoted = { ...existing, authority: "authoritative", updatedAt: new Date().toISOString() };
        this.records.set(memoryId, cloneMemory(promoted));
        return { memoryId, from: existing.authority, to: promoted.authority, actor, reason: reason.trim() };
    }
    supersede(memoryId, replacementId, now = new Date().toISOString()) {
        const existing = this.records.get(memoryId);
        if (!existing)
            throw new Error(`Memory "${memoryId}" not found.`);
        const replacement = this.records.get(replacementId);
        if (!replacement)
            throw new Error(`Replacement memory "${replacementId}" not found.`);
        if (existing.projectId !== replacement.projectId)
            throw new Error("Superseding memory must belong to the same project.");
        if (memoryId === replacementId)
            throw new Error("Memory cannot supersede itself.");
        const superseded = { ...existing, authority: "superseded", supersededBy: replacementId, updatedAt: now };
        this.records.set(memoryId, cloneMemory(superseded));
        const linkedReplacement = { ...replacement, supersedes: replacement.supersedes ?? memoryId, updatedAt: replacement.updatedAt };
        this.records.set(replacementId, cloneMemory(linkedReplacement));
        return cloneMemory(superseded);
    }
    toPortableState() { return this.list(); }
    createSnapshot(projectId) {
        if (!projectId.trim())
            throw new Error("Project id is required for memory snapshot.");
        return { formatVersion: memory_1.MEMORY_FORMAT_VERSION, projectId, memories: this.query({ projectId }) };
    }
    restore(records) {
        this.records.clear();
        for (const record of records)
            this.register(record);
    }
    restoreSnapshot(snapshot) {
        if (snapshot.formatVersion !== memory_1.MEMORY_FORMAT_VERSION)
            throw new Error("Unsupported memory snapshot format.");
        if (!snapshot.projectId.trim())
            throw new Error("Memory snapshot project id is required.");
        if (snapshot.memories.some((memory) => memory.projectId !== snapshot.projectId))
            throw new Error("Memory snapshot contains records from another project.");
        this.restore(snapshot.memories);
    }
}
exports.ProjectMemoryStore = ProjectMemoryStore;
function cloneMemory(memory) {
    return { ...memory, provenance: memory.provenance.map((item) => ({ ...item })), relatedMemoryIds: [...memory.relatedMemoryIds], relevanceTags: [...memory.relevanceTags] };
}
function isPromotableAuthority(authority) {
    return authority === "proposed" || authority === "working" || authority === "verified";
}
//# sourceMappingURL=project-memory-store.js.map
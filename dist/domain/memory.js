"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MEMORY_FORMAT_VERSION = void 0;
exports.createMemoryRecord = createMemoryRecord;
exports.MEMORY_FORMAT_VERSION = 1;
function createMemoryRecord(input) {
    if (!input.id.trim())
        throw new Error("Memory id is required.");
    if (!input.projectId.trim())
        throw new Error("Memory project id is required.");
    if (!input.summary.trim())
        throw new Error("Memory summary is required.");
    if (!input.content.trim())
        throw new Error("Memory content is required.");
    if (input.supersedes === input.id)
        throw new Error("Memory cannot supersede itself.");
    const provenance = normalizeProvenance(input.provenance ?? []);
    if (input.authority === "authoritative" && provenance.length === 0)
        throw new Error("Authoritative memory requires provenance.");
    const now = input.now ?? new Date().toISOString();
    return {
        id: input.id, projectId: input.projectId, class: input.class, authority: input.authority,
        summary: input.summary.trim(), content: input.content.trim(), createdAt: now, updatedAt: now, provenance,
        ...(input.supersedes ? { supersedes: input.supersedes } : {}),
        relatedMemoryIds: normalizeStrings(input.relatedMemoryIds ?? []), relevanceTags: normalizeStrings(input.relevanceTags ?? [])
    };
}
function normalizeProvenance(provenance) {
    return provenance.map((item) => { if (!item.reference.trim())
        throw new Error("Memory provenance reference is required."); if (!item.recordedAt.trim())
        throw new Error("Memory provenance timestamp is required."); return { ...item, reference: item.reference.trim() }; });
}
function normalizeStrings(values) { return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort(); }
//# sourceMappingURL=memory.js.map
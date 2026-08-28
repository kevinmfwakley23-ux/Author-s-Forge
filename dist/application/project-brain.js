"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assembleProjectBrainContext = assembleProjectBrainContext;
function assembleProjectBrainContext(store, query) {
    if (!query.projectId.trim())
        throw new Error("Project Brain project id is required.");
    if (query.limit !== undefined && (!Number.isInteger(query.limit) || query.limit < 0))
        throw new Error("Project Brain limit must be a non-negative integer.");
    const classFilter = query.taskMemoryClasses;
    const filterClasses = (memory) => classFilter === undefined || classFilter.includes(memory.class);
    const take = (items) => items.slice(0, query.limit ?? Number.MAX_SAFE_INTEGER);
    const base = { projectId: query.projectId, relevanceTags: query.relevanceTags, changedSince: query.changedSince };
    const authoritative = take(store.query({ ...base, authoritativeOnly: true }).filter(filterClasses));
    const working = query.includeWorkingState
        ? take(store.query(base).filter((memory) => filterClasses(memory) && (memory.authority === "proposed" || memory.authority === "working" || memory.authority === "verified")))
        : [];
    const changed = take(store.query(base).filter(filterClasses));
    return { projectId: query.projectId, authoritative, working, changed };
}
//# sourceMappingURL=project-brain.js.map
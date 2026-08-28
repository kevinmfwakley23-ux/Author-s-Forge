"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BOOK_VERSION_CONTROL_FORMAT_VERSION = void 0;
exports.createBookSnapshot = createBookSnapshot;
exports.validateBookSnapshot = validateBookSnapshot;
exports.compareBookVersions = compareBookVersions;
exports.rollbackVersion = rollbackVersion;
exports.branchVersion = branchVersion;
exports.mergeVersions = mergeVersions;
exports.BOOK_VERSION_CONTROL_FORMAT_VERSION = 1;
const req = (v, n) => { if (typeof v !== "string" || !v.trim())
    throw new Error(`${n} is required.`); return v.trim(); };
const clone = (v) => JSON.parse(JSON.stringify(v));
function createBookSnapshot(input) { return clone({ ...input, id: input.id ?? cryptoId() }); }
function validateBookSnapshot(v) { req(v.id, "Version id"); req(v.projectId, "Project id"); req(v.bookId, "Book id"); req(v.name, "Version name"); req(v.createdAt, "Version createdAt"); if (!Array.isArray(v.chapters) && typeof v.chapters !== "object")
    throw new Error("Version chapters are required."); return clone(v); }
function compareBookVersions(from, to) { if (from.projectId !== to.projectId || from.bookId !== to.bookId)
    throw new Error("Versions must belong to the same project and book."); const keys = new Set([...Object.keys(from.chapters), ...Object.keys(to.chapters)]); const changes = []; for (const chapterId of [...keys].sort()) {
    const before = from.chapters[chapterId], after = to.chapters[chapterId];
    if (before === undefined)
        changes.push({ chapterId, kind: "added", after });
    else if (after === undefined)
        changes.push({ chapterId, kind: "removed", before });
    else if (before !== after)
        changes.push({ chapterId, kind: "changed", before, after });
} return { fromId: from.id, toId: to.id, changes, changedChapterCount: changes.length, identical: changes.length === 0 }; }
function rollbackVersion(history, versionId) { const v = history.versions.find(x => x.id === versionId); if (!v)
    throw new Error(`Version "${versionId}" was not found.`); return clone(v); }
function branchVersion(history, input) { const base = history.versions.find(v => v.id === input.baseVersionId); if (!base)
    throw new Error(`Base version "${input.baseVersionId}" was not found.`); if (history.branches.some(b => b.name === input.name))
    throw new Error(`Version branch "${input.name}" already exists.`); return { id: input.id ?? cryptoId(), projectId: history.projectId, bookId: history.bookId, name: req(input.name, "Branch name"), baseVersionId: base.id, headVersionId: base.id, createdAt: input.createdAt ?? new Date().toISOString() }; }
function mergeVersions(target, source, base) { if (target.projectId !== source.projectId || target.bookId !== source.bookId || base.projectId !== target.projectId || base.bookId !== target.bookId)
    throw new Error("Versions must share project and book."); const keys = new Set([...Object.keys(base.chapters), ...Object.keys(target.chapters), ...Object.keys(source.chapters)]); const chapters = {}; for (const k of [...keys].sort()) {
    const b = base.chapters[k], t = target.chapters[k], s = source.chapters[k];
    if (t === s) {
        if (t !== undefined)
            chapters[k] = t;
        continue;
    }
    if (t === b) {
        if (s !== undefined)
            chapters[k] = s;
        continue;
    }
    if (s === b) {
        if (t !== undefined)
            chapters[k] = t;
        continue;
    }
    throw new Error(`Merge conflict in chapter "${k}".`);
} return createBookSnapshot({ ...target, id: undefined, label: "custom", name: `Merge of ${target.name} and ${source.name}`, createdAt: new Date().toISOString(), chapters, parentId: target.id }); }
function cryptoId() { return `ver_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`; }
//# sourceMappingURL=book-version-control.js.map
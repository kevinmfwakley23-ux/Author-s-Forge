"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookVersionControlService = void 0;
const book_version_control_1 = require("../domain/book-version-control");
class BookVersionControlService {
    history;
    constructor(history) {
        this.history = history;
    }
    snapshot(v) { if (v.projectId !== this.history.projectId || v.bookId !== this.history.bookId)
        throw new Error("Version belongs to another project or book."); return (0, book_version_control_1.validateBookSnapshot)(v); }
    compare(fromId, toId) { const f = this.find(fromId), t = this.find(toId); return (0, book_version_control_1.compareBookVersions)(f, t); }
    restore(versionId) { return (0, book_version_control_1.rollbackVersion)(this.history, versionId); }
    createBranch(name, baseVersionId) { return (0, book_version_control_1.branchVersion)(this.history, { name, baseVersionId }); }
    merge(targetId, sourceId, baseId) { return (0, book_version_control_1.mergeVersions)(this.find(targetId), this.find(sourceId), this.find(baseId)); }
    find(id) { const v = this.history.versions.find(x => x.id === id); if (!v)
        throw new Error(`Version "${id}" was not found.`); return v; }
}
exports.BookVersionControlService = BookVersionControlService;
//# sourceMappingURL=book-version-control.js.map
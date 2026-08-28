"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthorControlService = void 0;
const author_control_1 = require("../domain/author-control");
class AuthorControlService {
    projectId;
    decisions;
    constructor(projectId, decisions = []) {
        this.projectId = projectId;
        this.decisions = decisions;
        if (!projectId.trim())
            throw new Error("Project id is required.");
    }
    suggest(targetId, content, reason) { return this.add({ targetId, content, reason, status: "ai-suggestion" }); }
    draft(targetId, content, reason) { return this.add({ targetId, content, reason, status: "ai-draft" }); }
    approve(targetId, content, reason = "Author approved this state.") { return this.add({ targetId, content, reason, status: "author-approved" }); }
    override(targetId, content, reason = "Author override takes precedence over prior recommendations.") { this.decisions = (0, author_control_1.applyAuthorOverride)(this.decisions, { projectId: this.projectId, targetId, content, reason }); return this.decisions.at(-1); }
    lock(targetId, content, reason) { this.decisions = (0, author_control_1.lockCanon)(this.decisions, { projectId: this.projectId, targetId, content, reason }); return this.decisions.at(-1); }
    resolve(targetId) { return (0, author_control_1.resolveAuthorControl)(this.decisions, this.projectId, targetId); }
    history() { return this.decisions.map(d => ({ ...d })); }
    add(input) { const d = { id: `decision_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`, projectId: this.projectId, targetId: input.targetId, status: input.status, content: input.content, reason: input.reason, createdAt: new Date().toISOString(), supersedesId: this.resolve(input.targetId)?.id }; this.decisions = [...this.decisions, d]; return d; }
}
exports.AuthorControlService = AuthorControlService;
//# sourceMappingURL=author-control.js.map
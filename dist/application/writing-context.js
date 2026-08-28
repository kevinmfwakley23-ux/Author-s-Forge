"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WritingContextService = void 0;
const context_assembly_1 = require("../domain/context-assembly");
class WritingContextService {
    assemble(project, request) {
        return (0, context_assembly_1.assembleWritingContext)(project, { ...request, projectId: request.projectId ?? project.metadata.id });
    }
}
exports.WritingContextService = WritingContextService;
//# sourceMappingURL=writing-context.js.map
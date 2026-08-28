"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiCollaborationService = void 0;
const ai_collaboration_1 = require("../domain/ai-collaboration");
class AiCollaborationService {
    select(mode) { return (0, ai_collaboration_1.createAiCollaborationPolicy)(mode); }
}
exports.AiCollaborationService = AiCollaborationService;
//# sourceMappingURL=ai-collaboration.js.map
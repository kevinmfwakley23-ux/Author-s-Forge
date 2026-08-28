"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoicePreservationService = void 0;
const voice_preservation_1 = require("../domain/voice-preservation");
class VoicePreservationService {
    projectId;
    constructor(projectId) {
        this.projectId = projectId;
    }
    analyze(text) { return (0, voice_preservation_1.analyzeVoice)(text); }
    createProfile(input) { return (0, voice_preservation_1.createVoiceProfile)({ ...input, projectId: this.projectId }); }
    compare(text, profile) { return (0, voice_preservation_1.compareVoiceToProfile)(text, profile); }
    rewriteBrief(source, instruction, profile) { return (0, voice_preservation_1.buildVoiceRewriteBrief)({ source, instruction, profile }); }
}
exports.VoicePreservationService = VoicePreservationService;
//# sourceMappingURL=voice-preservation.js.map
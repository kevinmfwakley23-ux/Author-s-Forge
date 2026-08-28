"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentRandomizerService = void 0;
const content_randomizer_1 = require("../domain/content-randomizer");
class ContentRandomizerService {
    generate(request) { return (0, content_randomizer_1.validateRandomizerResult)((0, content_randomizer_1.randomizeContent)(request)); }
}
exports.ContentRandomizerService = ContentRandomizerService;
//# sourceMappingURL=content-randomizer.js.map
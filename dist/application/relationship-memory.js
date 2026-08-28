"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RelationshipMemoryService = void 0;
const relationship_memory_1 = require("../domain/relationship-memory");
class RelationshipMemoryService {
    create(input) { return (0, relationship_memory_1.createMemoryRelationship)(input); }
    validate(value) { return (0, relationship_memory_1.validateMemoryRelationship)(value); }
}
exports.RelationshipMemoryService = RelationshipMemoryService;
//# sourceMappingURL=relationship-memory.js.map
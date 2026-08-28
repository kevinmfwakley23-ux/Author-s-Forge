"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RELATIONSHIP_MEMORY_FORMAT_VERSION = void 0;
exports.createMemoryRelationship = createMemoryRelationship;
exports.validateMemoryRelationship = validateMemoryRelationship;
exports.RELATIONSHIP_MEMORY_FORMAT_VERSION = 1;
function createMemoryRelationship(input) { for (const [k, v] of Object.entries(input))
    if (["id", "projectId", "sourceMemoryId", "targetMemoryId", "relation", "context"].includes(k) && typeof v === "string" && !v.trim())
        throw new Error(`${k} is required.`); if (input.sourceMemoryId === input.targetMemoryId)
    throw new Error("A memory cannot relate to itself."); return Object.freeze({ formatVersion: exports.RELATIONSHIP_MEMORY_FORMAT_VERSION, id: input.id, projectId: input.projectId, sourceMemoryId: input.sourceMemoryId, targetMemoryId: input.targetMemoryId, relation: input.relation, context: input.context, significance: input.significance, createdAt: input.createdAt ?? new Date().toISOString() }); }
function validateMemoryRelationship(r) { if (r.formatVersion !== exports.RELATIONSHIP_MEMORY_FORMAT_VERSION)
    throw new Error("Unsupported memory relationship format version."); if (!r.id || !r.projectId || !r.sourceMemoryId || !r.targetMemoryId || !r.relation || !r.context)
    throw new Error("Invalid memory relationship."); if (r.sourceMemoryId === r.targetMemoryId)
    throw new Error("A memory cannot relate to itself."); return Object.freeze({ ...r }); }
//# sourceMappingURL=relationship-memory.js.map
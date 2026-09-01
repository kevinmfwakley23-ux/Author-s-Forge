import { createMemoryRelationship, validateMemoryRelationship, validateMemoryRelationshipSet, type MemoryRelationship } from "../domain/relationship-memory";
import type { MemoryRecord } from "../domain/memory";

export class RelationshipMemoryService {
  create(input: Parameters<typeof createMemoryRelationship>[0]): MemoryRelationship { return createMemoryRelationship(input); }
  validate(value: unknown): MemoryRelationship { return validateMemoryRelationship(value); }
  validateSet(value: unknown, memories: readonly Pick<MemoryRecord, "id" | "projectId" | "createdAt">[], projectId: string): readonly MemoryRelationship[] {
    return validateMemoryRelationshipSet(value, memories, projectId);
  }
}

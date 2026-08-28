import { createMemoryRelationship, type MemoryRelationship } from "../domain/relationship-memory";
export declare class RelationshipMemoryService {
    create(input: Parameters<typeof createMemoryRelationship>[0]): MemoryRelationship;
    validate(value: MemoryRelationship): MemoryRelationship;
}

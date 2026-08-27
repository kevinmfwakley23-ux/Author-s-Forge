import {createMemoryRelationship,validateMemoryRelationship,type MemoryRelationship} from "../domain/relationship-memory";
export class RelationshipMemoryService { create(input:Parameters<typeof createMemoryRelationship>[0]):MemoryRelationship{return createMemoryRelationship(input);} validate(value:MemoryRelationship):MemoryRelationship{return validateMemoryRelationship(value);} }

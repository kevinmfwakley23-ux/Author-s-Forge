export declare const RELATIONSHIP_MEMORY_FORMAT_VERSION: 1;
export interface MemoryRelationship {
    readonly formatVersion: typeof RELATIONSHIP_MEMORY_FORMAT_VERSION;
    readonly id: string;
    readonly projectId: string;
    readonly sourceMemoryId: string;
    readonly targetMemoryId: string;
    readonly relation: string;
    readonly context: string;
    readonly significance?: string;
    readonly createdAt: string;
}
export declare function createMemoryRelationship(input: {
    id: string;
    projectId: string;
    sourceMemoryId: string;
    targetMemoryId: string;
    relation: string;
    context: string;
    significance?: string;
    createdAt?: string;
}): MemoryRelationship;
export declare function validateMemoryRelationship(r: MemoryRelationship): MemoryRelationship;

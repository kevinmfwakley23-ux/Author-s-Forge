export const RELATIONSHIP_MEMORY_FORMAT_VERSION = 1 as const;

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

export function createMemoryRelationship(input: {
  id: string;
  projectId: string;
  sourceMemoryId: string;
  targetMemoryId: string;
  relation: string;
  context: string;
  significance?: string;
  createdAt?: string;
}): MemoryRelationship {
  for (const [key, value] of Object.entries(input)) {
    if (["id", "projectId", "sourceMemoryId", "targetMemoryId", "relation", "context"].includes(key) && typeof value === "string" && !value.trim()) {
      throw new Error(`${key} is required.`);
    }
  }
  if (input.sourceMemoryId === input.targetMemoryId) throw new Error("A memory cannot relate to itself.");

  const significance = input.significance?.trim();
  return Object.freeze({
    formatVersion: RELATIONSHIP_MEMORY_FORMAT_VERSION,
    id: input.id,
    projectId: input.projectId,
    sourceMemoryId: input.sourceMemoryId,
    targetMemoryId: input.targetMemoryId,
    relation: input.relation,
    context: input.context,
    ...(significance ? { significance } : {}),
    createdAt: input.createdAt ?? new Date().toISOString(),
  });
}

export function validateMemoryRelationship(relationship: MemoryRelationship): MemoryRelationship {
  if (relationship.formatVersion !== RELATIONSHIP_MEMORY_FORMAT_VERSION) throw new Error("Unsupported memory relationship format version.");
  if (!relationship.id || !relationship.projectId || !relationship.sourceMemoryId || !relationship.targetMemoryId || !relationship.relation || !relationship.context) throw new Error("Invalid memory relationship.");
  if (relationship.sourceMemoryId === relationship.targetMemoryId) throw new Error("A memory cannot relate to itself.");
  if (relationship.significance !== undefined && (typeof relationship.significance !== "string" || !relationship.significance.trim())) throw new Error("Invalid memory relationship significance.");

  const significance = relationship.significance?.trim();
  return Object.freeze({
    formatVersion: RELATIONSHIP_MEMORY_FORMAT_VERSION,
    id: relationship.id,
    projectId: relationship.projectId,
    sourceMemoryId: relationship.sourceMemoryId,
    targetMemoryId: relationship.targetMemoryId,
    relation: relationship.relation,
    context: relationship.context,
    ...(significance ? { significance } : {}),
    createdAt: relationship.createdAt,
  });
}

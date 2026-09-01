import type { MemoryRecord } from "./memory";

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
  return validateMemoryRelationship({
    formatVersion: RELATIONSHIP_MEMORY_FORMAT_VERSION,
    id: input.id,
    projectId: input.projectId,
    sourceMemoryId: input.sourceMemoryId,
    targetMemoryId: input.targetMemoryId,
    relation: input.relation,
    context: input.context,
    ...(input.significance === undefined ? {} : { significance: input.significance }),
    createdAt: input.createdAt ?? new Date().toISOString(),
  });
}

export function validateMemoryRelationship(value: unknown): MemoryRelationship {
  if (!value || typeof value !== "object") throw new Error("Invalid memory relationship.");
  const relationship = value as Record<string, unknown>;
  if (relationship.formatVersion !== RELATIONSHIP_MEMORY_FORMAT_VERSION) throw new Error("Unsupported memory relationship format version.");
  const id = requiredString(relationship.id, "Memory relationship id");
  const projectId = requiredString(relationship.projectId, "Memory relationship project id");
  const sourceMemoryId = requiredString(relationship.sourceMemoryId, "Memory relationship source memory id");
  const targetMemoryId = requiredString(relationship.targetMemoryId, "Memory relationship target memory id");
  const relation = requiredString(relationship.relation, "Memory relationship relation");
  const context = requiredString(relationship.context, "Memory relationship context");
  if (sourceMemoryId === targetMemoryId) throw new Error("A memory cannot relate to itself.");
  const createdAt = requiredTimestamp(relationship.createdAt, "Memory relationship createdAt");
  let significance: string | undefined;
  if (relationship.significance !== undefined) significance = requiredString(relationship.significance, "Memory relationship significance");
  return Object.freeze({
    formatVersion: RELATIONSHIP_MEMORY_FORMAT_VERSION,
    id,
    projectId,
    sourceMemoryId,
    targetMemoryId,
    relation,
    context,
    ...(significance === undefined ? {} : { significance }),
    createdAt,
  });
}

export function validateMemoryRelationshipSet(
  value: unknown,
  memories: readonly Pick<MemoryRecord, "id" | "projectId" | "createdAt">[],
  expectedProjectId: string,
): readonly MemoryRelationship[] {
  if (!Array.isArray(value)) throw new Error("Memory relationships must be an array.");
  const memoryById = new Map<string, Pick<MemoryRecord, "id" | "projectId" | "createdAt">>();
  for (const memory of memories) {
    if (memory.projectId !== expectedProjectId) throw new Error("Relationship validation received memory from another project.");
    if (memoryById.has(memory.id)) throw new Error(`Duplicate memory id \"${memory.id}\" while validating relationships.`);
    memoryById.set(memory.id, memory);
  }
  const ids = new Set<string>();
  const edges = new Set<string>();
  return value.map((raw) => {
    const relationship = validateMemoryRelationship(raw);
    if (relationship.projectId !== expectedProjectId) throw new Error("Project memory relationship belongs to another project.");
    if (ids.has(relationship.id)) throw new Error(`Duplicate memory relationship id \"${relationship.id}\".`);
    ids.add(relationship.id);
    const source = memoryById.get(relationship.sourceMemoryId);
    const target = memoryById.get(relationship.targetMemoryId);
    if (!source) throw new Error(`Memory relationship \"${relationship.id}\" references missing source memory \"${relationship.sourceMemoryId}\".`);
    if (!target) throw new Error(`Memory relationship \"${relationship.id}\" references missing target memory \"${relationship.targetMemoryId}\".`);
    if (Date.parse(relationship.createdAt) < Math.max(Date.parse(source.createdAt), Date.parse(target.createdAt))) throw new Error(`Memory relationship \"${relationship.id}\" predates one of its memory endpoints.`);
    const edgeKey = [relationship.sourceMemoryId, relationship.targetMemoryId, normalizeRelation(relationship.relation)].join("\u0000");
    if (edges.has(edgeKey)) throw new Error(`Duplicate semantic memory relationship from \"${relationship.sourceMemoryId}\" to \"${relationship.targetMemoryId}\" for \"${relationship.relation}\".`);
    edges.add(edgeKey);
    return relationship;
  });
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}
function requiredTimestamp(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim() || Number.isNaN(Date.parse(value))) throw new Error(`${label} must be a valid timestamp.`);
  return value;
}
function normalizeRelation(value: string): string { return value.normalize("NFKC").trim().toLocaleLowerCase("und").replace(/\s+/g, " "); }

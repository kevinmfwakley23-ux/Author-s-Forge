import { randomUUID } from "node:crypto";
import { attachNftArtwork, type NftCollection } from "../domain/nft-creation";
import { createMemoryRecord } from "../domain/memory";
import { withProjectMemories } from "../domain/project";
import type { FileNftCreationStore } from "../infrastructure/file-nft-creation-store";
import type { ProjectStorePort } from "./project-store-port";
import { ProjectMemoryStore } from "./project-memory-store";

export interface AttachAuthorNftArtworkInput {
  readonly imageUri: string;
  readonly animationUrl?: string;
  readonly sourceReference: string;
  readonly authorDeclaresRights: true;
}

export async function attachAuthorNftArtwork(
  store: FileNftCreationStore,
  projects: ProjectStorePort,
  forgeProjectId: string,
  collectionId: string,
  tokenId: string,
  input: AttachAuthorNftArtworkInput,
  now = new Date().toISOString(),
): Promise<NftCollection> {
  if (input.authorDeclaresRights !== true) throw new Error("Explicit author rights/provenance declaration is required before attaching NFT artwork.");
  const sourceReference = required(input.sourceReference, "NFT artwork source reference", 2000);
  const imageUri = required(input.imageUri, "NFT artwork URI", 2_000_000);
  const animationUrl = optional(input.animationUrl, 2_000_000);

  // Load and validate both durable aggregates before mutating either one.
  const [collection, project] = await Promise.all([
    store.get(forgeProjectId, collectionId),
    projects.load(forgeProjectId),
  ]);
  if (!collection) throw new Error(`NFT collection "${collectionId}" not found.`);
  if (!project) throw new Error(`Forge project "${forgeProjectId}" not found.`);

  // A caller-supplied deterministic timestamp may never move either durable
  // aggregate backwards. Use one monotonic event time for artwork + provenance.
  const eventAt = latestTimestamp(now, collection.updatedAt, project.metadata.createdAt, project.metadata.updatedAt);
  const sourceAssetId = `author-nft-${randomUUID()}`;
  const nextCollection = attachNftArtwork(collection, tokenId, {
    imageUri,
    sourceAssetId,
    ...(animationUrl ? { animationUrl } : {}),
  }, eventAt);

  const memory = new ProjectMemoryStore();
  memory.restore(project.memories);
  const memoryId = `nft-art:${collectionId}:${tokenId}:${eventAt.replace(/[^0-9]/g, "")}`;
  memory.register(createMemoryRecord({
    id: memoryId,
    projectId: forgeProjectId,
    class: "production-memory",
    authority: "working",
    summary: `NFT author artwork · ${collection.title} #${tokenId}`,
    content: JSON.stringify({ collectionId, tokenId, imageUri, ...(animationUrl ? { animationUrl } : {}), sourceAssetId, sourceReference, declaration: "Author explicitly declared they have the rights/permission needed to use this artwork reference for the NFT project. Forge does not independently adjudicate ownership." }),
    provenance: [{ kind: "author", reference: sourceReference, recordedAt: eventAt }],
    relevanceTags: ["nft", "nft-artwork", "rights-provenance", collectionId, tokenId],
    now: eventAt,
  }));
  const nextProject = withProjectMemories(project, memory.toPortableState(), eventAt);

  // File stores do not share a native transaction. Compensate the first write
  // if the Project Brain persistence step fails so artwork cannot remain
  // attached without the provenance record that justified it.
  const saved = await store.save(nextCollection);
  try {
    await projects.save(nextProject);
  } catch (projectError) {
    try {
      await store.save(collection);
    } catch (rollbackError) {
      throw new AggregateError(
        [projectError, rollbackError],
        "NFT artwork provenance save failed and the NFT collection rollback also failed.",
      );
    }
    throw projectError;
  }
  return saved;
}

function latestTimestamp(...values: readonly string[]): string {
  const parsed = values.map((value) => Date.parse(value));
  if (parsed.some((value) => !Number.isFinite(value))) throw new Error("NFT artwork timestamp must be a valid ISO-compatible timestamp.");
  return new Date(Math.max(...parsed)).toISOString();
}

function required(value: unknown, label: string, max: number): string { if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`); const normalized = value.trim(); if (normalized.length > max) throw new Error(`${label} exceeds ${max} characters.`); return normalized; }
function optional(value: unknown, max: number): string | undefined { if (value === undefined || value === null || value === "") return undefined; if (typeof value !== "string") throw new Error("Optional NFT artwork value must be a string."); const normalized = value.trim(); if (!normalized) return undefined; if (normalized.length > max) throw new Error(`Optional NFT artwork value exceeds ${max} characters.`); return normalized; }

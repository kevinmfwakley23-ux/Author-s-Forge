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
  const collection = await store.get(forgeProjectId, collectionId);
  if (!collection) throw new Error(`NFT collection "${collectionId}" not found.`);
  const sourceAssetId = `author-nft-${randomUUID()}`;
  const saved = await store.save(attachNftArtwork(collection, tokenId, { imageUri, sourceAssetId, ...(animationUrl ? { animationUrl } : {}) }, now));

  const project = await projects.load(forgeProjectId);
  if (!project) throw new Error(`Forge project "${forgeProjectId}" not found.`);
  const memory = new ProjectMemoryStore();
  memory.restore(project.memories);
  const memoryId = `nft-art:${collectionId}:${tokenId}:${now.replace(/[^0-9]/g, "")}`;
  memory.register(createMemoryRecord({
    id: memoryId,
    projectId: forgeProjectId,
    class: "production-memory",
    authority: "working",
    summary: `NFT author artwork · ${collection.title} #${tokenId}`,
    content: JSON.stringify({ collectionId, tokenId, imageUri, ...(animationUrl ? { animationUrl } : {}), sourceAssetId, sourceReference, declaration: "Author explicitly declared they have the rights/permission needed to use this artwork reference for the NFT project. Forge does not independently adjudicate ownership." }),
    provenance: [{ kind: "author", reference: sourceReference, recordedAt: now }],
    relevanceTags: ["nft", "nft-artwork", "rights-provenance", collectionId, tokenId],
    now,
  }));
  await projects.save(withProjectMemories(project, memory.toPortableState(), now));
  return saved;
}

function required(value: unknown, label: string, max: number): string { if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`); const normalized = value.trim(); if (normalized.length > max) throw new Error(`${label} exceeds ${max} characters.`); return normalized; }
function optional(value: unknown, max: number): string | undefined { if (value === undefined || value === null || value === "") return undefined; if (typeof value !== "string") throw new Error("Optional NFT artwork value must be a string."); const normalized = value.trim(); if (!normalized) return undefined; if (normalized.length > max) throw new Error(`Optional NFT artwork value exceeds ${max} characters.`); return normalized; }

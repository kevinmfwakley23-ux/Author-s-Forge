import { randomUUID } from "node:crypto";
import { createMemoryRecord } from "../domain/memory";
import { compileNftMetadata, nftCollectionPreflight, type NftCollection } from "../domain/nft-creation";
import { withProjectMemories } from "../domain/project";
import type { ProjectStorePort } from "./project-store-port";
import { ProjectMemoryStore } from "./project-memory-store";

export interface NftStoragePublishInput {
  readonly execute?: boolean;
  readonly confirmExternalPublish?: boolean;
  readonly confirmLargeBatch?: boolean;
  readonly maxItems?: number;
}

export interface NftStoragePublishPlan {
  readonly provider: "pinata-public-ipfs";
  readonly execute: boolean;
  readonly collectionId: string;
  readonly itemCount: number;
  readonly mediaUploadsRequired: number;
  readonly existingIpfsMedia: number;
  readonly blockedRemoteMedia: number;
  readonly estimatedUploads: number;
  readonly configured: boolean;
  readonly note: string;
}

export interface NftStoragePublishReceipt {
  readonly provider: "pinata-public-ipfs";
  readonly collectionId: string;
  readonly publishedAt: string;
  readonly media: readonly { readonly tokenId: string; readonly uri: string; readonly cid?: string; readonly reusedExisting: boolean }[];
  readonly metadata: readonly { readonly tokenId: string; readonly uri: string; readonly cid: string }[];
  readonly manifest: { readonly uri: string; readonly cid: string };
  readonly note: string;
}

interface PinataUploadResponse { readonly data?: { readonly cid?: string; readonly id?: string; readonly size?: number }; readonly cid?: string; readonly IpfsHash?: string; }

type Fetcher = typeof fetch;

export class NftStoragePublisherService {
  constructor(
    private readonly projects: ProjectStorePort,
    private readonly environment: NodeJS.ProcessEnv = process.env,
    private readonly fetcher: Fetcher = fetch,
  ) {}

  plan(collection: NftCollection, input: NftStoragePublishInput = {}): NftStoragePublishPlan {
    const preflight = nftCollectionPreflight(collection);
    if (!preflight.readyForMetadata) throw new Error(`NFT storage publishing is blocked by ${preflight.errors} preflight error(s).`);
    if (collection.storageMode !== "ipfs") throw new Error(`Pinata publishing requires collection storageMode=ipfs; current mode is ${collection.storageMode}.`);
    const limit = normalizedLimit(input.maxItems, collection.items.length);
    const selected = collection.items.slice(0, limit);
    let mediaUploadsRequired = 0, existingIpfsMedia = 0, blockedRemoteMedia = 0;
    for (const item of selected) {
      const uri = item.imageUri ?? "";
      if (uri.startsWith("ipfs://")) existingIpfsMedia++;
      else if (uri.startsWith("data:image/")) mediaUploadsRequired++;
      else blockedRemoteMedia++;
    }
    return Object.freeze({
      provider: "pinata-public-ipfs" as const,
      execute: input.execute === true,
      collectionId: collection.id,
      itemCount: selected.length,
      mediaUploadsRequired,
      existingIpfsMedia,
      blockedRemoteMedia,
      estimatedUploads: mediaUploadsRequired + selected.length + 1,
      configured: Boolean(this.environment.PINATA_JWT?.trim()),
      note: "Pinata V3 uploads are individual public-IPFS files. Forge publishes media that is already embedded in the project, then each metadata JSON file, then a manifest mapping token IDs to canonical metadata URIs. Existing ipfs:// artwork is reused without re-uploading.",
    });
  }

  async publish(collection: NftCollection, input: NftStoragePublishInput): Promise<NftStoragePublishPlan | NftStoragePublishReceipt> {
    const plan = this.plan(collection, input);
    if (input.execute !== true) return plan;
    if (input.confirmExternalPublish !== true) throw new Error("Explicit confirmation is required before Forge uploads NFT files to an external permanent-storage provider.");
    const jwt = this.environment.PINATA_JWT?.trim();
    if (!jwt) throw new Error("PINATA_JWT is not configured. Forge will not claim IPFS publishing occurred.");
    if (plan.blockedRemoteMedia) throw new Error("One or more artwork URIs are remote HTTP/Arweave/unsupported references. Forge will not fetch and republish remote media implicitly; attach ipfs:// artwork or approved embedded Image Lab artwork first.");
    if (plan.itemCount > 250 && input.confirmLargeBatch !== true) throw new Error(`Publishing ${plan.itemCount} NFT items can create hundreds or thousands of paid external uploads. Set confirmLargeBatch=true only after reviewing the publish plan.`);

    const selected = collection.items.slice(0, plan.itemCount);
    const media: { tokenId: string; uri: string; cid?: string; reusedExisting: boolean }[] = [];
    const metadata: { tokenId: string; uri: string; cid: string }[] = [];
    for (const item of selected) {
      if (!item.imageUri) throw new Error(`NFT token ${item.tokenId} has no image URI.`);
      let imageUri = item.imageUri;
      let imageCid: string | undefined;
      if (imageUri.startsWith("data:image/")) {
        const parsed = parseDataUri(imageUri);
        imageCid = await this.uploadFile(jwt, `${safeName(collection.id)}-${safeName(item.tokenId)}.${extensionFor(parsed.mime)}`, parsed.bytes, parsed.mime);
        imageUri = `ipfs://${imageCid}`;
        media.push({ tokenId: item.tokenId, uri: imageUri, cid: imageCid, reusedExisting: false });
      } else if (imageUri.startsWith("ipfs://")) {
        media.push({ tokenId: item.tokenId, uri: imageUri, reusedExisting: true });
      } else {
        throw new Error(`NFT token ${item.tokenId} artwork is not publishable by the Pinata adapter without an explicit ingest workflow.`);
      }
      const raw = compileNftMetadata(collection, item.tokenId);
      const finalMetadata = replaceArtworkUris(raw, item.imageUri, imageUri);
      const jsonBytes = Buffer.from(`${JSON.stringify(finalMetadata, null, 2)}\n`, "utf8");
      const cid = await this.uploadFile(jwt, `${safeName(item.tokenId)}.json`, jsonBytes, "application/json");
      metadata.push({ tokenId: item.tokenId, uri: `ipfs://${cid}`, cid });
    }

    const manifestBody = {
      formatVersion: 1,
      kind: "forge-nft-ipfs-publication-manifest",
      collectionId: collection.id,
      title: collection.title,
      publishedAt: new Date().toISOString(),
      provider: "pinata-public-ipfs",
      tokenUris: Object.fromEntries(metadata.map((item) => [item.tokenId, item.uri])),
      mediaUris: Object.fromEntries(media.map((item) => [item.tokenId, item.uri])),
      note: "These are returned IPFS content identifiers from the configured Pinata account. No blockchain contract was deployed and no NFT was minted by this operation.",
    };
    const manifestCid = await this.uploadFile(jwt, `${safeName(collection.id)}-forge-manifest.json`, Buffer.from(`${JSON.stringify(manifestBody, null, 2)}\n`, "utf8"), "application/json");
    const receipt: NftStoragePublishReceipt = Object.freeze({
      provider: "pinata-public-ipfs" as const,
      collectionId: collection.id,
      publishedAt: manifestBody.publishedAt,
      media: Object.freeze(media.map((item) => Object.freeze({ ...item }))),
      metadata: Object.freeze(metadata.map((item) => Object.freeze({ ...item }))),
      manifest: Object.freeze({ uri: `ipfs://${manifestCid}`, cid: manifestCid }),
      note: "Pinata returned CIDs for the uploaded files. Forge still requires a separate explicitly wallet-authorized deployment/mint transaction before anything exists on-chain.",
    });
    await this.remember(collection, receipt);
    return receipt;
  }

  private async uploadFile(jwt: string, name: string, bytes: Uint8Array, mime: string): Promise<string> {
    const form = new FormData();
    form.append("network", "public");
    const blobBytes = Uint8Array.from(bytes).buffer;
    form.append("file", new Blob([blobBytes], { type: mime }), name);
    form.append("name", name);
    const group = this.environment.PINATA_GROUP_ID?.trim();
    if (group) form.append("group_id", group);
    const response = await this.fetcher("https://uploads.pinata.cloud/v3/files", {
      method: "POST",
      headers: { authorization: `Bearer ${jwt}` },
      body: form,
      signal: AbortSignal.timeout(120_000),
    });
    const text = await response.text();
    let payload: PinataUploadResponse = {};
    try { payload = text ? JSON.parse(text) as PinataUploadResponse : {}; } catch {}
    if (!response.ok) throw new Error(`Pinata upload failed (${response.status}). ${safeProviderMessage(text)}`);
    const cid = payload.data?.cid ?? payload.cid ?? payload.IpfsHash;
    if (typeof cid !== "string" || !cid.trim()) throw new Error("Pinata upload response did not contain a CID. Forge will not record the upload as successful.");
    return cid.trim();
  }

  private async remember(collection: NftCollection, receipt: NftStoragePublishReceipt): Promise<void> {
    const project = await this.projects.load(collection.forgeProjectId);
    if (!project) throw new Error(`Forge project "${collection.forgeProjectId}" not found after IPFS publish.`);
    const memory = new ProjectMemoryStore();
    memory.restore(project.memories);
    const id = `nft-ipfs:${collection.id}:${randomUUID()}`;
    memory.register(createMemoryRecord({
      id,
      projectId: collection.forgeProjectId,
      class: "production-memory",
      authority: "verified",
      summary: `NFT IPFS publication · ${collection.title}`,
      content: JSON.stringify({ collectionId: collection.id, provider: receipt.provider, manifest: receipt.manifest, metadata: receipt.metadata, media: receipt.media, publishedAt: receipt.publishedAt }),
      provenance: [{ kind: "system", reference: `pinata:${receipt.manifest.cid}`, recordedAt: receipt.publishedAt }],
      relevanceTags: ["nft", "nft-storage", "ipfs", "pinata", collection.id],
      now: receipt.publishedAt,
    }));
    await this.projects.save(withProjectMemories(project, memory.toPortableState(), receipt.publishedAt));
  }
}

function normalizedLimit(value: number | undefined, total: number): number { if (value === undefined) return total; if (!Number.isInteger(value) || value < 1 || value > total) throw new Error(`maxItems must be an integer from 1 to ${total}.`); return value; }
function parseDataUri(value: string): { mime: string; bytes: Uint8Array } { const match = value.match(/^data:(image\/[A-Za-z0-9.+-]+);base64,([A-Za-z0-9+/=\r\n]+)$/); if (!match) throw new Error("Only base64 image data URIs can be published by the Pinata adapter."); return { mime: match[1].toLowerCase(), bytes: Buffer.from(match[2].replace(/\s+/g, ""), "base64") }; }
function extensionFor(mime: string): string { if (mime === "image/png") return "png"; if (mime === "image/jpeg") return "jpg"; if (mime === "image/gif") return "gif"; if (mime === "image/webp") return "webp"; if (mime === "image/svg+xml") return "svg"; return "bin"; }
function safeName(value: string): string { return value.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "nft"; }
function replaceArtworkUris(metadata: Readonly<Record<string, unknown>>, from: string, to: string): Readonly<Record<string, unknown>> { const cloned = JSON.parse(JSON.stringify(metadata)) as Record<string, unknown>; if (cloned.image === from) cloned.image = to; const properties = cloned.properties; if (properties && typeof properties === "object" && !Array.isArray(properties)) { const files = (properties as Record<string, unknown>).files; if (Array.isArray(files)) (properties as Record<string, unknown>).files = files.map((file) => file && typeof file === "object" && !Array.isArray(file) && (file as Record<string, unknown>).uri === from ? { ...(file as Record<string, unknown>), uri: to } : file); } return Object.freeze(cloned); }
function safeProviderMessage(text: string): string { const compact = text.replace(/\s+/g, " ").trim().slice(0, 300); return compact && !/token|jwt|authorization/i.test(compact) ? compact : "Provider rejected the request; secret material was not echoed."; }

import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { attachAuthorNftArtwork } from "./application/nft-author-artwork";
import { NftCreationOfficeService, type NftAiProposalKind } from "./application/nft-creation-office";
import { NftMarketIntelligenceService } from "./application/nft-market-intelligence";
import { createProject } from "./domain/project";
import {
  NFT_COLLECTION_TYPES,
  NFT_STORAGE_MODES,
  NFT_TOKEN_STANDARDS,
  type NftCollectionType,
  type NftLaunchPlan,
  type NftStorageMode,
  type NftTokenStandard,
  type NftTraitDefinition,
} from "./domain/nft-creation";
import { discoverConfiguredAiModelResources } from "./infrastructure/ai-model-resources";
import { FileNftCreationStore } from "./infrastructure/file-nft-creation-store";
import { FileProjectStore } from "./infrastructure/file-project-store";
import { createForgeStudioRuntime } from "./infrastructure/forge-studio-runtime";
import type { ImageGenerationQuality, ImageGenerationSize } from "./infrastructure/image-provider";

const port = Number(process.env.NFT_PORT ?? process.env.PORT ?? 4573);
const host = process.env.HOST ?? "127.0.0.1";
const dataRoot = process.env.FORGE_DATA_DIR ?? join(process.cwd(), ".forge-data");
const publicRoot = join(process.cwd(), "public");
const runtime = createForgeStudioRuntime(dataRoot);
// createForgeStudioRuntime composes this exact concrete adapter in production.
const projects = runtime.projectStore as FileProjectStore;
const nftStore = new FileNftCreationStore(join(dataRoot, "nft-creation.json"));
const office = new NftCreationOfficeService(nftStore, projects);
const market = new NftMarketIntelligenceService(projects);

function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(JSON.stringify(value));
}
async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of req) {
    raw += String(chunk);
    if (raw.length > 12 * 1024 * 1024) throw new Error("NFT Creation request body exceeds 12 MiB.");
  }
  if (!raw.trim()) return {};
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("NFT Creation JSON object body required.");
  return parsed as Record<string, unknown>;
}
function required(value: unknown, label: string): string { if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`); return value.trim(); }
function projectIdFrom(pathname: string): string | null { return pathname.match(/^\/api\/projects\/([A-Za-z0-9_-]+)(?:\/|$)/)?.[1] ?? null; }
function enumValue<T extends string>(value: unknown, values: readonly T[], label: string): T { if (typeof value !== "string" || !values.includes(value as T)) throw new Error(`Invalid ${label}.`); return value as T; }
function proposalKind(value: unknown): NftAiProposalKind { return enumValue(value, ["collection-strategy", "trait-system", "launch-strategy", "copy"] as const, "NFT AI proposal kind"); }
function tokenStandard(value: unknown): NftTokenStandard { return enumValue(value, NFT_TOKEN_STANDARDS, "NFT token standard"); }
function collectionType(value: unknown): NftCollectionType { return enumValue(value, NFT_COLLECTION_TYPES, "NFT collection type"); }
function storageMode(value: unknown): NftStorageMode { return enumValue(value, NFT_STORAGE_MODES, "NFT storage mode"); }
function aiStatus() {
  const resources = discoverConfiguredAiModelResources(process.env);
  return { configured: resources.length > 0, resources: resources.map((resource) => ({ provider: resource.provider, model: resource.model, billingClass: resource.billingClass, capabilities: resource.capabilities })) };
}

async function handleApi(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
  if (url.pathname === "/api/health" && req.method === "GET") {
    json(res, 200, { ok: true, service: "authors-forge-nft-creation-office", tokenStandards: NFT_TOKEN_STANDARDS, collectionTypes: NFT_COLLECTION_TYPES, storageModes: NFT_STORAGE_MODES, sharedDataRoot: dataRoot, mainStudioPort: Number(process.env.FORGE_STUDIO_PORT ?? 4173), ai: aiStatus() });
    return true;
  }
  if (url.pathname === "/api/projects" && req.method === "POST") {
    const input = await body(req);
    const project = createProject({ id: required(input.id, "Project id"), title: required(input.title, "Project title") });
    await projects.create(project);
    json(res, 201, project);
    return true;
  }
  const forgeProjectId = projectIdFrom(url.pathname);
  if (!forgeProjectId) return false;
  const forgeProject = await projects.load(forgeProjectId);
  if (!forgeProject) { json(res, 404, { error: "Forge project not found." }); return true; }
  if (url.pathname === `/api/projects/${forgeProjectId}` && req.method === "GET") {
    json(res, 200, forgeProject);
    return true;
  }

  if (url.pathname === `/api/projects/${forgeProjectId}/nft` && req.method === "GET") {
    json(res, 200, { project: forgeProject.metadata, collections: await office.list(forgeProjectId), ai: aiStatus() });
    return true;
  }
  if (url.pathname === `/api/projects/${forgeProjectId}/nft` && req.method === "POST") {
    const input = await body(req);
    const created = await office.create({
      id: typeof input.id === "string" && input.id.trim() ? input.id.trim() : `nft-${randomUUID()}`,
      forgeProjectId,
      title: required(input.title, "NFT collection title"),
      symbol: required(input.symbol, "NFT collection symbol"),
      description: required(input.description, "NFT collection description"),
      collectionType: collectionType(input.collectionType),
      tokenStandard: tokenStandard(input.tokenStandard),
      chain: required(input.chain, "NFT chain"),
      supply: Number(input.supply),
      seed: typeof input.seed === "string" ? input.seed : undefined,
      royaltyBps: input.royaltyBps === undefined ? undefined : Number(input.royaltyBps),
      storageMode: input.storageMode === undefined ? undefined : storageMode(input.storageMode),
      externalUrl: typeof input.externalUrl === "string" ? input.externalUrl : undefined,
      audience: typeof input.audience === "string" ? input.audience : undefined,
      artisticThesis: typeof input.artisticThesis === "string" ? input.artisticThesis : undefined,
      styleGuide: typeof input.styleGuide === "string" ? input.styleGuide : undefined,
      lore: typeof input.lore === "string" ? input.lore : undefined,
      rightsNote: typeof input.rightsNote === "string" ? input.rightsNote : undefined,
    });
    json(res, 201, created);
    return true;
  }

  const match = url.pathname.match(new RegExp(`^/api/projects/${forgeProjectId}/nft/([^/]+)(?:/(.*))?$`));
  if (!match) return false;
  const collectionId = decodeURIComponent(match[1]);
  const tail = match[2] ?? "";
  const current = await office.get(forgeProjectId, collectionId);
  if (!current) { json(res, 404, { error: "NFT collection not found." }); return true; }

  if (!tail && req.method === "GET") { json(res, 200, current); return true; }
  if (tail === "traits" && req.method === "PUT") {
    const input = await body(req);
    if (!Array.isArray(input.traits)) throw new Error("NFT traits array is required.");
    json(res, 200, await office.setTraits(forgeProjectId, collectionId, input.traits as unknown as NftTraitDefinition[]));
    return true;
  }
  if (tail === "manifest" && req.method === "POST") { json(res, 201, await office.generateManifest(forgeProjectId, collectionId)); return true; }
  if (tail === "launch-plan" && req.method === "PUT") {
    const input = await body(req);
    if (!input.launchPlan || typeof input.launchPlan !== "object" || Array.isArray(input.launchPlan)) throw new Error("NFT launchPlan object is required.");
    json(res, 200, await office.setLaunchPlan(forgeProjectId, collectionId, input.launchPlan as unknown as NftLaunchPlan));
    return true;
  }
  if (tail === "market-research" && req.method === "POST") {
    const input = await body(req);
    json(res, 201, await market.research(current, typeof input.focus === "string" ? input.focus : undefined));
    return true;
  }
  if (tail === "preflight" && (req.method === "GET" || req.method === "POST")) { json(res, 200, await office.preflight(forgeProjectId, collectionId)); return true; }
  if (tail === "launch-package" && req.method === "POST") { json(res, 201, await office.launchPackage(forgeProjectId, collectionId)); return true; }
  if (tail === "ai/propose" && req.method === "POST") {
    const input = await body(req);
    json(res, 201, await office.propose(forgeProjectId, collectionId, proposalKind(input.kind), required(input.instruction, "NFT AI instruction")));
    return true;
  }
  const proposalReview = tail.match(/^ai\/proposals\/([^/]+)\/(approve|reject)$/);
  if (proposalReview && req.method === "POST") {
    const input = await body(req);
    const decision = proposalReview[2] === "approve" ? "approved" : "rejected";
    json(res, 200, await office.reviewProposal(forgeProjectId, collectionId, decodeURIComponent(proposalReview[1]), decision, input.apply === true));
    return true;
  }
  const authorArtwork = tail.match(/^art\/([^/]+)\/author$/);
  if (authorArtwork && req.method === "POST") {
    const input = await body(req);
    json(res, 200, await attachAuthorNftArtwork(nftStore, projects, forgeProjectId, collectionId, decodeURIComponent(authorArtwork[1]), {
      imageUri: required(input.imageUri, "NFT artwork URI"),
      animationUrl: typeof input.animationUrl === "string" && input.animationUrl.trim() ? input.animationUrl.trim() : undefined,
      sourceReference: required(input.sourceReference, "NFT artwork source reference"),
      authorDeclaresRights: input.authorDeclaresRights === true ? true : (() => { throw new Error("Explicit author rights/provenance declaration is required."); })(),
    }));
    return true;
  }
  const artworkGenerate = tail.match(/^art\/([^/]+)\/generate$/);
  if (artworkGenerate && req.method === "POST") {
    const input = await body(req);
    json(res, 201, await office.generateArtwork(forgeProjectId, collectionId, decodeURIComponent(artworkGenerate[1]), {
      instruction: typeof input.instruction === "string" ? input.instruction : undefined,
      size: typeof input.size === "string" ? input.size as ImageGenerationSize : undefined,
      quality: typeof input.quality === "string" ? input.quality as ImageGenerationQuality : undefined,
    }));
    return true;
  }
  const artworkReview = tail.match(/^art\/([^/]+)\/([^/]+)\/(approve|reject)$/);
  if (artworkReview && req.method === "POST") {
    const decision = artworkReview[3] === "approve" ? "approved" : "rejected";
    json(res, 200, await office.reviewArtwork(forgeProjectId, collectionId, decodeURIComponent(artworkReview[1]), decodeURIComponent(artworkReview[2]), decision));
    return true;
  }
  return false;
}

const mimeTypes: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
};

async function serveStatic(res: ServerResponse, pathname: string): Promise<void> {
  const requested = pathname === "/" ? "/nft-creation.html" : pathname;
  const relative = normalize(decodeURIComponent(requested)).replace(/^([/\\])+/, "");
  const filePath = join(publicRoot, relative);
  if (!filePath.startsWith(publicRoot)) { json(res, 403, { error: "Forbidden." }); return; }
  try {
    const bytes = await readFile(filePath);
    res.writeHead(200, { "content-type": mimeTypes[extname(filePath).toLowerCase()] ?? "application/octet-stream", "cache-control": "no-store", "x-content-type-options": "nosniff" });
    res.end(bytes);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ENOENT") { json(res, 404, { error: "Not found." }); return; }
    throw error;
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? `${host}:${port}`}`);
    if (url.pathname.startsWith("/api/")) {
      if (!(await handleApi(req, res, url))) json(res, 404, { error: "NFT Creation API route not found." });
      return;
    }
    await serveStatic(res, url.pathname);
  } catch (error) {
    json(res, 400, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(port, host, () => console.log(`Author's Forge NFT Creation Office: http://${host}:${port}`));

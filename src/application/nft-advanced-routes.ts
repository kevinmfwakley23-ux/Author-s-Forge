import type { IncomingMessage, ServerResponse } from "node:http";
import type { CreateNftSeriesInput, NftSeriesRules, NftSeriesSet } from "../domain/nft-series-director";
import type { FileNftCreationStore } from "../infrastructure/file-nft-creation-store";
import type { NftSeriesDirectorService } from "./nft-series-director";
import type { NftStoragePublisherService } from "./nft-storage-publisher";

export type NftAdvancedRouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL, forgeProjectId: string) => Promise<boolean>;

export function createNftAdvancedRoutes(
  series: NftSeriesDirectorService,
  nftStore: FileNftCreationStore,
  storage: NftStoragePublisherService,
): NftAdvancedRouteHandler {
  return async (req, res, url, forgeProjectId) => {
    if (url.pathname === `/api/projects/${forgeProjectId}/nft-series` && req.method === "GET") {
      json(res, 200, await series.list(forgeProjectId));
      return true;
    }
    if (url.pathname === `/api/projects/${forgeProjectId}/nft-series` && req.method === "POST") {
      const input = await body(req);
      json(res, 201, await series.create({
        id: typeof input.id === "string" && input.id.trim() ? input.id.trim() : `series-${Date.now()}`,
        forgeProjectId,
        title: required(input.title, "NFT series title"),
        thesis: text(input.thesis),
        audience: text(input.audience),
        collectionIds: strings(input.collectionIds),
        sets: Array.isArray(input.sets) ? input.sets as unknown as NftSeriesSet[] : [],
        rules: rules(input.rules),
      }));
      return true;
    }

    const seriesMatch = url.pathname.match(new RegExp(`^/api/projects/${forgeProjectId}/nft-series/([^/]+)(?:/(qa|provenance))?$`));
    if (seriesMatch) {
      const seriesId = decodeURIComponent(seriesMatch[1]);
      const tail = seriesMatch[2] ?? "";
      if (!tail && req.method === "GET") {
        const value = await series.get(forgeProjectId, seriesId);
        json(res, value ? 200 : 404, value ?? { error: "NFT series not found." });
        return true;
      }
      if (!tail && req.method === "PUT") {
        const input = await body(req);
        const patch: Partial<Omit<CreateNftSeriesInput, "id" | "forgeProjectId" | "now">> = {};
        if (input.title !== undefined) patch.title = required(input.title, "NFT series title");
        if (input.thesis !== undefined) patch.thesis = text(input.thesis) ?? "";
        if (input.audience !== undefined) patch.audience = text(input.audience) ?? "";
        if (input.collectionIds !== undefined) patch.collectionIds = strings(input.collectionIds);
        if (input.sets !== undefined) {
          if (!Array.isArray(input.sets)) throw new Error("NFT series sets must be an array.");
          patch.sets = input.sets as unknown as NftSeriesSet[];
        }
        if (input.rules !== undefined) patch.rules = rules(input.rules);
        json(res, 200, await series.update(forgeProjectId, seriesId, patch));
        return true;
      }
      if (tail === "qa" && (req.method === "GET" || req.method === "POST")) {
        json(res, 200, await series.qa(forgeProjectId, seriesId));
        return true;
      }
      if (tail === "provenance" && (req.method === "GET" || req.method === "POST")) {
        json(res, 200, await series.provenanceBundle(forgeProjectId, seriesId));
        return true;
      }
    }

    const storageMatch = url.pathname.match(new RegExp(`^/api/projects/${forgeProjectId}/nft/([^/]+)/storage/(plan|publish)$`));
    if (storageMatch && req.method === "POST") {
      const collectionId = decodeURIComponent(storageMatch[1]);
      const collection = await nftStore.get(forgeProjectId, collectionId);
      if (!collection) { json(res, 404, { error: "NFT collection not found." }); return true; }
      const input = await body(req);
      const options = {
        execute: storageMatch[2] === "publish",
        confirmExternalPublish: input.confirmExternalPublish === true,
        confirmLargeBatch: input.confirmLargeBatch === true,
        maxItems: input.maxItems === undefined ? undefined : Number(input.maxItems),
      };
      const value = storageMatch[2] === "plan" ? storage.plan(collection, options) : await storage.publish(collection, options);
      json(res, storageMatch[2] === "plan" ? 200 : 201, value);
      return true;
    }
    return false;
  };
}

function rules(value: unknown): Partial<NftSeriesRules> | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("NFT series rules must be an object.");
  const input = value as Record<string, unknown>;
  return {
    ...(input.sharedStylePrinciples === undefined ? {} : { sharedStylePrinciples: strings(input.sharedStylePrinciples) }),
    ...(input.sharedLoreRules === undefined ? {} : { sharedLoreRules: strings(input.sharedLoreRules) }),
    ...(input.provenanceRequirements === undefined ? {} : { provenanceRequirements: strings(input.provenanceRequirements) }),
    ...(input.minimumDaysBetweenDrops === undefined ? {} : { minimumDaysBetweenDrops: Number(input.minimumDaysBetweenDrops) }),
    ...(input.maxConcurrentLaunches === undefined ? {} : { maxConcurrentLaunches: Number(input.maxConcurrentLaunches) }),
  };
}
function strings(value: unknown): string[] { if (value === undefined) return []; if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw new Error("Expected an array of strings."); return value.map((item) => String(item).trim()).filter(Boolean); }
function text(value: unknown): string | undefined { if (value === undefined || value === null || value === "") return undefined; if (typeof value !== "string") throw new Error("Expected text value."); return value.trim(); }
function required(value: unknown, label: string): string { const output = text(value); if (!output) throw new Error(`${label} is required.`); return output; }
async function body(req: IncomingMessage): Promise<Record<string, unknown>> { let raw = ""; for await (const chunk of req) { raw += String(chunk); if (raw.length > 8 * 1024 * 1024) throw new Error("NFT advanced request body exceeds 8 MiB."); } if (!raw.trim()) return {}; const value = JSON.parse(raw) as unknown; if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("NFT advanced JSON object body required."); return value as Record<string, unknown>; }
function json(res: ServerResponse, status: number, value: unknown): void { res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" }); res.end(JSON.stringify(value)); }

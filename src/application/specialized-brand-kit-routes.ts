import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import { createBrandKit, auditBrandCompliance, proposeBrandApplication, validateBrandKit, type BrandKit } from "../domain/brand-kit";
import type { FileBrandKitStore } from "../infrastructure/file-brand-kit-store";
import type { FileSpecializedCreationStore } from "../infrastructure/file-specialized-creation-store";
import { FileSpecializedDesignTemplateStore } from "../infrastructure/file-specialized-design-template-store";
import { createSpecializedDesignTemplateRoutes } from "./specialized-design-template-routes";
import {
  CREATIVE_TARGET_PRESETS,
  createMultiTargetReflowProposal,
  validateCreativeTargetSpec,
  type CreativeTargetSpec,
} from "./specialized-creation-multi-target-reflow";

export type SpecializedBrandKitRouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL, forgeProjectId: string) => Promise<boolean>;

export function createSpecializedBrandKitRoutes(
  brandKits: FileBrandKitStore,
  specialized: FileSpecializedCreationStore,
  designTemplates: FileSpecializedDesignTemplateStore = new FileSpecializedDesignTemplateStore(
    join(process.env.FORGE_DATA_DIR ?? join(process.cwd(), ".forge-data"), "specialized-design-templates.json"),
  ),
): SpecializedBrandKitRouteHandler {
  const designTemplateRoutes = createSpecializedDesignTemplateRoutes(
    designTemplates,
    specialized,
    brandKits,
  );

  return async (req, res, url, forgeProjectId) => {
    if (await designTemplateRoutes(req, res, url, forgeProjectId)) return true;

    const root = `/api/projects/${forgeProjectId}/brand-kits`;

    if (url.pathname === root && req.method === "GET") {
      json(res, 200, { kits: await brandKits.list(forgeProjectId), creativeTargetPresets: CREATIVE_TARGET_PRESETS });
      return true;
    }
    if (url.pathname === root && req.method === "POST") {
      const input = await body(req);
      const kit = createBrandKit({
        id: optionalId(input.id) ?? `brand-${randomUUID()}`,
        forgeProjectId,
        name: required(input.name, "Brand Kit name"),
        ...(optional(input.description) ? { description: optional(input.description) } : {}),
        colors: arrayOrEmpty(input.colors) as BrandKit["colors"],
        fonts: arrayOrEmpty(input.fonts) as BrandKit["fonts"],
        assets: arrayOrEmpty(input.assets) as BrandKit["assets"],
        voice: objectOrEmpty(input.voice) as Partial<BrandKit["voice"]>,
        guidelines: arrayOrEmpty(input.guidelines).map(String),
        restrictions: objectOrEmpty(input.restrictions) as Partial<BrandKit["restrictions"]>,
        now: optional(input.now),
      });
      json(res, 201, await brandKits.create(kit));
      return true;
    }

    const match = url.pathname.match(new RegExp(`^${escapeRegex(root)}/([^/]+)(?:/(audit|propose-application|multi-target-reflow))?$`));
    if (!match) return false;
    const kitId = decodeURIComponent(match[1]);
    const action = match[2] ?? "";
    const kit = await brandKits.get(forgeProjectId, kitId);
    if (!kit) throw new Error(`Brand Kit "${kitId}" not found.`);

    if (!action && req.method === "GET") { json(res, 200, kit); return true; }
    if (!action && req.method === "PUT") {
      const input = await body(req);
      const now = optional(input.now) ?? new Date().toISOString();
      const updated = validateBrandKit({
        ...kit,
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description || undefined } : {}),
        ...(input.colors !== undefined ? { colors: input.colors } : {}),
        ...(input.fonts !== undefined ? { fonts: input.fonts } : {}),
        ...(input.assets !== undefined ? { assets: input.assets } : {}),
        ...(input.voice !== undefined ? { voice: input.voice } : {}),
        ...(input.guidelines !== undefined ? { guidelines: input.guidelines } : {}),
        ...(input.restrictions !== undefined ? { restrictions: input.restrictions } : {}),
        updatedAt: now,
      });
      json(res, 200, await brandKits.save(updated));
      return true;
    }
    if (!action && req.method === "DELETE") {
      await brandKits.delete(forgeProjectId, kitId);
      json(res, 200, { deleted: true, id: kitId });
      return true;
    }

    if ((action === "audit" || action === "propose-application" || action === "multi-target-reflow") && req.method === "POST") {
      const input = await body(req);
      const specializedProjectId = required(input.specializedProjectId, "Specialized project id");
      const specializedProject = await specialized.get(forgeProjectId, specializedProjectId);
      if (!specializedProject) throw new Error(`Specialized project "${specializedProjectId}" not found.`);
      const documentId = optional(input.documentId) ?? specializedProject.documents.at(-1)?.id;
      if (!documentId) throw new Error("A saved Specialized Creation document is required for Brand Kit governance.");
      const document = specializedProject.documents.find((item) => item.id === documentId);
      if (!document) throw new Error(`Specialized document "${documentId}" not found.`);
      if (action === "audit") {
        json(res, 200, { brandKit: kit, report: auditBrandCompliance(kit, document) });
        return true;
      }
      if (action === "propose-application") {
        const proposal = proposeBrandApplication(kit, document);
        json(res, 200, {
          brandKit: kit,
          proposal,
          persisted: false,
          nextStep: "Review the candidate document. Persist it only through the existing Specialized Creation document revision endpoint after author approval.",
        });
        return true;
      }

      const targets = resolveCreativeTargets(input);
      const proposal = createMultiTargetReflowProposal({ source: document, targets, brandKit: kit });
      json(res, 200, {
        brandKit: kit,
        proposal,
        persisted: false,
        nextStep: "Review each candidate and its safe-zone/Brand Kit evidence. Persist approved documents and target production profiles only through the existing Specialized Creation save/profile endpoints.",
      });
      return true;
    }

    return false;
  };
}

function resolveCreativeTargets(input: Record<string, unknown>): CreativeTargetSpec[] {
  const requestedIds = input.targetIds;
  const customTargets = input.targets;
  if (requestedIds !== undefined && customTargets !== undefined) throw new Error("Choose targetIds or custom targets, not both.");

  if (requestedIds !== undefined) {
    if (!Array.isArray(requestedIds) || !requestedIds.length) throw new Error("targetIds must be a non-empty array.");
    const ids = [...new Set(requestedIds.map((value) => required(value, "Creative target id")))];
    return ids.map((id) => {
      const target = CREATIVE_TARGET_PRESETS.find((candidate) => candidate.id === id);
      if (!target) throw new Error(`Unknown creative target preset "${id}".`);
      return target;
    });
  }

  if (customTargets !== undefined) {
    if (!Array.isArray(customTargets) || !customTargets.length) throw new Error("targets must be a non-empty array.");
    return customTargets.map((value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Each custom creative target must be an object.");
      return validateCreativeTargetSpec(value as CreativeTargetSpec);
    });
  }

  return [...CREATIVE_TARGET_PRESETS];
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of req) {
    raw += String(chunk);
    if (raw.length > 3 * 1024 * 1024) throw new Error("Brand Kit request exceeds 3 MiB.");
  }
  if (!raw.trim()) return {};
  const value = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Brand Kit request body must be a JSON object.");
  return value as Record<string, unknown>;
}
function required(value: unknown, label: string): string { const result = String(value ?? "").trim(); if (!result) throw new Error(`${label} is required.`); return result; }
function optional(value: unknown): string | undefined { if (value === undefined || value === null) return undefined; const result = String(value).trim(); return result || undefined; }
function optionalId(value: unknown): string | undefined { const result = optional(value); if (result && !/^[A-Za-z0-9_-]+$/.test(result)) throw new Error("Brand Kit id may contain only letters, numbers, underscore, and hyphen."); return result; }
function arrayOrEmpty(value: unknown): unknown[] { if (value === undefined || value === null) return []; if (!Array.isArray(value)) throw new Error("Brand Kit collection fields must be arrays."); return value; }
function objectOrEmpty(value: unknown): Record<string, unknown> { if (value === undefined || value === null) return {}; if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Brand Kit object field is invalid."); return value as Record<string, unknown>; }
function json(res: ServerResponse, status: number, value: unknown): void { res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" }); res.end(JSON.stringify(value)); }
function escapeRegex(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

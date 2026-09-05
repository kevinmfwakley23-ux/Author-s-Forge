import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createBrandKit, validateBrandKit, type BrandKit } from "../domain/brand-kit";
import { createMemoryRecord, type MemoryRecord } from "../domain/memory";
import { withProjectMemories, type ProjectState } from "../domain/project";
import type { FileProjectStore } from "../infrastructure/file-project-store";
import type { FileBrandKitStore } from "../infrastructure/file-brand-kit-store";

const ACTIVE_BRAND_STATE_KEY = "brand.active-kit";
const BRAND_SELECTION_TAG = "brand-kit-selection";
const NO_ACTIVE_BRAND = "none";

export type StudioBrandKitRouteHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  projectId: string,
) => Promise<boolean>;

/**
 * Makes the existing validated Brand Kit domain available to the entire Studio.
 * Specialized Creation and Studio use the same FileBrandKitStore, so there is
 * one project brand source rather than separate per-office palettes.
 */
export function createStudioBrandKitRoutes(
  projects: FileProjectStore,
  brandKits: FileBrandKitStore,
): StudioBrandKitRouteHandler {
  return async (req, res, url, projectId) => {
    const root = `/api/projects/${projectId}/brand-kits`;

    if (url.pathname === root && req.method === "GET") {
      const project = await requireProject(projects, projectId);
      const kits = await brandKits.list(projectId);
      const selection = activeBrandSelection(project);
      const activeBrandKit = selection?.brandKitId
        ? kits.find((kit) => kit.id === selection.brandKitId) ?? null
        : null;
      json(res, 200, {
        kits,
        activeBrandKitId: activeBrandKit?.id ?? null,
        activeBrandKit,
        ...(activeBrandKit ? { activeGuidance: brandKitGuidance(activeBrandKit) } : {}),
      });
      return true;
    }

    if (url.pathname === root && req.method === "POST") {
      const input = await body(req);
      const kit = createBrandKit({
        id: optionalId(input.id) ?? `brand-${randomUUID()}`,
        forgeProjectId: projectId,
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

    if (url.pathname === `${root}/active` && req.method === "GET") {
      const project = await requireProject(projects, projectId);
      const selection = activeBrandSelection(project);
      if (!selection?.brandKitId) {
        json(res, 200, { activeBrandKitId: null, brandKit: null });
        return true;
      }
      const kit = await brandKits.get(projectId, selection.brandKitId);
      if (!kit) {
        json(res, 409, {
          activeBrandKitId: selection.brandKitId,
          brandKit: null,
          error: "The active Brand Kit selection references a missing kit. Choose another kit or clear the selection.",
        });
        return true;
      }
      json(res, 200, {
        activeBrandKitId: kit.id,
        brandKit: kit,
        guidance: brandKitGuidance(kit),
        selectedAt: selection.record.createdAt,
      });
      return true;
    }

    if (url.pathname === `${root}/active` && req.method === "POST") {
      const input = await body(req);
      const kitId = required(input.brandKitId, "Active Brand Kit id");
      const kit = await brandKits.get(projectId, kitId);
      if (!kit) throw new Error(`Brand Kit "${kitId}" not found.`);
      const now = timestamp(optional(input.now));
      const project = await requireProject(projects, projectId);
      const record = createBrandSelectionMemory(projectId, kit, now);
      await projects.save(withProjectMemories(project, [...project.memories, record], now));
      json(res, 200, {
        activeBrandKitId: kit.id,
        brandKit: kit,
        guidance: brandKitGuidance(kit),
        selectedAt: now,
      });
      return true;
    }

    if (url.pathname === `${root}/active` && req.method === "DELETE") {
      const input = await body(req);
      const now = timestamp(optional(input.now));
      const project = await requireProject(projects, projectId);
      const record = createMemoryRecord({
        id: `brand-kit-selection-${randomUUID()}`,
        projectId,
        class: "visual-identity",
        authority: "authoritative",
        summary: "No active project Brand Kit",
        content: JSON.stringify({ brandKitId: null, selectedAt: now }),
        provenance: [{ kind: "author", reference: "studio-brand-kit", recordedAt: now }],
        relevanceTags: [BRAND_SELECTION_TAG],
        stateKey: ACTIVE_BRAND_STATE_KEY,
        stateValue: NO_ACTIVE_BRAND,
        now,
      });
      await projects.save(withProjectMemories(project, [...project.memories, record], now));
      json(res, 200, { activeBrandKitId: null, brandKit: null, selectedAt: now });
      return true;
    }

    const match = url.pathname.match(new RegExp(`^${escapeRegex(root)}/([^/]+)$`, "u"));
    if (!match) return false;
    const kitId = decodeURIComponent(match[1]);
    const kit = await brandKits.get(projectId, kitId);
    if (!kit) throw new Error(`Brand Kit "${kitId}" not found.`);

    if (req.method === "GET") {
      json(res, 200, kit);
      return true;
    }

    if (req.method === "PUT") {
      const input = await body(req);
      const now = timestamp(optional(input.now));
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

    if (req.method === "DELETE") {
      const project = await requireProject(projects, projectId);
      const selected = activeBrandSelection(project)?.brandKitId === kitId;
      await brandKits.delete(projectId, kitId);
      if (selected) {
        const now = new Date().toISOString();
        const record = createMemoryRecord({
          id: `brand-kit-selection-${randomUUID()}`,
          projectId,
          class: "visual-identity",
          authority: "authoritative",
          summary: `Cleared deleted active Brand Kit: ${kit.name}`,
          content: JSON.stringify({ brandKitId: null, deletedBrandKitId: kitId, selectedAt: now }),
          provenance: [{ kind: "author", reference: "studio-brand-kit", recordedAt: now }],
          relevanceTags: [BRAND_SELECTION_TAG, `brand-kit:${kitId}`],
          stateKey: ACTIVE_BRAND_STATE_KEY,
          stateValue: NO_ACTIVE_BRAND,
          now,
        });
        await projects.save(withProjectMemories(project, [...project.memories, record], now));
      }
      json(res, 200, { deleted: true, id: kitId, activeSelectionCleared: selected });
      return true;
    }

    return false;
  };
}

export function brandKitGuidance(kitInput: BrandKit): string {
  const kit = validateBrandKit(kitInput);
  const colors = kit.colors.map((color) => `${color.role}: ${color.value} (${color.label})`).join("; ");
  const fonts = kit.fonts.map((font) => `${font.role}: ${font.family} [${font.weights.join(",")}]`).join("; ");
  return [
    `ACTIVE PROJECT BRAND KIT: ${kit.name} (${kit.id})`,
    kit.description ? `Description: ${kit.description}` : "",
    colors ? `Approved colors: ${colors}` : "Approved colors: none defined.",
    fonts ? `Approved fonts: ${fonts}` : "Approved fonts: none defined.",
    kit.assets.length ? `Approved brand assets: ${kit.assets.map((asset) => `${asset.role}: ${asset.assetId}${asset.label ? ` (${asset.label})` : ""}`).join("; ")}` : "Approved brand assets: none defined.",
    kit.voice.traits.length ? `Voice traits: ${kit.voice.traits.join("; ")}` : "",
    kit.voice.preferredPhrases.length ? `Preferred phrases: ${kit.voice.preferredPhrases.join("; ")}` : "",
    kit.voice.avoidedPhrases.length ? `Avoided phrases: ${kit.voice.avoidedPhrases.join("; ")}` : "",
    kit.guidelines.length ? `Brand guidelines: ${kit.guidelines.join("; ")}` : "",
    `Brand controls: enforce colors=${kit.restrictions.enforceColors}; enforce fonts=${kit.restrictions.enforceFonts}; approved assets required=${kit.restrictions.requireApprovedBrandAssets}; locked roles=${kit.restrictions.lockedElementRoles.join(",") || "none"}.`,
    "Treat this Brand Kit as author-controlled project visual/voice guidance. Do not silently mutate manuscript text or production assets; proposals still require their existing approval boundary.",
  ].filter(Boolean).join("\n");
}

function createBrandSelectionMemory(projectId: string, kit: BrandKit, now: string): MemoryRecord {
  return createMemoryRecord({
    id: `brand-kit-selection-${randomUUID()}`,
    projectId,
    class: "visual-identity",
    authority: "authoritative",
    summary: `Active project Brand Kit: ${kit.name}`,
    content: JSON.stringify({ brandKitId: kit.id, brandKitName: kit.name, selectedAt: now }),
    provenance: [{ kind: "author", reference: "studio-brand-kit", recordedAt: now }],
    relevanceTags: [BRAND_SELECTION_TAG, `brand-kit:${kit.id}`],
    stateKey: ACTIVE_BRAND_STATE_KEY,
    stateValue: kit.id,
    now,
  });
}

function activeBrandSelection(project: ProjectState): { brandKitId?: string; record: MemoryRecord } | undefined {
  const record = project.memories
    .filter((memory) => memory.stateKey === ACTIVE_BRAND_STATE_KEY && memory.relevanceTags.includes(BRAND_SELECTION_TAG))
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.createdAt.localeCompare(a.createdAt))[0];
  if (!record) return undefined;
  return {
    ...(record.stateValue && record.stateValue !== NO_ACTIVE_BRAND ? { brandKitId: record.stateValue } : {}),
    record,
  };
}

async function requireProject(projects: FileProjectStore, projectId: string): Promise<ProjectState> {
  const project = await projects.load(projectId);
  if (!project) throw new Error(`Project "${projectId}" not found.`);
  return project;
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
function optionalId(value: unknown): string | undefined { const result = optional(value); if (result && !/^[A-Za-z0-9_-]+$/u.test(result)) throw new Error("Brand Kit id may contain only letters, numbers, underscore, and hyphen."); return result; }
function arrayOrEmpty(value: unknown): unknown[] { if (value === undefined || value === null) return []; if (!Array.isArray(value)) throw new Error("Brand Kit collection fields must be arrays."); return value; }
function objectOrEmpty(value: unknown): Record<string, unknown> { if (value === undefined || value === null) return {}; if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Brand Kit object field is invalid."); return value as Record<string, unknown>; }
function timestamp(value: string | undefined): string { const result = value ?? new Date().toISOString(); if (Number.isNaN(Date.parse(result))) throw new Error("Brand Kit timestamp is invalid."); return new Date(result).toISOString(); }
function json(res: ServerResponse, status: number, value: unknown): void { res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" }); res.end(JSON.stringify(value)); }
function escapeRegex(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"); }
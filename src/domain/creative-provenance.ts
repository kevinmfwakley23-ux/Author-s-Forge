import { createHash } from "node:crypto";

export const FORGE_PROVENANCE_FORMAT_VERSION = 1 as const;
export const FORGE_PROVENANCE_HASH_ALGORITHM = "sha256" as const;

export type ProvenanceAction = "created" | "imported" | "generated" | "edited" | "reviewed" | "accepted" | "rejected" | "applied" | "exported";
export type ProvenanceSourceType = "human-created" | "human-edited" | "ai-generated" | "ai-edited" | "mixed";
export type HumanOversight = "author-directed" | "author-reviewed" | "reviewer-suggested" | "automatic";
export type ProvenanceAssetKind = "scene" | "manuscript" | "image" | "cover" | "marketing" | "journal" | "workbook" | "specialized" | "other";

export type ProvenanceActor =
  | { readonly kind: "human"; readonly role: "author" | "reviewer" | "editor" | "co-writer" | "system"; readonly id?: string; readonly displayName?: string }
  | { readonly kind: "ai"; readonly provider: string; readonly model: string; readonly requestId?: string }
  | { readonly kind: "tool"; readonly name: string; readonly version?: string };

export interface ProvenanceAssetRef {
  readonly kind: ProvenanceAssetKind;
  readonly id: string;
  readonly bookId?: string;
  readonly chapterId?: string;
  readonly sceneId?: string;
  readonly mediaType?: string;
}

export type ProvenanceRegion =
  | { readonly kind: "text"; readonly start: number; readonly end: number; readonly quoteSha256?: string }
  | { readonly kind: "rectangle"; readonly x: number; readonly y: number; readonly width: number; readonly height: number };

export interface ProvenanceRecipe {
  /** Raw prompts are intentionally not required. Default to a digest unless the author explicitly chooses to disclose prompt text elsewhere. */
  readonly promptSha256?: string;
  readonly referenceIds?: readonly string[];
  readonly seed?: string;
  readonly parameters?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface CreativeProvenanceEventInput {
  readonly id: string;
  readonly projectId: string;
  readonly action: ProvenanceAction;
  readonly sourceType: ProvenanceSourceType;
  readonly actor: ProvenanceActor;
  readonly asset: ProvenanceAssetRef;
  readonly humanOversight: HumanOversight;
  readonly createdAt?: string;
  readonly beforeSha256?: string;
  readonly afterSha256?: string;
  readonly regions?: readonly ProvenanceRegion[];
  readonly ingredients?: readonly ProvenanceAssetRef[];
  readonly recipe?: ProvenanceRecipe;
  readonly details?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface CreativeProvenanceRecord extends Omit<CreativeProvenanceEventInput, "createdAt"> {
  readonly formatVersion: typeof FORGE_PROVENANCE_FORMAT_VERSION;
  readonly createdAt: string;
  readonly previousRecordSha256: string | null;
  readonly recordSha256: string;
}

const ACTIONS: readonly ProvenanceAction[] = ["created", "imported", "generated", "edited", "reviewed", "accepted", "rejected", "applied", "exported"];
const SOURCE_TYPES: readonly ProvenanceSourceType[] = ["human-created", "human-edited", "ai-generated", "ai-edited", "mixed"];
const OVERSIGHT: readonly HumanOversight[] = ["author-directed", "author-reviewed", "reviewer-suggested", "automatic"];
const ASSET_KINDS: readonly ProvenanceAssetKind[] = ["scene", "manuscript", "image", "cover", "marketing", "journal", "workbook", "specialized", "other"];
const SHA256 = /^[a-f0-9]{64}$/;

export function sha256Text(value: string): string {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

export function createCreativeProvenanceRecord(input: CreativeProvenanceEventInput, previousRecordSha256: string | null): CreativeProvenanceRecord {
  const normalized = validateCreativeProvenanceInput(input);
  if (previousRecordSha256 !== null && !SHA256.test(previousRecordSha256)) throw new Error("Previous provenance record hash is invalid.");
  const payload = {
    formatVersion: FORGE_PROVENANCE_FORMAT_VERSION,
    ...normalized,
    previousRecordSha256,
  };
  const recordSha256 = sha256Text(stableJson(payload));
  return { ...payload, recordSha256 };
}

export function validateCreativeProvenanceRecord(value: unknown): CreativeProvenanceRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid creative provenance record.");
  const candidate = value as CreativeProvenanceRecord;
  if (candidate.formatVersion !== FORGE_PROVENANCE_FORMAT_VERSION) throw new Error("Unsupported creative provenance record format.");
  const normalized = validateCreativeProvenanceInput(candidate);
  if (candidate.previousRecordSha256 !== null && !SHA256.test(String(candidate.previousRecordSha256))) throw new Error("Creative provenance previous-record hash is invalid.");
  if (!SHA256.test(String(candidate.recordSha256))) throw new Error("Creative provenance record hash is invalid.");
  const expected = sha256Text(stableJson({ formatVersion: FORGE_PROVENANCE_FORMAT_VERSION, ...normalized, previousRecordSha256: candidate.previousRecordSha256 }));
  if (expected !== candidate.recordSha256) throw new Error(`Creative provenance record "${candidate.id}" failed integrity verification.`);
  return { formatVersion: FORGE_PROVENANCE_FORMAT_VERSION, ...normalized, previousRecordSha256: candidate.previousRecordSha256, recordSha256: candidate.recordSha256 };
}

export function verifyCreativeProvenanceChain(records: readonly CreativeProvenanceRecord[]): { valid: boolean; recordCount: number; headSha256: string | null; error?: string } {
  let previous: string | null = null;
  try {
    for (const raw of records) {
      const record = validateCreativeProvenanceRecord(raw);
      if (record.previousRecordSha256 !== previous) throw new Error(`Creative provenance chain breaks at record "${record.id}".`);
      previous = record.recordSha256;
    }
    return { valid: true, recordCount: records.length, headSha256: previous };
  } catch (error) {
    return { valid: false, recordCount: records.length, headSha256: previous, error: error instanceof Error ? error.message : String(error) };
  }
}

export function c2paMappingHint(record: CreativeProvenanceRecord) {
  const action = record.action === "created" || record.action === "generated" ? "c2pa.created" : record.action === "imported" ? "c2pa.opened" : "c2pa.edited";
  return {
    action,
    digitalSourceType: record.sourceType,
    aiDisclosure: record.actor.kind === "ai" ? { provider: record.actor.provider, model: record.actor.model, humanOversight: record.humanOversight } : undefined,
    regions: record.regions ?? [],
    recipe: record.recipe,
  };
}

export function stableJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== "object") return value;
  const source = value as Record<string, unknown>;
  return Object.fromEntries(Object.keys(source).sort().filter((key) => source[key] !== undefined).map((key) => [key, sortValue(source[key])]));
}

function validateCreativeProvenanceInput(input: CreativeProvenanceEventInput): Required<Pick<CreativeProvenanceEventInput, "id" | "projectId" | "action" | "sourceType" | "actor" | "asset" | "humanOversight">> & Omit<CreativeProvenanceEventInput, "id" | "projectId" | "action" | "sourceType" | "actor" | "asset" | "humanOversight"> & { createdAt: string } {
  const id = identifier(input.id, "Provenance record id");
  const projectId = identifier(input.projectId, "Provenance project id");
  const action = allowed(input.action, ACTIONS, "provenance action");
  const sourceType = allowed(input.sourceType, SOURCE_TYPES, "provenance source type");
  const humanOversight = allowed(input.humanOversight, OVERSIGHT, "human oversight mode");
  const createdAt = input.createdAt ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(createdAt))) throw new Error("Provenance timestamp is invalid.");
  const actor = validateActor(input.actor);
  const asset = validateAsset(input.asset);
  const beforeSha256 = optionalHash(input.beforeSha256, "before content hash");
  const afterSha256 = optionalHash(input.afterSha256, "after content hash");
  const regions = input.regions?.map(validateRegion);
  const ingredients = input.ingredients?.map(validateAsset);
  const recipe = input.recipe ? validateRecipe(input.recipe) : undefined;
  const details = input.details ? validateScalarMap(input.details, "provenance details") : undefined;
  return { id, projectId, action, sourceType, actor, asset, humanOversight, createdAt, ...(beforeSha256 ? { beforeSha256 } : {}), ...(afterSha256 ? { afterSha256 } : {}), ...(regions?.length ? { regions } : {}), ...(ingredients?.length ? { ingredients } : {}), ...(recipe ? { recipe } : {}), ...(details ? { details } : {}) };
}

function validateActor(actor: ProvenanceActor): ProvenanceActor {
  if (!actor || typeof actor !== "object") throw new Error("Provenance actor is required.");
  if (actor.kind === "human") {
    const roles = ["author", "reviewer", "editor", "co-writer", "system"] as const;
    return { kind: "human", role: allowed(actor.role, roles, "human provenance role"), ...(actor.id ? { id: identifier(actor.id, "Human actor id") } : {}), ...(actor.displayName ? { displayName: bounded(actor.displayName, "Human display name", 160) } : {}) };
  }
  if (actor.kind === "ai") return { kind: "ai", provider: bounded(actor.provider, "AI provider", 160), model: bounded(actor.model, "AI model", 240), ...(actor.requestId ? { requestId: bounded(actor.requestId, "AI request id", 512) } : {}) };
  if (actor.kind === "tool") return { kind: "tool", name: bounded(actor.name, "Tool name", 160), ...(actor.version ? { version: bounded(actor.version, "Tool version", 80) } : {}) };
  throw new Error("Invalid provenance actor kind.");
}

function validateAsset(asset: ProvenanceAssetRef): ProvenanceAssetRef {
  if (!asset || typeof asset !== "object") throw new Error("Provenance asset reference is required.");
  return {
    kind: allowed(asset.kind, ASSET_KINDS, "provenance asset kind"), id: identifier(asset.id, "Provenance asset id"),
    ...(asset.bookId ? { bookId: identifier(asset.bookId, "Provenance book id") } : {}),
    ...(asset.chapterId ? { chapterId: identifier(asset.chapterId, "Provenance chapter id") } : {}),
    ...(asset.sceneId ? { sceneId: identifier(asset.sceneId, "Provenance scene id") } : {}),
    ...(asset.mediaType ? { mediaType: bounded(asset.mediaType, "Provenance media type", 160) } : {}),
  };
}

function validateRegion(region: ProvenanceRegion): ProvenanceRegion {
  if (!region || typeof region !== "object") throw new Error("Invalid provenance region.");
  if (region.kind === "text") {
    if (!Number.isInteger(region.start) || !Number.isInteger(region.end) || region.start < 0 || region.end <= region.start) throw new Error("Invalid text provenance region.");
    return { kind: "text", start: region.start, end: region.end, ...(region.quoteSha256 ? { quoteSha256: requiredHash(region.quoteSha256, "region quote hash") } : {}) };
  }
  if (region.kind === "rectangle") {
    for (const value of [region.x, region.y, region.width, region.height]) if (!Number.isFinite(value) || value < 0) throw new Error("Invalid rectangle provenance region.");
    if (region.width <= 0 || region.height <= 0) throw new Error("Rectangle provenance region dimensions must be positive.");
    return { kind: "rectangle", x: region.x, y: region.y, width: region.width, height: region.height };
  }
  throw new Error("Unknown provenance region kind.");
}

function validateRecipe(recipe: ProvenanceRecipe): ProvenanceRecipe {
  return {
    ...(recipe.promptSha256 ? { promptSha256: requiredHash(recipe.promptSha256, "prompt hash") } : {}),
    ...(recipe.referenceIds?.length ? { referenceIds: recipe.referenceIds.map((id) => identifier(id, "Recipe reference id")) } : {}),
    ...(recipe.seed ? { seed: bounded(recipe.seed, "Recipe seed", 256) } : {}),
    ...(recipe.parameters ? { parameters: validateScalarMap(recipe.parameters, "recipe parameters") } : {}),
  };
}

function validateScalarMap(value: Readonly<Record<string, string | number | boolean | null>>, label: string): Readonly<Record<string, string | number | boolean | null>> {
  const entries = Object.entries(value);
  if (entries.length > 64) throw new Error(`${label} exceeds 64 entries.`);
  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, raw] of entries) {
    const cleanKey = bounded(key, `${label} key`, 120);
    if (typeof raw === "string") result[cleanKey] = raw.length > 4_000 ? raw.slice(0, 4_000) : raw;
    else if (typeof raw === "number" && Number.isFinite(raw)) result[cleanKey] = raw;
    else if (typeof raw === "boolean" || raw === null) result[cleanKey] = raw;
    else throw new Error(`${label} contains a non-scalar value.`);
  }
  return result;
}

function requiredHash(value: string, label: string): string { const hash = String(value).trim().toLowerCase(); if (!SHA256.test(hash)) throw new Error(`Invalid ${label}.`); return hash; }
function optionalHash(value: string | undefined, label: string): string | undefined { return value ? requiredHash(value, label) : undefined; }
function identifier(value: unknown, label: string): string { const text = String(value ?? ""); if (!text || text !== text.trim() || text.length > 512) throw new Error(`${label} is required, trimmed, and at most 512 characters.`); return text; }
function bounded(value: unknown, label: string, max: number): string { const text = String(value ?? "").trim(); if (!text) throw new Error(`${label} is required.`); if (text.length > max) throw new Error(`${label} exceeds ${max} characters.`); return text; }
function allowed<T extends string>(value: unknown, values: readonly T[], label: string): T { if (typeof value !== "string" || !values.includes(value as T)) throw new Error(`Invalid ${label}.`); return value as T; }

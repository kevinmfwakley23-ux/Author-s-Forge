export const ILLUSTRATION_ASSET_LIBRARY_FORMAT_VERSION = 1 as const;
export const ILLUSTRATION_APPROVAL_STATUSES = ["draft", "pending", "approved", "rejected"] as const;
export type IllustrationApprovalStatus = typeof ILLUSTRATION_APPROVAL_STATUSES[number];

export interface IllustrationAssetReference { readonly id: string; readonly uri: string; readonly label: string; readonly kind: "source" | "character" | "location" | "style" | "pose" | "other"; readonly notes: string; }
export type IllustrationGenerationSettingValue = string | number | boolean;
export interface IllustrationAsset {
  readonly formatVersion: typeof ILLUSTRATION_ASSET_LIBRARY_FORMAT_VERSION;
  readonly id: string;
  readonly projectId: string;
  readonly bookId: string;
  readonly chapterId: string;
  readonly sceneId: string;
  readonly characterId: string;
  readonly locationId: string;
  readonly prompt: string;
  readonly references: readonly IllustrationAssetReference[];
  readonly style: string;
  readonly generationSettings: Readonly<Record<string, IllustrationGenerationSettingValue>>;
  readonly version: number;
  readonly date: string;
  readonly approvalStatus: IllustrationApprovalStatus;
  readonly assetUri: string;
  readonly reusedFromAssetId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CharacterDesignLock {
  readonly id: string;
  readonly projectId: string;
  readonly seriesId: string;
  readonly characterId: string;
  readonly assetId: string;
  readonly effectiveAt: string;
  readonly reason: string;
  readonly createdAt: string;
  readonly active: boolean;
}

export interface IllustrationAssetLibraryState {
  readonly formatVersion: typeof ILLUSTRATION_ASSET_LIBRARY_FORMAT_VERSION;
  readonly projectId: string;
  readonly assets: readonly IllustrationAsset[];
  readonly characterDesignLocks: readonly CharacterDesignLock[];
}

export interface CreateIllustrationAssetInput {
  readonly id: string; readonly projectId: string; readonly bookId: string; readonly chapterId: string; readonly sceneId: string;
  readonly characterId: string; readonly locationId: string; readonly prompt: string; readonly references: readonly IllustrationAssetReference[];
  readonly style: string; readonly generationSettings: Readonly<Record<string, IllustrationGenerationSettingValue>>; readonly version?: number;
  readonly date?: string; readonly approvalStatus?: IllustrationApprovalStatus; readonly assetUri: string; readonly reusedFromAssetId?: string; readonly now?: string;
}

export interface UpdateIllustrationAssetInput {
  readonly id: string;
  readonly prompt?: string;
  readonly references?: readonly IllustrationAssetReference[];
  readonly style?: string;
  readonly generationSettings?: Readonly<Record<string, IllustrationGenerationSettingValue>>;
  readonly approvalStatus?: IllustrationApprovalStatus;
  readonly assetUri?: string;
  readonly version?: number;
  readonly date?: string;
  readonly now?: string;
}

export interface CreateCharacterDesignLockInput { readonly id: string; readonly projectId: string; readonly seriesId: string; readonly characterId: string; readonly assetId: string; readonly effectiveAt?: string; readonly reason: string; readonly createdAt?: string; }

export function createIllustrationAsset(input: CreateIllustrationAssetInput): IllustrationAsset {
  const now = timestamp(input.now ?? new Date().toISOString(), "Illustration asset timestamp");
  const asset: IllustrationAsset = {
    formatVersion: ILLUSTRATION_ASSET_LIBRARY_FORMAT_VERSION, id: identifier(input.id, "Illustration asset id"), projectId: identifier(input.projectId, "Illustration asset project id"),
    bookId: identifier(input.bookId, "Illustration asset book id"), chapterId: identifier(input.chapterId, "Illustration asset chapter id"), sceneId: identifier(input.sceneId, "Illustration asset scene id"),
    characterId: identifier(input.characterId, "Illustration asset character id"), locationId: identifier(input.locationId, "Illustration asset location id"), prompt: text(input.prompt, "Illustration asset prompt"),
    references: normalizeReferences(input.references), style: text(input.style, "Illustration asset style"), generationSettings: normalizeSettings(input.generationSettings),
    version: positiveInteger(input.version ?? 1, "Illustration asset version"), date: timestamp(input.date ?? now, "Illustration asset date"), approvalStatus: approval(input.approvalStatus ?? "draft"),
    assetUri: text(input.assetUri, "Illustration asset URI"), ...(input.reusedFromAssetId === undefined ? {} : { reusedFromAssetId: identifier(input.reusedFromAssetId, "Reused illustration asset id") }), createdAt: now, updatedAt: now
  };
  return cloneAsset(asset);
}

export function updateIllustrationAsset(asset: IllustrationAsset, input: UpdateIllustrationAssetInput): IllustrationAsset {
  if (asset.id !== input.id) throw new Error("Illustration asset update id does not match the asset.");
  const updatedAt = timestamp(input.now ?? new Date().toISOString(), "Illustration asset update timestamp");
  const next: IllustrationAsset = { ...asset, ...(input.prompt === undefined ? {} : { prompt: text(input.prompt, "Illustration asset prompt") }), ...(input.references === undefined ? {} : { references: normalizeReferences(input.references) }), ...(input.style === undefined ? {} : { style: text(input.style, "Illustration asset style") }), ...(input.generationSettings === undefined ? {} : { generationSettings: normalizeSettings(input.generationSettings) }), ...(input.approvalStatus === undefined ? {} : { approvalStatus: approval(input.approvalStatus) }), ...(input.assetUri === undefined ? {} : { assetUri: text(input.assetUri, "Illustration asset URI") }), ...(input.version === undefined ? {} : { version: positiveInteger(input.version, "Illustration asset version") }), ...(input.date === undefined ? {} : { date: timestamp(input.date, "Illustration asset date") }), updatedAt };
  if (JSON.stringify(asset) === JSON.stringify(next)) throw new Error("Illustration asset update does not change the asset.");
  return cloneAsset(next);
}

export function createCharacterDesignLock(input: CreateCharacterDesignLockInput): CharacterDesignLock {
  const createdAt = timestamp(input.createdAt ?? new Date().toISOString(), "Character design lock createdAt");
  return { id: identifier(input.id, "Character design lock id"), projectId: identifier(input.projectId, "Character design lock project id"), seriesId: identifier(input.seriesId, "Character design lock series id"), characterId: identifier(input.characterId, "Character design lock character id"), assetId: identifier(input.assetId, "Character design lock asset id"), effectiveAt: timestamp(input.effectiveAt ?? createdAt, "Character design lock effectiveAt"), reason: text(input.reason, "Character design lock reason"), createdAt, active: true };
}

export function resolveCharacterDesignLock(state: IllustrationAssetLibraryState, characterId: string, at?: string): CharacterDesignLock | undefined {
  const target = timestamp(at ?? new Date().toISOString(), "Character design resolution timestamp");
  return state.characterDesignLocks.filter((lock) => lock.active && lock.characterId === characterId && lock.effectiveAt <= target).sort((a, b) => Date.parse(b.effectiveAt) - Date.parse(a.effectiveAt) || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))[0];
}

export function reuseIllustrationAsset(asset: IllustrationAsset, input: { readonly id: string; readonly projectId: string; readonly bookId: string; readonly chapterId: string; readonly sceneId: string; readonly date?: string; readonly now?: string }): IllustrationAsset {
  if (asset.projectId !== input.projectId) throw new Error("Illustration asset cannot be reused across projects.");
  return createIllustrationAsset({ id: input.id, projectId: input.projectId, bookId: input.bookId, chapterId: input.chapterId, sceneId: input.sceneId, characterId: asset.characterId, locationId: asset.locationId, prompt: asset.prompt, references: asset.references, style: asset.style, generationSettings: asset.generationSettings, version: asset.version + 1, date: input.date, approvalStatus: asset.approvalStatus, assetUri: asset.assetUri, reusedFromAssetId: asset.id, now: input.now });
}

export function validateIllustrationAssetLibraryState(value: unknown): IllustrationAssetLibraryState {
  if (!value || typeof value !== "object") throw new Error("Invalid illustration asset library state.");
  const candidate = value as Record<string, unknown>;
  if (candidate.formatVersion !== ILLUSTRATION_ASSET_LIBRARY_FORMAT_VERSION) throw new Error("Unsupported illustration asset library format.");
  const projectId = identifier(String(candidate.projectId), "Illustration asset library project id");
  if (!Array.isArray(candidate.assets) || !Array.isArray(candidate.characterDesignLocks)) throw new Error("Illustration asset library assets and character design locks are required.");
  const assets = candidate.assets.map(validateAsset); const ids = new Set<string>();
  for (const asset of assets) { if (asset.projectId !== projectId) throw new Error("Illustration asset belongs to another project."); if (ids.has(asset.id)) throw new Error(`Duplicate illustration asset id \"${asset.id}\".`); ids.add(asset.id); }
  const locks = candidate.characterDesignLocks.map(validateLock); const lockIds = new Set<string>();
  for (const lock of locks) { if (lock.projectId !== projectId) throw new Error("Character design lock belongs to another project."); if (lockIds.has(lock.id)) throw new Error(`Duplicate character design lock id \"${lock.id}\".`); lockIds.add(lock.id); if (!ids.has(lock.assetId)) throw new Error(`Character design lock references missing asset \"${lock.assetId}\".`); }
  return { formatVersion: ILLUSTRATION_ASSET_LIBRARY_FORMAT_VERSION, projectId, assets: assets.sort((a, b) => a.id.localeCompare(b.id)), characterDesignLocks: locks.sort(compareLocks) };
}

function validateAsset(value: unknown): IllustrationAsset { if (!value || typeof value !== "object") throw new Error("Invalid illustration asset."); const item = value as Record<string, unknown>; if (item.formatVersion !== ILLUSTRATION_ASSET_LIBRARY_FORMAT_VERSION) throw new Error("Unsupported illustration asset format."); return createIllustrationAsset({ id: String(item.id), projectId: String(item.projectId), bookId: String(item.bookId), chapterId: String(item.chapterId), sceneId: String(item.sceneId), characterId: String(item.characterId), locationId: String(item.locationId), prompt: String(item.prompt), references: item.references as IllustrationAssetReference[], style: String(item.style), generationSettings: item.generationSettings as Readonly<Record<string, IllustrationGenerationSettingValue>>, version: item.version as number, date: String(item.date), approvalStatus: item.approvalStatus as IllustrationApprovalStatus, assetUri: String(item.assetUri), reusedFromAssetId: item.reusedFromAssetId === undefined ? undefined : String(item.reusedFromAssetId), now: String(item.createdAt) }); }
function validateLock(value: unknown): CharacterDesignLock { if (!value || typeof value !== "object") throw new Error("Invalid character design lock."); const item = value as Record<string, unknown>; return createCharacterDesignLock({ id: String(item.id), projectId: String(item.projectId), seriesId: String(item.seriesId), characterId: String(item.characterId), assetId: String(item.assetId), effectiveAt: String(item.effectiveAt), reason: String(item.reason), createdAt: String(item.createdAt) }); }
function normalizeReferences(value: readonly IllustrationAssetReference[]): readonly IllustrationAssetReference[] { if (!Array.isArray(value)) throw new Error("Illustration asset references must be an array."); const ids = new Set<string>(); return value.map((item) => { if (!item || typeof item !== "object") throw new Error("Invalid illustration asset reference."); const ref = item as IllustrationAssetReference; const id = identifier(ref.id, "Illustration reference id"); if (ids.has(id)) throw new Error(`Duplicate illustration reference id \"${id}\".`); ids.add(id); if (!["source", "character", "location", "style", "pose", "other"].includes(ref.kind)) throw new Error("Invalid illustration reference kind."); return { id, uri: text(ref.uri, "Illustration reference URI"), label: text(ref.label, "Illustration reference label"), kind: ref.kind, notes: text(ref.notes, "Illustration reference notes") }; }); }
function normalizeSettings(value: Readonly<Record<string, IllustrationGenerationSettingValue>>): Readonly<Record<string, IllustrationGenerationSettingValue>> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Illustration generation settings must be an object."); const result: Record<string, IllustrationGenerationSettingValue> = {}; for (const [key, item] of Object.entries(value)) { if (!key.trim()) throw new Error("Illustration generation setting names cannot be empty."); if (!["string", "number", "boolean"].includes(typeof item) || (typeof item === "number" && !Number.isFinite(item))) throw new Error(`Invalid illustration generation setting \"${key}\".`); result[key] = item; } return Object.freeze({ ...result }); }
function cloneAsset(asset: IllustrationAsset): IllustrationAsset { return { ...asset, references: asset.references.map((ref) => ({ ...ref })), generationSettings: { ...asset.generationSettings } }; }
function approval(value: IllustrationApprovalStatus): IllustrationApprovalStatus { if (!ILLUSTRATION_APPROVAL_STATUSES.includes(value)) throw new Error("Invalid illustration approval status."); return value; }
function positiveInteger(value: number, label: string): number { if (!Number.isInteger(value) || value < 1) throw new Error(`${label} must be a positive integer.`); return value; }
function identifier(value: string, label: string): string { if (typeof value !== "string" || !value.trim() || value !== value.trim()) throw new Error(`${label} is required and cannot have surrounding whitespace.`); return value; }
function text(value: string, label: string): string { if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`); return value.trim(); }
function timestamp(value: string, label: string): string { if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new Error(`${label} must be a valid timestamp.`); return new Date(value).toISOString(); }
function compareLocks(a: CharacterDesignLock, b: CharacterDesignLock): number { return Date.parse(a.effectiveAt) - Date.parse(b.effectiveAt) || Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id); }

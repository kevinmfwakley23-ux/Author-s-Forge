import { createCreativeProvenance, type CreativeProvenance, type ProvenanceKind } from "./final-product-systems";

export const ASSET_RIGHTS_FORMAT_VERSION = 1 as const;
export const ASSET_RIGHTS_EVENT_TYPES = ["source-declaration", "external-processing-consent", "generation"] as const;
export const ASSET_RIGHTS_BASES = ["author-owned", "licensed", "public-domain", "external-reference", "unknown", "not-applicable"] as const;
export const ASSET_PUBLICATION_CLEARANCE = ["author-declared-cleared", "review-required", "restricted", "not-applicable"] as const;
export const MODEL_RELEASE_STATUSES = ["not-applicable", "not-required", "obtained", "not-obtained", "unknown"] as const;
export const DIGITAL_SOURCE_TYPES = ["human-created", "trained-algorithmic-media", "composite-synthetic", "unknown"] as const;

export type AssetRightsEventType = typeof ASSET_RIGHTS_EVENT_TYPES[number];
export type AssetRightsBasis = typeof ASSET_RIGHTS_BASES[number];
export type AssetPublicationClearance = typeof ASSET_PUBLICATION_CLEARANCE[number];
export type ModelReleaseStatus = typeof MODEL_RELEASE_STATUSES[number];
export type DigitalSourceType = typeof DIGITAL_SOURCE_TYPES[number];

export interface AssetRightsRecord {
  readonly formatVersion: typeof ASSET_RIGHTS_FORMAT_VERSION;
  readonly id: string;
  readonly projectId: string;
  readonly artifactId: string;
  readonly assetKind: "illustration";
  readonly eventType: AssetRightsEventType;
  readonly provenance: CreativeProvenance;
  readonly rightsBasis: AssetRightsBasis;
  readonly publicationClearance: AssetPublicationClearance;
  readonly containsRealPerson: boolean;
  readonly modelReleaseStatus: ModelReleaseStatus;
  readonly containsTrademark: boolean;
  readonly sourceReference: string;
  readonly licenseUrl?: string;
  readonly rightsUsageTerms: string;
  readonly provider?: string;
  readonly model?: string;
  readonly aiPromptInformation?: string;
  readonly digitalSourceType: DigitalSourceType;
  readonly recordedAt: string;
}

export interface AssetRightsRegistry {
  readonly formatVersion: typeof ASSET_RIGHTS_FORMAT_VERSION;
  readonly projectId: string;
  readonly records: readonly AssetRightsRecord[];
}

export interface CreateAssetRightsRecordInput {
  readonly id: string;
  readonly projectId: string;
  readonly artifactId: string;
  readonly eventType: AssetRightsEventType;
  readonly provenanceKind: ProvenanceKind;
  readonly source: string;
  readonly consentStatus: CreativeProvenance["consentStatus"];
  readonly rightsBasis: AssetRightsBasis;
  readonly publicationClearance?: AssetPublicationClearance;
  readonly containsRealPerson?: boolean;
  readonly modelReleaseStatus?: ModelReleaseStatus;
  readonly containsTrademark?: boolean;
  readonly sourceReference?: string;
  readonly licenseUrl?: string;
  readonly rightsUsageTerms?: string;
  readonly provider?: string;
  readonly model?: string;
  readonly aiPromptInformation?: string;
  readonly digitalSourceType?: DigitalSourceType;
  readonly notes?: string;
  readonly recordedAt?: string;
}

export function createAssetRightsRegistry(projectId: string): AssetRightsRegistry {
  return Object.freeze({ formatVersion: ASSET_RIGHTS_FORMAT_VERSION, projectId: identifier(projectId, "Asset rights project id"), records: Object.freeze([]) });
}

export function createAssetRightsRecord(input: CreateAssetRightsRecordInput): AssetRightsRecord {
  const eventType = enumValue(input.eventType, ASSET_RIGHTS_EVENT_TYPES, "asset rights event type");
  const rightsBasis = enumValue(input.rightsBasis, ASSET_RIGHTS_BASES, "asset rights basis");
  const publicationClearance = enumValue(input.publicationClearance ?? "review-required", ASSET_PUBLICATION_CLEARANCE, "publication clearance");
  const containsRealPerson = Boolean(input.containsRealPerson);
  const modelReleaseStatus = enumValue(input.modelReleaseStatus ?? (containsRealPerson ? "unknown" : "not-applicable"), MODEL_RELEASE_STATUSES, "model release status");
  const containsTrademark = Boolean(input.containsTrademark);
  const digitalSourceType = enumValue(input.digitalSourceType ?? "unknown", DIGITAL_SOURCE_TYPES, "digital source type");
  const recordedAt = timestamp(input.recordedAt ?? new Date().toISOString(), "Asset rights recordedAt");
  const provider = optionalText(input.provider, "Asset rights provider", 300);
  const model = optionalText(input.model, "Asset rights model", 500);
  const aiPromptInformation = optionalText(input.aiPromptInformation, "AI prompt information", 12000);
  const licenseUrl = optionalUrl(input.licenseUrl, "Asset rights license URL");
  const rightsUsageTerms = optionalText(input.rightsUsageTerms, "Asset rights usage terms", 6000) ?? "";
  const sourceReference = optionalText(input.sourceReference, "Asset rights source reference", 2000) ?? "";

  if (publicationClearance === "author-declared-cleared" && (rightsBasis === "unknown" || rightsBasis === "external-reference")) {
    throw new Error("Unknown or external-reference rights cannot be marked publication-cleared without a more specific rights basis.");
  }
  if (rightsBasis === "licensed" && publicationClearance === "author-declared-cleared" && !licenseUrl && !rightsUsageTerms) {
    throw new Error("Licensed material marked publication-cleared requires license/usage terms or a license URL.");
  }
  if (!containsRealPerson && modelReleaseStatus !== "not-applicable" && modelReleaseStatus !== "not-required") {
    throw new Error("Model release status requires containsRealPerson=true.");
  }
  if (eventType === "external-processing-consent") {
    if (input.consentStatus !== "granted") throw new Error("External image processing requires explicit granted consent.");
    if (!provider) throw new Error("External image processing provenance requires a provider.");
  }
  if (eventType === "generation") {
    if (input.provenanceKind !== "ai-generated") throw new Error("Generated asset provenance must be ai-generated.");
    if (!provider || !model || !aiPromptInformation) throw new Error("AI-generated asset provenance requires provider, model, and prompt information.");
    if (digitalSourceType !== "trained-algorithmic-media" && digitalSourceType !== "composite-synthetic") throw new Error("AI-generated asset provenance requires an AI/synthetic digital source type.");
  }

  const provenance = createCreativeProvenance({
    id: identifier(input.id, "Asset rights record id"),
    projectId: identifier(input.projectId, "Asset rights project id"),
    artifactId: identifier(input.artifactId, "Asset rights artifact id"),
    kind: input.provenanceKind,
    source: requiredText(input.source, "Asset rights source", 2000),
    consentStatus: input.consentStatus,
    notes: optionalText(input.notes, "Asset rights notes", 6000) ?? "",
    recordedAt,
  });

  return Object.freeze({
    formatVersion: ASSET_RIGHTS_FORMAT_VERSION,
    id: provenance.id,
    projectId: provenance.projectId,
    artifactId: provenance.artifactId,
    assetKind: "illustration" as const,
    eventType,
    provenance,
    rightsBasis,
    publicationClearance,
    containsRealPerson,
    modelReleaseStatus,
    containsTrademark,
    sourceReference,
    ...(licenseUrl ? { licenseUrl } : {}),
    rightsUsageTerms,
    ...(provider ? { provider } : {}),
    ...(model ? { model } : {}),
    ...(aiPromptInformation ? { aiPromptInformation } : {}),
    digitalSourceType,
    recordedAt,
  });
}

export function appendAssetRightsRecord(registry: AssetRightsRegistry, record: AssetRightsRecord): AssetRightsRegistry {
  const current = validateAssetRightsRegistry(registry);
  const value = validateAssetRightsRecord(record);
  if (value.projectId !== current.projectId) throw new Error("Asset rights record belongs to another project.");
  if (current.records.some((item) => item.id === value.id)) throw new Error(`Duplicate asset rights record id "${value.id}".`);
  return validateAssetRightsRegistry({ ...current, records: [...current.records, value] });
}

export function latestRightsDeclaration(registry: AssetRightsRegistry | undefined, artifactId: string): AssetRightsRecord | undefined {
  if (!registry) return undefined;
  const id = identifier(artifactId, "Asset rights artifact id");
  return validateAssetRightsRegistry(registry).records
    .filter((record) => record.artifactId === id && record.eventType === "source-declaration")
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt) || b.id.localeCompare(a.id))[0];
}

export function validateAssetRightsRegistry(value: unknown): AssetRightsRegistry {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid asset rights registry.");
  const input = value as Record<string, unknown>;
  if (input.formatVersion !== ASSET_RIGHTS_FORMAT_VERSION) throw new Error("Unsupported asset rights registry format.");
  const projectId = identifier(input.projectId, "Asset rights registry project id");
  if (!Array.isArray(input.records)) throw new Error("Asset rights registry records must be an array.");
  const ids = new Set<string>();
  const records = input.records.map((item) => {
    const record = validateAssetRightsRecord(item);
    if (record.projectId !== projectId) throw new Error("Asset rights registry contains a record from another project.");
    if (ids.has(record.id)) throw new Error(`Duplicate asset rights record id "${record.id}".`);
    ids.add(record.id);
    return record;
  }).sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.id.localeCompare(b.id));
  return Object.freeze({ formatVersion: ASSET_RIGHTS_FORMAT_VERSION, projectId, records: Object.freeze(records) });
}

export function validateAssetRightsRecord(value: unknown): AssetRightsRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid asset rights record.");
  const input = value as Record<string, unknown>;
  if (input.formatVersion !== ASSET_RIGHTS_FORMAT_VERSION || input.assetKind !== "illustration") throw new Error("Unsupported asset rights record format.");
  const provenance = input.provenance as CreativeProvenance;
  if (!provenance || typeof provenance !== "object") throw new Error("Asset rights provenance is required.");
  return createAssetRightsRecord({
    id: String(input.id),
    projectId: String(input.projectId),
    artifactId: String(input.artifactId),
    eventType: input.eventType as AssetRightsEventType,
    provenanceKind: provenance.kind,
    source: provenance.source,
    consentStatus: provenance.consentStatus,
    rightsBasis: input.rightsBasis as AssetRightsBasis,
    publicationClearance: input.publicationClearance as AssetPublicationClearance,
    containsRealPerson: input.containsRealPerson === true,
    modelReleaseStatus: input.modelReleaseStatus as ModelReleaseStatus,
    containsTrademark: input.containsTrademark === true,
    sourceReference: String(input.sourceReference ?? ""),
    licenseUrl: input.licenseUrl === undefined ? undefined : String(input.licenseUrl),
    rightsUsageTerms: String(input.rightsUsageTerms ?? ""),
    provider: input.provider === undefined ? undefined : String(input.provider),
    model: input.model === undefined ? undefined : String(input.model),
    aiPromptInformation: input.aiPromptInformation === undefined ? undefined : String(input.aiPromptInformation),
    digitalSourceType: input.digitalSourceType as DigitalSourceType,
    notes: provenance.notes,
    recordedAt: String(input.recordedAt),
  });
}

function identifier(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim() || value !== value.trim() || value.length > 300 || /[\r\n]/u.test(value)) throw new Error(`${label} is invalid.`);
  return value;
}
function requiredText(value: unknown, label: string, max: number): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  const text = value.trim();
  if (text.length > max) throw new Error(`${label} exceeds ${max} characters.`);
  return text;
}
function optionalText(value: unknown, label: string, max: number): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return requiredText(value, label, max);
}
function optionalUrl(value: unknown, label: string): string | undefined {
  const text = optionalText(value, label, 2000);
  if (!text) return undefined;
  let url: URL;
  try { url = new URL(text); } catch { throw new Error(`${label} must be an absolute http(s) URL.`); }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error(`${label} must be an absolute http(s) URL.`);
  return url.toString();
}
function timestamp(value: unknown, label: string): string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new Error(`${label} is invalid.`);
  return new Date(value).toISOString();
}
function enumValue<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) throw new Error(`Invalid ${label}.`);
  return value as T;
}

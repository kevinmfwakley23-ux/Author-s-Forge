export const NFT_SERIES_FORMAT_VERSION = 1 as const;

export interface NftSeriesSet {
  readonly id: string;
  readonly title: string;
  readonly collectionIds: readonly string[];
  readonly releaseOrder: readonly string[];
  readonly positioningNote: string;
}

export interface NftSeriesRules {
  readonly sharedStylePrinciples: readonly string[];
  readonly sharedLoreRules: readonly string[];
  readonly provenanceRequirements: readonly string[];
  readonly minimumDaysBetweenDrops: number;
  readonly maxConcurrentLaunches: number;
}

export interface NftSeriesDirectorState {
  readonly formatVersion: typeof NFT_SERIES_FORMAT_VERSION;
  readonly id: string;
  readonly forgeProjectId: string;
  readonly title: string;
  readonly thesis: string;
  readonly audience: string;
  readonly collectionIds: readonly string[];
  readonly sets: readonly NftSeriesSet[];
  readonly rules: NftSeriesRules;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateNftSeriesInput {
  readonly id: string;
  readonly forgeProjectId: string;
  readonly title: string;
  readonly thesis?: string;
  readonly audience?: string;
  readonly collectionIds?: readonly string[];
  readonly sets?: readonly NftSeriesSet[];
  readonly rules?: Partial<NftSeriesRules>;
  readonly now?: string;
}

export function createNftSeries(input: CreateNftSeriesInput): NftSeriesDirectorState {
  const now = timestamp(input.now ?? new Date().toISOString(), "NFT series timestamp");
  return validateNftSeries({
    formatVersion: NFT_SERIES_FORMAT_VERSION,
    id: identifier(input.id, "NFT series id"),
    forgeProjectId: identifier(input.forgeProjectId, "Forge project id"),
    title: required(input.title, "NFT series title", 180),
    thesis: optional(input.thesis, 8000) ?? "",
    audience: optional(input.audience, 4000) ?? "",
    collectionIds: uniqueIds(input.collectionIds ?? [], "NFT series collection id"),
    sets: normalizeSets(input.sets ?? []),
    rules: normalizeRules(input.rules ?? {}),
    createdAt: now,
    updatedAt: now,
  });
}

export function updateNftSeries(
  state: NftSeriesDirectorState,
  input: Partial<Omit<CreateNftSeriesInput, "id" | "forgeProjectId" | "now">>,
  now = new Date().toISOString(),
): NftSeriesDirectorState {
  const current = validateNftSeries(state);
  return validateNftSeries({
    ...current,
    ...(input.title === undefined ? {} : { title: required(input.title, "NFT series title", 180) }),
    ...(input.thesis === undefined ? {} : { thesis: optional(input.thesis, 8000) ?? "" }),
    ...(input.audience === undefined ? {} : { audience: optional(input.audience, 4000) ?? "" }),
    ...(input.collectionIds === undefined ? {} : { collectionIds: uniqueIds(input.collectionIds, "NFT series collection id") }),
    ...(input.sets === undefined ? {} : { sets: normalizeSets(input.sets) }),
    ...(input.rules === undefined ? {} : { rules: normalizeRules({ ...current.rules, ...input.rules }) }),
    updatedAt: timestamp(now, "NFT series updatedAt"),
  });
}

export function validateNftSeries(value: unknown): NftSeriesDirectorState {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid NFT series state.");
  const item = value as Record<string, unknown>;
  if (item.formatVersion !== NFT_SERIES_FORMAT_VERSION) throw new Error("Unsupported NFT series format.");
  const collectionIds = uniqueIds(arrayOfStrings(item.collectionIds, "NFT series collectionIds"), "NFT series collection id");
  const sets = normalizeSets(asArray(item.sets, "NFT series sets") as NftSeriesSet[]);
  const collectionSet = new Set(collectionIds);
  for (const set of sets) {
    for (const collectionId of set.collectionIds) if (!collectionSet.has(collectionId)) throw new Error(`NFT set "${set.id}" references collection "${collectionId}" outside the series.`);
    for (const collectionId of set.releaseOrder) if (!set.collectionIds.includes(collectionId)) throw new Error(`NFT set "${set.id}" release order references collection "${collectionId}" outside the set.`);
  }
  return Object.freeze({
    formatVersion: NFT_SERIES_FORMAT_VERSION,
    id: identifier(item.id, "NFT series id"),
    forgeProjectId: identifier(item.forgeProjectId, "Forge project id"),
    title: required(item.title, "NFT series title", 180),
    thesis: optional(item.thesis, 8000) ?? "",
    audience: optional(item.audience, 4000) ?? "",
    collectionIds: Object.freeze(collectionIds),
    sets: Object.freeze(sets),
    rules: normalizeRules((item.rules && typeof item.rules === "object" ? item.rules : {}) as Partial<NftSeriesRules>),
    createdAt: timestamp(item.createdAt, "NFT series createdAt"),
    updatedAt: timestamp(item.updatedAt, "NFT series updatedAt"),
  });
}

function normalizeSets(values: readonly NftSeriesSet[]): readonly NftSeriesSet[] {
  const ids = new Set<string>();
  return values.map((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid NFT series set.");
    const id = identifier(value.id, "NFT set id");
    if (ids.has(id)) throw new Error(`Duplicate NFT set id "${id}".`);
    ids.add(id);
    const collectionIds = uniqueIds(value.collectionIds ?? [], "NFT set collection id");
    const releaseOrder = uniqueIds(value.releaseOrder?.length ? value.releaseOrder : collectionIds, "NFT set release order id");
    return Object.freeze({
      id,
      title: required(value.title, "NFT set title", 180),
      collectionIds: Object.freeze(collectionIds),
      releaseOrder: Object.freeze(releaseOrder),
      positioningNote: optional(value.positioningNote, 4000) ?? "",
    });
  });
}

function normalizeRules(value: Partial<NftSeriesRules>): NftSeriesRules {
  return Object.freeze({
    sharedStylePrinciples: Object.freeze(strings(value.sharedStylePrinciples)),
    sharedLoreRules: Object.freeze(strings(value.sharedLoreRules)),
    provenanceRequirements: Object.freeze(strings(value.provenanceRequirements)),
    minimumDaysBetweenDrops: integerRange(value.minimumDaysBetweenDrops ?? 14, "NFT series minimum days between drops", 0, 3650),
    maxConcurrentLaunches: integerRange(value.maxConcurrentLaunches ?? 1, "NFT series max concurrent launches", 1, 50),
  });
}

function strings(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("NFT series rule list must be an array.");
  const result = value.map((item) => required(item, "NFT series rule", 2000));
  return [...new Set(result)];
}
function arrayOfStrings(value: unknown, label: string): string[] { if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw new Error(`${label} must be a string array.`); return value as string[]; }
function asArray(value: unknown, label: string): unknown[] { if (!Array.isArray(value)) throw new Error(`${label} must be an array.`); return value; }
function uniqueIds(values: readonly string[], label: string): string[] { const result = values.map((value) => identifier(value, label)); if (new Set(result).size !== result.length) throw new Error(`Duplicate ${label}.`); return result; }
function identifier(value: unknown, label: string): string { if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value.trim()) || value !== value.trim()) throw new Error(`${label} must contain only letters, numbers, hyphens, and underscores.`); return value; }
function required(value: unknown, label: string, max: number): string { if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`); const text = value.trim(); if (text.length > max) throw new Error(`${label} exceeds ${max} characters.`); return text; }
function optional(value: unknown, max: number): string | undefined { if (value === undefined || value === null || value === "") return undefined; if (typeof value !== "string") throw new Error("Optional NFT series value must be a string."); const text = value.trim(); if (!text) return undefined; if (text.length > max) throw new Error(`Optional NFT series value exceeds ${max} characters.`); return text; }
function timestamp(value: unknown, label: string): string { if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new Error(`${label} must be a valid timestamp.`); return new Date(value).toISOString(); }
function integerRange(value: unknown, label: string, min: number, max: number): number { const number = Number(value); if (!Number.isInteger(number) || number < min || number > max) throw new Error(`${label} must be an integer from ${min} to ${max}.`); return number; }

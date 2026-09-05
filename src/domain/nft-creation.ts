export const NFT_CREATION_FORMAT_VERSION = 1 as const;
export const NFT_TOKEN_STANDARDS = ["erc-721", "erc-1155", "metaplex-core"] as const;
export const NFT_COLLECTION_TYPES = ["one-of-one", "edition", "generative-series", "drop"] as const;
export const NFT_STORAGE_MODES = ["ipfs", "arweave", "onchain", "centralized-draft"] as const;

export type NftTokenStandard = typeof NFT_TOKEN_STANDARDS[number];
export type NftCollectionType = typeof NFT_COLLECTION_TYPES[number];
export type NftStorageMode = typeof NFT_STORAGE_MODES[number];
export type NftArtworkStatus = "missing" | "candidate" | "approved";
export type NftProposalStatus = "proposed" | "approved" | "rejected";

export interface NftTraitValueDefinition {
  readonly value: string;
  readonly weight: number;
}
export interface NftTraitDefinition {
  readonly id: string;
  readonly label: string;
  readonly values: readonly NftTraitValueDefinition[];
}
export interface NftTraitAssignment {
  readonly traitId: string;
  readonly traitType: string;
  readonly value: string;
}
export interface NftItem {
  readonly tokenId: string;
  readonly name: string;
  readonly description: string;
  readonly attributes: readonly NftTraitAssignment[];
  readonly rarityScore: number;
  readonly rarityRank: number;
  readonly artworkStatus: NftArtworkStatus;
  readonly imageUri?: string;
  readonly animationUrl?: string;
  readonly sourceAssetId?: string;
}
export interface NftLaunchPlan {
  readonly mintType: "open-collection" | "scheduled-drop";
  readonly reveal: "instant" | "post-mint" | "manual";
  readonly phases: readonly { readonly name: string; readonly audience: string; readonly start?: string; readonly end?: string; readonly priceNote?: string; readonly allowlistRequired: boolean }[];
  readonly story: string;
  readonly roadmap: readonly string[];
  readonly communityPlan: readonly string[];
}
export interface NftAiProposal {
  readonly id: string;
  readonly kind: "collection-strategy" | "trait-system" | "launch-strategy" | "copy";
  readonly status: NftProposalStatus;
  readonly summary: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly provider: string;
  readonly model: string;
  readonly requestId?: string;
  readonly createdAt: string;
  readonly reviewedAt?: string;
}
export interface NftCollection {
  readonly formatVersion: typeof NFT_CREATION_FORMAT_VERSION;
  readonly id: string;
  readonly forgeProjectId: string;
  readonly title: string;
  readonly symbol: string;
  readonly description: string;
  readonly collectionType: NftCollectionType;
  readonly tokenStandard: NftTokenStandard;
  readonly chain: string;
  readonly supply: number;
  readonly seed: string;
  readonly royaltyBps: number;
  readonly storageMode: NftStorageMode;
  readonly externalUrl?: string;
  readonly audience: string;
  readonly artisticThesis: string;
  readonly styleGuide: string;
  readonly lore: string;
  readonly rightsNote: string;
  readonly traits: readonly NftTraitDefinition[];
  readonly items: readonly NftItem[];
  readonly launchPlan?: NftLaunchPlan;
  readonly proposals: readonly NftAiProposal[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateNftCollectionInput {
  readonly id: string;
  readonly forgeProjectId: string;
  readonly title: string;
  readonly symbol: string;
  readonly description: string;
  readonly collectionType: NftCollectionType;
  readonly tokenStandard: NftTokenStandard;
  readonly chain: string;
  readonly supply: number;
  readonly seed?: string;
  readonly royaltyBps?: number;
  readonly storageMode?: NftStorageMode;
  readonly externalUrl?: string;
  readonly audience?: string;
  readonly artisticThesis?: string;
  readonly styleGuide?: string;
  readonly lore?: string;
  readonly rightsNote?: string;
  readonly now?: string;
}

export interface NftPreflightIssue {
  readonly code: string;
  readonly severity: "error" | "warning" | "info";
  readonly message: string;
  readonly tokenId?: string;
}
export interface NftPreflightReport {
  readonly collectionId: string;
  readonly errors: number;
  readonly warnings: number;
  readonly readyForMetadata: boolean;
  readonly readyForLaunchPackage: boolean;
  readonly issues: readonly NftPreflightIssue[];
  readonly collectorReadiness: number;
  readonly readinessSignals: readonly string[];
}

export function createNftCollection(input: CreateNftCollectionInput): NftCollection {
  const now = timestamp(input.now ?? new Date().toISOString());
  const collectionType = enumValue(input.collectionType, NFT_COLLECTION_TYPES, "NFT collection type");
  const tokenStandard = enumValue(input.tokenStandard, NFT_TOKEN_STANDARDS, "NFT token standard");
  const storageMode = enumValue(input.storageMode ?? "ipfs", NFT_STORAGE_MODES, "NFT storage mode");
  const supply = positiveInteger(input.supply, "NFT collection supply", 15000);
  if (collectionType === "one-of-one" && supply !== 1) throw new Error("One-of-one NFT collections must have supply 1.");
  const royaltyBps = integerRange(input.royaltyBps ?? 500, "NFT royalty basis points", 0, 10000);
  return Object.freeze({
    formatVersion: NFT_CREATION_FORMAT_VERSION,
    id: identifier(input.id, "NFT collection id"),
    forgeProjectId: identifier(input.forgeProjectId, "Forge project id"),
    title: required(input.title, "NFT collection title", 160),
    symbol: symbol(input.symbol),
    description: required(input.description, "NFT collection description", 5000),
    collectionType,
    tokenStandard,
    chain: required(input.chain, "NFT chain", 80),
    supply,
    seed: optional(input.seed, 200) ?? `${input.id}:${input.title}`,
    royaltyBps,
    storageMode,
    ...(optional(input.externalUrl, 2000) ? { externalUrl: optional(input.externalUrl, 2000) } : {}),
    audience: optional(input.audience, 2000) ?? "",
    artisticThesis: optional(input.artisticThesis, 5000) ?? "",
    styleGuide: optional(input.styleGuide, 8000) ?? "",
    lore: optional(input.lore, 10000) ?? "",
    rightsNote: optional(input.rightsNote, 4000) ?? "",
    traits: Object.freeze([]),
    items: Object.freeze([]),
    proposals: Object.freeze([]),
    createdAt: now,
    updatedAt: now,
  });
}

export function withNftTraitDefinitions(collection: NftCollection, traits: readonly NftTraitDefinition[], now = new Date().toISOString()): NftCollection {
  validateNftCollection(collection);
  const normalized = traits.map((trait) => normalizeTrait(trait));
  const ids = new Set<string>();
  for (const trait of normalized) {
    if (ids.has(trait.id)) throw new Error(`Duplicate NFT trait id "${trait.id}".`);
    ids.add(trait.id);
  }
  return freezeCollection({ ...collection, traits: normalized, items: [], updatedAt: timestamp(now) });
}

export function withNftLaunchPlan(collection: NftCollection, launchPlan: NftLaunchPlan, now = new Date().toISOString()): NftCollection {
  validateNftCollection(collection);
  const normalized = normalizeLaunchPlan(launchPlan);
  return freezeCollection({ ...collection, launchPlan: normalized, updatedAt: timestamp(now) });
}

export function withNftProposal(collection: NftCollection, proposal: NftAiProposal, now = new Date().toISOString()): NftCollection {
  validateNftCollection(collection);
  if (collection.proposals.some((item) => item.id === proposal.id)) throw new Error(`NFT proposal "${proposal.id}" already exists.`);
  return freezeCollection({ ...collection, proposals: [...collection.proposals, Object.freeze({ ...proposal })], updatedAt: timestamp(now) });
}

export function reviewNftProposal(collection: NftCollection, proposalId: string, decision: "approved" | "rejected", now = new Date().toISOString()): NftCollection {
  validateNftCollection(collection);
  const id = identifier(proposalId, "NFT proposal id");
  const existing = collection.proposals.find((item) => item.id === id);
  if (!existing) throw new Error(`NFT proposal "${id}" not found.`);
  if (existing.status !== "proposed") throw new Error("Only proposed NFT AI work can be reviewed.");
  return freezeCollection({
    ...collection,
    proposals: collection.proposals.map((item) => item.id === id ? Object.freeze({ ...item, status: decision, reviewedAt: timestamp(now) }) : item),
    updatedAt: timestamp(now),
  });
}

export function generateNftItems(collection: NftCollection, now = new Date().toISOString()): NftCollection {
  validateNftCollection(collection);
  if (collection.supply > 1 && !collection.traits.length) throw new Error("Multi-item NFT collections require at least one trait definition before manifest generation.");
  const traitSpace = collection.traits.reduce((total, trait) => total * trait.values.length, 1);
  if (collection.traits.length && Number.isFinite(traitSpace) && traitSpace < collection.supply) {
    throw new Error(`Trait space supports only ${traitSpace} unique combinations for a requested supply of ${collection.supply}. Add trait values or reduce supply.`);
  }
  const random = seededRandom(collection.seed);
  const signatures = new Set<string>();
  const raw: { tokenId: string; attributes: NftTraitAssignment[] }[] = [];
  for (let index = 0; index < collection.supply; index++) {
    let attributes: NftTraitAssignment[] = [];
    let signature = "";
    for (let attempt = 0; attempt < 1000; attempt++) {
      attributes = collection.traits.map((trait) => {
        const picked = weightedPick(trait.values, random);
        return { traitId: trait.id, traitType: trait.label, value: picked.value };
      });
      signature = attributes.map((attribute) => `${attribute.traitId}=${attribute.value}`).join("|") || `one-${index + 1}`;
      if (!signatures.has(signature)) break;
      if (attempt === 999) throw new Error("Unable to generate a unique NFT trait combination within 1,000 attempts. Increase trait diversity or reduce supply.");
    }
    signatures.add(signature);
    raw.push({ tokenId: String(index + 1), attributes });
  }
  const frequencies = new Map<string, number>();
  for (const item of raw) for (const attribute of item.attributes) {
    const key = `${attribute.traitId}\u0000${attribute.value}`;
    frequencies.set(key, (frequencies.get(key) ?? 0) + 1);
  }
  const scored = raw.map((item) => ({
    ...item,
    rarityScore: item.attributes.reduce((score, attribute) => score + collection.supply / Math.max(1, frequencies.get(`${attribute.traitId}\u0000${attribute.value}`) ?? 1), 0),
  }));
  const ranks = [...scored].sort((a, b) => b.rarityScore - a.rarityScore || Number(a.tokenId) - Number(b.tokenId));
  const rankById = new Map(ranks.map((item, index) => [item.tokenId, index + 1]));
  const items = scored.map((item) => Object.freeze({
    tokenId: item.tokenId,
    name: collection.supply === 1 ? collection.title : `${collection.title} #${item.tokenId}`,
    description: collection.description,
    attributes: Object.freeze(item.attributes.map((attribute) => Object.freeze({ ...attribute }))),
    rarityScore: Number(item.rarityScore.toFixed(6)),
    rarityRank: rankById.get(item.tokenId) ?? collection.supply,
    artworkStatus: "missing" as const,
  }));
  return freezeCollection({ ...collection, items, updatedAt: timestamp(now) });
}

export function attachNftArtwork(collection: NftCollection, tokenId: string, input: { imageUri: string; sourceAssetId: string; animationUrl?: string }, now = new Date().toISOString()): NftCollection {
  validateNftCollection(collection);
  const id = required(tokenId, "NFT token id", 100);
  if (!collection.items.some((item) => item.tokenId === id)) throw new Error(`NFT token ${id} not found.`);
  const imageUri = required(input.imageUri, "NFT image URI", 2_000_000);
  const sourceAssetId = identifier(input.sourceAssetId, "NFT artwork source asset id");
  const animationUrl = optional(input.animationUrl, 2_000_000);
  return freezeCollection({
    ...collection,
    items: collection.items.map((item) => item.tokenId === id ? Object.freeze({ ...item, artworkStatus: "approved" as const, imageUri, sourceAssetId, ...(animationUrl ? { animationUrl } : {}) }) : item),
    updatedAt: timestamp(now),
  });
}

export function compileNftMetadata(collection: NftCollection, tokenId: string): Readonly<Record<string, unknown>> {
  validateNftCollection(collection);
  const item = collection.items.find((candidate) => candidate.tokenId === tokenId);
  if (!item) throw new Error(`NFT token ${tokenId} not found.`);
  if (!item.imageUri) throw new Error(`NFT token ${tokenId} has no approved image URI.`);
  const attributes = item.attributes.map((attribute) => ({ trait_type: attribute.traitType, value: attribute.value }));
  const common: Record<string, unknown> = {
    name: item.name,
    description: item.description,
    image: item.imageUri,
    ...(collection.externalUrl ? { external_url: collection.externalUrl } : {}),
    ...(item.animationUrl ? { animation_url: item.animationUrl } : {}),
    attributes,
  };
  if (collection.tokenStandard === "metaplex-core") {
    const mediaType = item.animationUrl ? mediaTypeFor(item.animationUrl) : mediaTypeFor(item.imageUri);
    return Object.freeze({
      ...common,
      properties: {
        files: Object.freeze([
          Object.freeze({ uri: item.imageUri, type: mediaTypeFor(item.imageUri) }),
          ...(item.animationUrl ? [Object.freeze({ uri: item.animationUrl, type: mediaType })] : []),
        ]),
        category: item.animationUrl ? categoryFor(item.animationUrl) : "image",
      },
    });
  }
  return Object.freeze(common);
}

export function nftCollectionPreflight(collection: NftCollection): NftPreflightReport {
  validateNftCollection(collection);
  const issues: NftPreflightIssue[] = [];
  if (!collection.audience.trim()) issues.push(issue("AUDIENCE_UNDEFINED", "warning", "Define the intended collector/audience before launch positioning."));
  if (!collection.artisticThesis.trim()) issues.push(issue("ARTISTIC_THESIS_UNDEFINED", "warning", "Define the artistic thesis so the collection has a coherent reason to exist beyond rarity."));
  if (!collection.styleGuide.trim()) issues.push(issue("STYLE_GUIDE_UNDEFINED", "warning", "Create a collection style guide before generating a large image set."));
  if (!collection.rightsNote.trim()) issues.push(issue("RIGHTS_NOTE_MISSING", "warning", "Record rights/provenance expectations for source material and AI-assisted artwork."));
  if (collection.supply > 1 && !collection.traits.length) issues.push(issue("TRAITS_MISSING", "error", "Multi-item collection requires a validated trait system."));
  if (collection.items.length !== collection.supply) issues.push(issue("MANIFEST_INCOMPLETE", "error", `Generated manifest contains ${collection.items.length} items for supply ${collection.supply}.`));
  const signatures = new Set<string>();
  for (const item of collection.items) {
    const signature = item.attributes.map((attribute) => `${attribute.traitId}=${attribute.value}`).join("|");
    if (signature && signatures.has(signature)) issues.push(issue("DUPLICATE_TRAIT_COMBINATION", "error", "Duplicate trait combination detected.", item.tokenId));
    signatures.add(signature);
    if (!item.imageUri) issues.push(issue("ARTWORK_MISSING", "error", "Approved artwork URI is missing.", item.tokenId));
    else if (collection.storageMode === "ipfs" && !item.imageUri.startsWith("ipfs://")) issues.push(issue("IPFS_URI_EXPECTED", "warning", "Collection is configured for IPFS but artwork URI is not ipfs://.", item.tokenId));
    else if (collection.storageMode === "arweave" && !/^(ar|https:\/\/arweave\.net\/)/i.test(item.imageUri)) issues.push(issue("ARWEAVE_URI_EXPECTED", "warning", "Collection is configured for Arweave but artwork URI does not look like an Arweave reference.", item.tokenId));
  }
  if (!collection.launchPlan) issues.push(issue("LAUNCH_PLAN_MISSING", "warning", "Create an explicit mint/reveal/community launch plan before publishing."));
  if (collection.royaltyBps > 0) issues.push(issue("ROYALTY_MARKETPLACE_DEPENDENT", "info", collection.tokenStandard === "metaplex-core" ? "Metaplex Core royalties can use the Royalties plugin; enforcement depends on chosen rule-set/marketplace compatibility." : "ERC-2981 can signal royalty information, but payment remains marketplace-dependent."));
  const errors = issues.filter((entry) => entry.severity === "error").length;
  const warnings = issues.filter((entry) => entry.severity === "warning").length;
  const readinessSignals: string[] = [];
  let score = 0;
  const add = (points: number, condition: boolean, label: string) => { if (condition) { score += points; readinessSignals.push(label); } };
  add(12, Boolean(collection.artisticThesis.trim()), "clear artistic thesis");
  add(10, Boolean(collection.audience.trim()), "defined collector/audience");
  add(12, Boolean(collection.styleGuide.trim()), "collection-wide visual system");
  add(8, Boolean(collection.lore.trim()), "story/lore layer");
  add(12, collection.supply === 1 || collection.traits.length >= 2, "structured trait/variation system");
  add(10, collection.items.length === collection.supply && collection.items.length > 0, "complete deterministic manifest");
  add(16, collection.items.length > 0 && collection.items.every((item) => Boolean(item.imageUri)), "approved artwork mapped to every token");
  add(8, Boolean(collection.rightsNote.trim()), "rights/provenance expectations documented");
  add(12, Boolean(collection.launchPlan), "mint/reveal/community launch plan");
  const collectorReadiness = Math.min(100, score);
  return Object.freeze({ collectionId: collection.id, errors, warnings, readyForMetadata: errors === 0 && collection.items.length === collection.supply, readyForLaunchPackage: errors === 0 && Boolean(collection.launchPlan), issues: Object.freeze(issues), collectorReadiness, readinessSignals: Object.freeze(readinessSignals) });
}

export function validateNftCollection(collection: NftCollection): void {
  if (!collection || typeof collection !== "object") throw new Error("NFT collection is required.");
  if (collection.formatVersion !== NFT_CREATION_FORMAT_VERSION) throw new Error("Unsupported NFT creation format version.");
  identifier(collection.id, "NFT collection id");
  identifier(collection.forgeProjectId, "Forge project id");
  required(collection.title, "NFT collection title", 160);
  symbol(collection.symbol);
  required(collection.description, "NFT collection description", 5000);
  enumValue(collection.collectionType, NFT_COLLECTION_TYPES, "NFT collection type");
  enumValue(collection.tokenStandard, NFT_TOKEN_STANDARDS, "NFT token standard");
  enumValue(collection.storageMode, NFT_STORAGE_MODES, "NFT storage mode");
  positiveInteger(collection.supply, "NFT collection supply", 15000);
  integerRange(collection.royaltyBps, "NFT royalty basis points", 0, 10000);
  const traitIds = new Set<string>();
  for (const trait of collection.traits) {
    const normalized = normalizeTrait(trait);
    if (traitIds.has(normalized.id)) throw new Error(`Duplicate NFT trait id "${normalized.id}".`);
    traitIds.add(normalized.id);
  }
  const tokenIds = new Set<string>();
  for (const item of collection.items) {
    required(item.tokenId, "NFT token id", 100);
    if (tokenIds.has(item.tokenId)) throw new Error(`Duplicate NFT token id "${item.tokenId}".`);
    tokenIds.add(item.tokenId);
  }
  timestamp(collection.createdAt);
  timestamp(collection.updatedAt);
}

function normalizeTrait(trait: NftTraitDefinition): NftTraitDefinition {
  const id = identifier(trait.id, "NFT trait id");
  const label = required(trait.label, "NFT trait label", 100);
  if (!Array.isArray(trait.values) || trait.values.length < 1 || trait.values.length > 500) throw new Error(`NFT trait "${id}" requires 1 through 500 values.`);
  const values = trait.values.map((entry) => Object.freeze({ value: required(entry.value, `NFT trait ${id} value`, 200), weight: finitePositive(entry.weight, `NFT trait ${id} weight`) }));
  const distinct = new Set(values.map((entry) => entry.value.toLocaleLowerCase()));
  if (distinct.size !== values.length) throw new Error(`NFT trait "${id}" contains duplicate values.`);
  return Object.freeze({ id, label, values: Object.freeze(values) });
}

function normalizeLaunchPlan(plan: NftLaunchPlan): NftLaunchPlan {
  if (plan.mintType !== "open-collection" && plan.mintType !== "scheduled-drop") throw new Error("NFT mint type must be open-collection or scheduled-drop.");
  if (!(["instant", "post-mint", "manual"] as const).includes(plan.reveal)) throw new Error("NFT reveal mode is invalid.");
  const phases = (plan.phases ?? []).map((phase, index) => Object.freeze({
    name: required(phase.name, `NFT launch phase ${index + 1} name`, 100),
    audience: required(phase.audience, `NFT launch phase ${index + 1} audience`, 500),
    ...(optional(phase.start, 100) ? { start: optional(phase.start, 100) } : {}),
    ...(optional(phase.end, 100) ? { end: optional(phase.end, 100) } : {}),
    ...(optional(phase.priceNote, 500) ? { priceNote: optional(phase.priceNote, 500) } : {}),
    allowlistRequired: phase.allowlistRequired === true,
  }));
  return Object.freeze({ mintType: plan.mintType, reveal: plan.reveal, phases: Object.freeze(phases), story: required(plan.story, "NFT launch story", 10_000), roadmap: Object.freeze(textList(plan.roadmap, "NFT roadmap item", 50, 1000)), communityPlan: Object.freeze(textList(plan.communityPlan, "NFT community plan item", 50, 1000)) });
}

function weightedPick(values: readonly NftTraitValueDefinition[], random: () => number): NftTraitValueDefinition {
  const total = values.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = random() * total;
  for (const entry of values) { cursor -= entry.weight; if (cursor <= 0) return entry; }
  return values[values.length - 1];
}
function seededRandom(seed: string): () => number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) { hash ^= seed.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  let state = hash >>> 0;
  return () => { state += 0x6D2B79F5; let t = state; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function freezeCollection(collection: NftCollection): NftCollection { validateNftCollection(collection); return Object.freeze({ ...collection, traits: Object.freeze([...collection.traits]), items: Object.freeze([...collection.items]), proposals: Object.freeze([...collection.proposals]) }); }
function categoryFor(uri: string): string { if (/\.(mp4|webm|mov)(?:$|\?)/i.test(uri)) return "video"; if (/\.(mp3|wav|ogg)(?:$|\?)/i.test(uri)) return "audio"; if (/\.html?(?:$|\?)/i.test(uri)) return "html"; return "image"; }
function mediaTypeFor(uri: string): string { if (/\.png(?:$|\?)/i.test(uri)) return "image/png"; if (/\.jpe?g(?:$|\?)/i.test(uri)) return "image/jpeg"; if (/\.gif(?:$|\?)/i.test(uri)) return "image/gif"; if (/\.svg(?:$|\?)/i.test(uri)) return "image/svg+xml"; if (/\.mp4(?:$|\?)/i.test(uri)) return "video/mp4"; if (/\.webm(?:$|\?)/i.test(uri)) return "video/webm"; return "application/octet-stream"; }
function issue(code: string, severity: NftPreflightIssue["severity"], message: string, tokenId?: string): NftPreflightIssue { return Object.freeze({ code, severity, message, ...(tokenId ? { tokenId } : {}) }); }
function identifier(value: string, label: string): string { const normalized = required(value, label, 120); if (!/^[A-Za-z0-9_-]+$/.test(normalized)) throw new Error(`${label} may contain only letters, numbers, hyphens, and underscores.`); return normalized; }
function symbol(value: string): string { const normalized = required(value, "NFT collection symbol", 16).toUpperCase(); if (!/^[A-Z0-9_-]{1,16}$/.test(normalized)) throw new Error("NFT collection symbol may contain only A-Z, 0-9, hyphens, and underscores."); return normalized; }
function required(value: unknown, label: string, max: number): string { if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`); const normalized = value.trim(); if (normalized.length > max) throw new Error(`${label} exceeds ${max} characters.`); return normalized; }
function optional(value: unknown, max: number): string | undefined { if (value === undefined || value === null || value === "") return undefined; if (typeof value !== "string") throw new Error("Optional NFT text value must be a string."); const normalized = value.trim(); if (!normalized) return undefined; if (normalized.length > max) throw new Error(`Optional NFT text exceeds ${max} characters.`); return normalized; }
function positiveInteger(value: unknown, label: string, max: number): number { const parsed = Number(value); if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) throw new Error(`${label} must be an integer from 1 through ${max}.`); return parsed; }
function integerRange(value: unknown, label: string, min: number, max: number): number { const parsed = Number(value); if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new Error(`${label} must be an integer from ${min} through ${max}.`); return parsed; }
function finitePositive(value: unknown, label: string): number { const parsed = Number(value); if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${label} must be greater than zero.`); return parsed; }
function timestamp(value: string): string { const normalized = required(value, "NFT timestamp", 100); if (Number.isNaN(Date.parse(normalized))) throw new Error("NFT timestamp must be a valid date/time."); return new Date(normalized).toISOString(); }
function textList(values: readonly string[] | undefined, label: string, maxItems: number, maxLength: number): string[] { if (!values) return []; if (!Array.isArray(values) || values.length > maxItems) throw new Error(`${label} list exceeds ${maxItems} items.`); return values.map((entry) => required(entry, label, maxLength)); }
function enumValue<T extends string>(value: unknown, values: readonly T[], label: string): T { if (typeof value !== "string" || !values.includes(value as T)) throw new Error(`Invalid ${label}.`); return value as T; }

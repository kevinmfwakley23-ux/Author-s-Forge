import { createHash } from "node:crypto";
import { createMemoryRecord } from "../domain/memory";
import { projectAssetRightsRegistry } from "../domain/project-rights";
import { withProjectMemories, type ProjectState } from "../domain/project";
import {
  createNftSeries,
  updateNftSeries,
  validateNftSeries,
  type CreateNftSeriesInput,
  type NftSeriesDirectorState,
  type NftSeriesSet,
} from "../domain/nft-series-director";
import type { NftCollection } from "../domain/nft-creation";
import type { FileNftCreationStore } from "../infrastructure/file-nft-creation-store";
import type { FileNftSeriesStore } from "../infrastructure/file-nft-series-store";
import type { ProjectStorePort } from "./project-store-port";
import { ProjectMemoryStore } from "./project-memory-store";

export interface NftSeriesQaIssue {
  readonly code: string;
  readonly severity: "error" | "warning" | "info";
  readonly message: string;
  readonly collectionId?: string;
  readonly tokenId?: string;
  readonly setId?: string;
}

export interface NftSeriesQaReport {
  readonly formatVersion: 1;
  readonly seriesId: string;
  readonly generatedAt: string;
  readonly errors: number;
  readonly warnings: number;
  readonly infos: number;
  readonly score: number;
  readonly readyForSeriesLaunch: boolean;
  readonly collectionCount: number;
  readonly itemCount: number;
  readonly approvedArtworkCount: number;
  readonly sharedTraitLabels: readonly string[];
  readonly duplicateArtworkGroups: readonly { readonly imageUri: string; readonly tokens: readonly string[] }[];
  readonly issues: readonly NftSeriesQaIssue[];
}

export interface NftSeriesProvenanceBundle {
  readonly formatVersion: 1;
  readonly kind: "forge-nft-series-provenance-bundle";
  readonly generatedAt: string;
  readonly series: NftSeriesDirectorState;
  readonly qa: NftSeriesQaReport;
  readonly collections: readonly {
    readonly id: string;
    readonly title: string;
    readonly tokenStandard: string;
    readonly chain: string;
    readonly storageMode: string;
    readonly royaltyBps: number;
    readonly items: readonly {
      readonly tokenId: string;
      readonly name: string;
      readonly imageReference: string;
      readonly imageReferenceSha256: string;
      readonly sourceAssetId?: string;
      readonly sourceAsset?: {
        readonly id: string;
        readonly style: string;
        readonly generationSettings: Readonly<Record<string, string | number | boolean>>;
        readonly approvalStatus: string;
        readonly provider?: string;
        readonly model?: string;
      };
      readonly rightsRecords: readonly {
        readonly id: string;
        readonly eventType: string;
        readonly rightsBasis: string;
        readonly publicationClearance: string;
        readonly provenanceKind: string;
        readonly provider?: string;
        readonly model?: string;
        readonly recordedAt: string;
      }[];
      readonly authorProvenanceMemories: readonly string[];
      readonly provenanceReady: boolean;
    }[];
  }[];
  readonly note: string;
}

export class NftSeriesDirectorService {
  constructor(
    private readonly seriesStore: FileNftSeriesStore,
    private readonly nftStore: FileNftCreationStore,
    private readonly projects: ProjectStorePort,
  ) {}

  async list(forgeProjectId: string): Promise<NftSeriesDirectorState[]> {
    await this.requireProject(forgeProjectId);
    return this.seriesStore.list(forgeProjectId);
  }

  async get(forgeProjectId: string, id: string): Promise<NftSeriesDirectorState | undefined> {
    await this.requireProject(forgeProjectId);
    return this.seriesStore.get(forgeProjectId, id);
  }

  async create(input: CreateNftSeriesInput): Promise<NftSeriesDirectorState> {
    await this.requireProject(input.forgeProjectId);
    const collectionIds = input.collectionIds ?? [];
    await this.requireCollections(input.forgeProjectId, collectionIds);
    const created = await this.seriesStore.create(createNftSeries(input));
    await this.remember(created, "NFT Series/Set Director workspace created");
    return created;
  }

  async update(
    forgeProjectId: string,
    id: string,
    input: Partial<Omit<CreateNftSeriesInput, "id" | "forgeProjectId" | "now">>,
  ): Promise<NftSeriesDirectorState> {
    const current = await this.requireSeries(forgeProjectId, id);
    const next = updateNftSeries(current, input);
    await this.requireCollections(forgeProjectId, next.collectionIds);
    const saved = await this.seriesStore.save(next);
    await this.remember(saved, "NFT Series/Set Director configuration updated");
    return saved;
  }

  async qa(forgeProjectId: string, id: string): Promise<NftSeriesQaReport> {
    const series = await this.requireSeries(forgeProjectId, id);
    const project = await this.requireProject(forgeProjectId);
    const collections = await this.requireCollections(forgeProjectId, series.collectionIds);
    return createQaReport(series, collections, project);
  }

  async provenanceBundle(forgeProjectId: string, id: string): Promise<NftSeriesProvenanceBundle> {
    const series = await this.requireSeries(forgeProjectId, id);
    const project = await this.requireProject(forgeProjectId);
    const collections = await this.requireCollections(forgeProjectId, series.collectionIds);
    const qa = createQaReport(series, collections, project);
    const assetById = new Map((project.illustrationAssetLibrary?.assets ?? []).map((asset) => [asset.id, asset]));
    const rights = projectAssetRightsRegistry(project)?.records ?? [];
    const output = collections.map((collection) => ({
      id: collection.id,
      title: collection.title,
      tokenStandard: collection.tokenStandard,
      chain: collection.chain,
      storageMode: collection.storageMode,
      royaltyBps: collection.royaltyBps,
      items: collection.items.map((item) => {
        const sourceAsset = item.sourceAssetId ? assetById.get(item.sourceAssetId) : undefined;
        const rightsRecords = item.sourceAssetId ? rights.filter((record) => record.artifactId === item.sourceAssetId) : [];
        const authorMemories = project.memories.filter((memory) => Array.isArray(memory.relevanceTags)
          && memory.relevanceTags.includes("nft-artwork")
          && memory.relevanceTags.includes(collection.id)
          && memory.relevanceTags.includes(item.tokenId));
        const imageReference = safeAssetReference(item.imageUri ?? "");
        return Object.freeze({
          tokenId: item.tokenId,
          name: item.name,
          imageReference,
          imageReferenceSha256: sha256(item.imageUri ?? ""),
          ...(item.sourceAssetId ? { sourceAssetId: item.sourceAssetId } : {}),
          ...(sourceAsset ? { sourceAsset: Object.freeze({
            id: sourceAsset.id,
            style: sourceAsset.style,
            generationSettings: Object.freeze({ ...sourceAsset.generationSettings }),
            approvalStatus: sourceAsset.approvalStatus,
            ...(typeof sourceAsset.generationSettings.provider === "string" ? { provider: sourceAsset.generationSettings.provider } : {}),
            ...(typeof sourceAsset.generationSettings.model === "string" ? { model: sourceAsset.generationSettings.model } : {}),
          }) } : {}),
          rightsRecords: Object.freeze(rightsRecords.map((record) => Object.freeze({
            id: record.id,
            eventType: record.eventType,
            rightsBasis: record.rightsBasis,
            publicationClearance: record.publicationClearance,
            provenanceKind: record.provenance.kind,
            ...(record.provider ? { provider: record.provider } : {}),
            ...(record.model ? { model: record.model } : {}),
            recordedAt: record.recordedAt,
          }))),
          authorProvenanceMemories: Object.freeze(authorMemories.map((memory) => memory.id)),
          provenanceReady: Boolean(item.sourceAssetId && (rightsRecords.length || authorMemories.length)),
        });
      }),
    }));
    return Object.freeze({
      formatVersion: 1 as const,
      kind: "forge-nft-series-provenance-bundle" as const,
      generatedAt: new Date().toISOString(),
      series,
      qa,
      collections: Object.freeze(output),
      note: "This is an audit/provenance export. It does not create a cryptographic C2PA signature, prove legal ownership, publish files, deploy a contract, or mint tokens.",
    });
  }

  private async requireSeries(forgeProjectId: string, id: string): Promise<NftSeriesDirectorState> {
    const series = await this.seriesStore.get(forgeProjectId, id);
    if (!series) throw new Error(`NFT series "${id}" not found.`);
    return validateNftSeries(series);
  }

  private async requireCollections(forgeProjectId: string, ids: readonly string[]): Promise<NftCollection[]> {
    const collections: NftCollection[] = [];
    for (const id of ids) {
      const collection = await this.nftStore.get(forgeProjectId, id);
      if (!collection) throw new Error(`NFT series references missing collection "${id}".`);
      collections.push(collection);
    }
    return collections;
  }

  private async requireProject(projectId: string): Promise<ProjectState> {
    const project = await this.projects.load(projectId);
    if (!project) throw new Error(`Forge project "${projectId}" not found.`);
    return project;
  }

  private async remember(series: NftSeriesDirectorState, reason: string): Promise<void> {
    const project = await this.requireProject(series.forgeProjectId);
    const memory = new ProjectMemoryStore();
    memory.restore(project.memories);
    const id = `nft-series:${series.id}:${series.updatedAt.replace(/[^0-9]/g, "")}`;
    if (!memory.get(id)) memory.register(createMemoryRecord({
      id,
      projectId: series.forgeProjectId,
      class: "production-memory",
      authority: "working",
      summary: `NFT Series/Set Director · ${series.title}`,
      content: JSON.stringify({ seriesId: series.id, collectionIds: series.collectionIds, sets: series.sets.map((set) => ({ id: set.id, collectionIds: set.collectionIds })), reason }),
      provenance: [{ kind: "system", reference: "nft-series-director", recordedAt: series.updatedAt }],
      relevanceTags: ["nft", "nft-series", "nft-set", series.id],
      now: series.updatedAt,
    }));
    await this.projects.save(withProjectMemories(project, memory.toPortableState(), series.updatedAt));
  }
}

export function createQaReport(series: NftSeriesDirectorState, collections: readonly NftCollection[], project: ProjectState): NftSeriesQaReport {
  validateNftSeries(series);
  const issues: NftSeriesQaIssue[] = [];
  const expected = new Set(series.collectionIds);
  const actual = new Set(collections.map((collection) => collection.id));
  for (const id of expected) if (!actual.has(id)) issues.push(issue("COLLECTION_MISSING", "error", `Series collection ${id} is missing.`, id));
  for (const collection of collections) if (!expected.has(collection.id)) issues.push(issue("COLLECTION_OUTSIDE_SERIES", "error", `Collection ${collection.id} is not registered in this series.`, collection.id));
  if (!series.thesis.trim()) issues.push(issue("SERIES_THESIS_MISSING", "warning", "Define the cross-collection artistic thesis so later sets have a durable creative anchor."));
  if (!series.audience.trim()) issues.push(issue("SERIES_AUDIENCE_MISSING", "warning", "Define the audience hypothesis for the series before coordinating releases."));
  if (!series.rules.sharedStylePrinciples.length) issues.push(issue("SERIES_STYLE_RULES_MISSING", "warning", "Add shared style principles to make visual drift measurable across sets."));
  if (!series.rules.provenanceRequirements.length) issues.push(issue("SERIES_PROVENANCE_RULES_MISSING", "warning", "Add provenance requirements for source art, AI assistance, and publication clearance."));

  const assetById = new Map((project.illustrationAssetLibrary?.assets ?? []).map((asset) => [asset.id, asset]));
  const rights = projectAssetRightsRegistry(project)?.records ?? [];
  const artworkMap = new Map<string, string[]>();
  let itemCount = 0;
  let approvedArtworkCount = 0;
  const traitSets = collections.map((collection) => new Set(collection.traits.map((trait) => trait.label.trim().toLowerCase()).filter(Boolean)));

  for (const collection of collections) {
    itemCount += collection.items.length;
    if (!collection.rightsNote.trim()) issues.push(issue("COLLECTION_RIGHTS_NOTE_MISSING", "warning", "Collection rights/provenance expectations are not documented.", collection.id));
    if (collection.items.length !== collection.supply) issues.push(issue("COLLECTION_MANIFEST_INCOMPLETE", "error", `Collection manifest has ${collection.items.length} items for supply ${collection.supply}.`, collection.id));
    const generatedSizes = new Set<string>();
    const generatedStyles = new Set<string>();
    for (const item of collection.items) {
      if (item.artworkStatus !== "approved" || !item.imageUri) {
        issues.push(issue("ARTWORK_NOT_APPROVED", "error", "Token does not have approved artwork.", collection.id, item.tokenId));
        continue;
      }
      approvedArtworkCount++;
      const key = item.imageUri;
      const coordinate = `${collection.id}#${item.tokenId}`;
      artworkMap.set(key, [...(artworkMap.get(key) ?? []), coordinate]);
      if (!item.sourceAssetId) {
        issues.push(issue("ARTWORK_SOURCE_MISSING", "error", "Approved artwork has no source/provenance asset id.", collection.id, item.tokenId));
        continue;
      }
      const sourceAsset = assetById.get(item.sourceAssetId);
      const sourceRights = rights.filter((record) => record.artifactId === item.sourceAssetId);
      const authorMemory = project.memories.some((memory) => Array.isArray(memory.relevanceTags)
        && memory.relevanceTags.includes("nft-artwork")
        && memory.relevanceTags.includes(collection.id)
        && memory.relevanceTags.includes(item.tokenId));
      if (!sourceAsset && !item.sourceAssetId.startsWith("author-nft-")) issues.push(issue("SOURCE_ASSET_NOT_FOUND", "error", `Artwork source asset ${item.sourceAssetId} is not present in Project Brain's illustration library.`, collection.id, item.tokenId));
      if (!sourceRights.length && !authorMemory) issues.push(issue("PROVENANCE_EVIDENCE_MISSING", "error", "Artwork source has no Image Lab rights record or author provenance memory.", collection.id, item.tokenId));
      if (sourceAsset) {
        const size = sourceAsset.generationSettings.size;
        if (typeof size === "string") generatedSizes.add(size);
        if (sourceAsset.style) generatedStyles.add(sourceAsset.style.trim().toLowerCase());
      }
    }
    if (generatedSizes.size > 1) issues.push(issue("MIXED_GENERATION_DIMENSIONS", "warning", `AI artwork in this collection uses multiple generation sizes: ${[...generatedSizes].join(", ")}.`, collection.id));
    if (generatedStyles.size > 1 && collection.items.length > 2) issues.push(issue("MIXED_IMAGE_LAB_STYLES", "warning", `AI artwork uses ${generatedStyles.size} distinct Image Lab style strings. Review intentionality before release.`, collection.id));
  }

  const duplicateArtworkGroups = [...artworkMap.entries()]
    .filter(([, tokens]) => tokens.length > 1)
    .map(([imageUri, tokens]) => Object.freeze({ imageUri: safeAssetReference(imageUri), tokens: Object.freeze(tokens) }));
  for (const group of duplicateArtworkGroups) {
    const involvedCollections = new Set(group.tokens.map((token) => token.split("#", 1)[0]));
    const allEdition = collections.filter((collection) => involvedCollections.has(collection.id)).every((collection) => collection.collectionType === "edition");
    issues.push(issue("DUPLICATE_ARTWORK_URI", allEdition ? "info" : "warning", `The same artwork URI is attached to ${group.tokens.length} tokens: ${group.tokens.join(", ")}.`));
  }

  for (const set of series.sets) qaSet(set, collections, series, issues);
  qaReleaseSpacing(series, collections, issues);

  const sharedTraitLabels = traitSets.length
    ? [...traitSets[0]].filter((label) => traitSets.every((set) => set.has(label))).sort()
    : [];
  if (collections.length > 1 && !sharedTraitLabels.length) issues.push(issue("NO_SHARED_TRAIT_LANGUAGE", "info", "Collections share no trait labels. This can be intentional, but verify the series still reads as one collectible world."));

  const errors = issues.filter((item) => item.severity === "error").length;
  const warnings = issues.filter((item) => item.severity === "warning").length;
  const infos = issues.filter((item) => item.severity === "info").length;
  const score = Math.max(0, Math.min(100, 100 - errors * 18 - warnings * 5 - infos));
  return Object.freeze({
    formatVersion: 1 as const,
    seriesId: series.id,
    generatedAt: new Date().toISOString(),
    errors,
    warnings,
    infos,
    score,
    readyForSeriesLaunch: errors === 0,
    collectionCount: collections.length,
    itemCount,
    approvedArtworkCount,
    sharedTraitLabels: Object.freeze(sharedTraitLabels),
    duplicateArtworkGroups: Object.freeze(duplicateArtworkGroups),
    issues: Object.freeze(issues),
  });
}

function qaSet(set: NftSeriesSet, collections: readonly NftCollection[], series: NftSeriesDirectorState, issues: NftSeriesQaIssue[]): void {
  const members = collections.filter((collection) => set.collectionIds.includes(collection.id));
  if (!members.length) { issues.push(issue("EMPTY_SET", "warning", `Set ${set.title} contains no available collections.`, undefined, undefined, set.id)); return; }
  const standards = new Set(members.map((collection) => `${collection.chain}:${collection.tokenStandard}`));
  const storage = new Set(members.map((collection) => collection.storageMode));
  const royalties = new Set(members.map((collection) => collection.royaltyBps));
  if (standards.size > 1) issues.push(issue("SET_STANDARD_DRIFT", "info", `Set spans multiple chain/standard targets: ${[...standards].join(", ")}. Confirm this is intentional.`, undefined, undefined, set.id));
  if (storage.size > 1) issues.push(issue("SET_STORAGE_DRIFT", "warning", `Set mixes metadata storage modes: ${[...storage].join(", ")}.`, undefined, undefined, set.id));
  if (royalties.size > 1) issues.push(issue("SET_ROYALTY_DRIFT", "warning", `Set uses multiple royalty basis-point values: ${[...royalties].join(", ")}.`, undefined, undefined, set.id));
  const missingOrder = set.collectionIds.filter((id) => !set.releaseOrder.includes(id));
  if (missingOrder.length) issues.push(issue("SET_RELEASE_ORDER_INCOMPLETE", "warning", `Set release order omits: ${missingOrder.join(", ")}.`, undefined, undefined, set.id));
  if (members.length > series.rules.maxConcurrentLaunches && !set.positioningNote.trim()) issues.push(issue("SET_POSITIONING_NOTE_MISSING", "info", "Large set has no positioning note explaining how releases differ without cannibalizing one another.", undefined, undefined, set.id));
}

function qaReleaseSpacing(series: NftSeriesDirectorState, collections: readonly NftCollection[], issues: NftSeriesQaIssue[]): void {
  const starts = collections.map((collection) => ({ collection, start: earliestLaunchStart(collection) })).filter((value): value is { collection: NftCollection; start: number } => value.start !== undefined).sort((a, b) => a.start - b.start);
  for (let index = 1; index < starts.length; index++) {
    const days = (starts[index].start - starts[index - 1].start) / 86_400_000;
    if (days < series.rules.minimumDaysBetweenDrops) issues.push(issue("RELEASE_SPACING_BELOW_RULE", "warning", `${starts[index - 1].collection.title} and ${starts[index].collection.title} begin ${days.toFixed(1)} days apart, below the series rule of ${series.rules.minimumDaysBetweenDrops} days.`));
  }
}

function earliestLaunchStart(collection: NftCollection): number | undefined {
  const values = (collection.launchPlan?.phases ?? []).map((phase) => phase.start ? Date.parse(phase.start) : Number.NaN).filter(Number.isFinite);
  return values.length ? Math.min(...values) : undefined;
}
function issue(code: string, severity: NftSeriesQaIssue["severity"], message: string, collectionId?: string, tokenId?: string, setId?: string): NftSeriesQaIssue { return Object.freeze({ code, severity, message, ...(collectionId ? { collectionId } : {}), ...(tokenId ? { tokenId } : {}), ...(setId ? { setId } : {}) }); }
function safeAssetReference(value: string): string { if (!value) return ""; if (value.startsWith("data:")) return `embedded-data-uri:sha256:${sha256(value)}`; return value.length > 2000 ? `${value.slice(0, 1970)}…` : value; }
function sha256(value: string): string { return createHash("sha256").update(value).digest("hex"); }

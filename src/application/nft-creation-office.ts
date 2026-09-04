import { randomUUID } from "node:crypto";
import { createMemoryRecord } from "../domain/memory";
import {
  attachNftArtwork,
  compileNftMetadata,
  createNftCollection,
  generateNftItems,
  nftCollectionPreflight,
  reviewNftProposal,
  validateNftCollection,
  withNftLaunchPlan,
  withNftProposal,
  withNftTraitDefinitions,
  type CreateNftCollectionInput,
  type NftAiProposal,
  type NftCollection,
  type NftLaunchPlan,
  type NftTraitDefinition,
} from "../domain/nft-creation";
import { withProjectMemories, type ProjectState } from "../domain/project";
import { generateProjectText, type AiGenerationResult, type ProjectAiGenerationRequest } from "../infrastructure/ai-provider";
import type { FileNftCreationStore } from "../infrastructure/file-nft-creation-store";
import type { FileProjectStore } from "../infrastructure/file-project-store";
import type { ImageGenerationQuality, ImageGenerationSize } from "../infrastructure/image-provider";
import { ProjectMemoryStore } from "./project-memory-store";
import { StudioImageLabService } from "./studio-image-lab";

export type NftAiGenerator = (request: ProjectAiGenerationRequest) => Promise<AiGenerationResult>;
export type NftAiProposalKind = NftAiProposal["kind"];

export interface NftArtworkCandidateResult {
  readonly tokenId: string;
  readonly assetId: string;
  readonly provider: string;
  readonly model: string;
  readonly requestId?: string;
  readonly url: string;
}

export class NftCreationOfficeService {
  private readonly imageLab: StudioImageLabService;

  constructor(
    private readonly store: FileNftCreationStore,
    private readonly projects: FileProjectStore,
    private readonly ai: NftAiGenerator = generateProjectText,
    imageLab?: StudioImageLabService,
  ) {
    this.imageLab = imageLab ?? new StudioImageLabService(projects);
  }

  async list(forgeProjectId: string): Promise<NftCollection[]> {
    await this.requireForgeProject(forgeProjectId);
    return this.store.list(forgeProjectId);
  }

  async get(forgeProjectId: string, id: string): Promise<NftCollection | undefined> {
    await this.requireForgeProject(forgeProjectId);
    return this.store.get(forgeProjectId, id);
  }

  async create(input: CreateNftCollectionInput): Promise<NftCollection> {
    await this.requireForgeProject(input.forgeProjectId);
    const saved = await this.store.create(createNftCollection(input));
    await this.remember(saved, "NFT collection workspace created");
    return saved;
  }

  async setTraits(forgeProjectId: string, id: string, traits: readonly NftTraitDefinition[]): Promise<NftCollection> {
    const collection = await this.requireCollection(forgeProjectId, id);
    const saved = await this.store.save(withNftTraitDefinitions(collection, traits));
    await this.remember(saved, "NFT trait system updated; generated manifest invalidated until regenerated");
    return saved;
  }

  async generateManifest(forgeProjectId: string, id: string): Promise<NftCollection> {
    const collection = await this.requireCollection(forgeProjectId, id);
    const saved = await this.store.save(generateNftItems(collection));
    await this.remember(saved, `Generated deterministic NFT manifest for ${saved.items.length} item(s)`);
    return saved;
  }

  async setLaunchPlan(forgeProjectId: string, id: string, plan: NftLaunchPlan): Promise<NftCollection> {
    const collection = await this.requireCollection(forgeProjectId, id);
    const saved = await this.store.save(withNftLaunchPlan(collection, plan));
    await this.remember(saved, "NFT mint/reveal/community launch plan updated");
    return saved;
  }

  async preflight(forgeProjectId: string, id: string) {
    return nftCollectionPreflight(await this.requireCollection(forgeProjectId, id));
  }

  async propose(forgeProjectId: string, id: string, kind: NftAiProposalKind, instruction: string): Promise<{ collection: NftCollection; proposal: NftAiProposal; ai: Pick<AiGenerationResult, "provider" | "model" | "requestId" | "attempts" | "optimization"> }> {
    const collection = await this.requireCollection(forgeProjectId, id);
    const project = await this.requireForgeProject(forgeProjectId);
    const memory = memoryFor(project);
    const requestInstruction = requiredText(instruction, "NFT AI instruction", 10_000);
    const result = await this.ai({
      memory,
      context: {
        projectId: forgeProjectId,
        taskMemoryClasses: ["author-memory", "project-memory", "style-memory", "visual-identity", "research-memory", "decision-memory", "production-memory", "creative-note"],
        relevanceTags: ["nft", "digital-art", collection.id, kind],
        queryTerms: [collection.title, collection.audience, collection.artisticThesis, requestInstruction],
        includeWorkingState: true,
        limit: 80,
      },
      system: [
        "You are the AI strategy and creative-planning assistant inside Author's Forge NFT Creation Office.",
        "Help an artist create original, coherent, technically valid NFT work and launch materials.",
        "Never promise sales, investment returns, price appreciation, scarcity-driven profit, or guaranteed high demand.",
        "Demand-related advice must be framed as a testable audience/positioning hypothesis, not a financial prediction.",
        "Respect copyright, trademark, likeness, and source-art provenance. Do not imitate a living artist or copy a protected collection's distinctive identity.",
        "Return ONLY one JSON object with {\"summary\":\"...\",\"payload\":{...}}. Never claim blockchain deployment, minting, IPFS upload, marketplace approval, or sales occurred.",
        kindSchema(kind),
      ].join(" "),
      user: [
        `Proposal kind: ${kind}`,
        `Author instruction: ${requestInstruction}`,
        `Collection: ${JSON.stringify(collectionSummary(collection))}`,
        "Use the existing collection truth. Recommend concrete creative choices, audience hypotheses, and launch experiments where useful.",
      ].join("\n\n"),
      task: kind === "launch-strategy" ? "marketing" : "writing",
      temperature: kind === "trait-system" ? 0.45 : 0.7,
      maxOutputTokens: 5000,
      requiresReasoning: true,
      requiresCreativeWriting: kind !== "trait-system",
      requiresInstructionFollowing: true,
    });
    const parsed = parseObject(result.text, "NFT AI response");
    const payload = objectValue(parsed.payload, "NFT AI proposal payload");
    const proposal: NftAiProposal = Object.freeze({
      id: `nft-proposal-${randomUUID()}`,
      kind,
      status: "proposed",
      summary: requiredText(parsed.summary, "NFT AI proposal summary", 2000),
      payload: clone(payload),
      provider: result.provider,
      model: result.model,
      ...(result.requestId ? { requestId: result.requestId } : {}),
      createdAt: new Date().toISOString(),
    });
    const saved = await this.store.save(withNftProposal(collection, proposal));
    return { collection: saved, proposal, ai: evidence(result) };
  }

  async reviewProposal(forgeProjectId: string, id: string, proposalId: string, decision: "approved" | "rejected", apply = false): Promise<NftCollection> {
    let collection = await this.requireCollection(forgeProjectId, id);
    const proposal = collection.proposals.find((candidate) => candidate.id === proposalId);
    if (!proposal) throw new Error(`NFT proposal "${proposalId}" not found.`);
    if (proposal.status !== "proposed") throw new Error("Only proposed NFT AI work can be reviewed.");
    if (decision === "approved" && apply) collection = applyProposal(collection, proposal);
    collection = reviewNftProposal(collection, proposalId, decision);
    const saved = await this.store.save(collection);
    await this.remember(saved, `Author ${decision} NFT AI proposal ${proposalId}${decision === "approved" && apply ? " and applied its validated fields" : ""}`);
    return saved;
  }

  async generateArtwork(forgeProjectId: string, id: string, tokenId: string, input: { instruction?: string; size?: ImageGenerationSize; quality?: ImageGenerationQuality }): Promise<NftArtworkCandidateResult> {
    const collection = await this.requireCollection(forgeProjectId, id);
    const item = collection.items.find((candidate) => candidate.tokenId === tokenId);
    if (!item) throw new Error(`NFT token ${tokenId} not found. Generate the manifest first.`);
    const direction = optionalText(input.instruction, 4000) ?? "Create the strongest collection-consistent final artwork candidate for this token.";
    const traitText = item.attributes.map((attribute) => `${attribute.traitType}: ${attribute.value}`).join("; ") || "one-of-one composition";
    const result = await this.imageLab.generate({
      projectId: forgeProjectId,
      prompt: [
        `NFT collection: ${collection.title}. Token ${item.tokenId}.`,
        `Artistic thesis: ${collection.artisticThesis || "author-defined original digital artwork"}.`,
        `Collection style guide: ${collection.styleGuide || "consistent visual identity across the collection"}.`,
        collection.lore ? `Collection lore: ${collection.lore}.` : "",
        `Token traits: ${traitText}.`,
        `Author direction: ${direction}`,
        "Create original collectible artwork with strong focal hierarchy, intentional silhouette/shape language, clean edge/detail control, and enough collection consistency to read as part of one series while preserving this token's distinct traits.",
        "Do not add marketplace logos, price claims, watermarks, signatures, or text unless explicitly requested.",
      ].filter(Boolean).join("\n"),
      style: collection.styleGuide || collection.artisticThesis || "original collectible digital art",
      purpose: "concept-art",
      size: input.size ?? "2048x2048",
      quality: input.quality ?? "high",
    });
    return Object.freeze({ tokenId, assetId: result.asset.id, provider: result.provider, model: result.model, ...(result.requestId ? { requestId: result.requestId } : {}), url: result.url });
  }

  async reviewArtwork(forgeProjectId: string, id: string, tokenId: string, assetId: string, decision: "approved" | "rejected"): Promise<NftCollection> {
    let collection = await this.requireCollection(forgeProjectId, id);
    const reviewed = await this.imageLab.review({ projectId: forgeProjectId, assetId, decision });
    if (decision === "approved") collection = attachNftArtwork(collection, tokenId, { imageUri: reviewed.asset.assetUri, sourceAssetId: reviewed.asset.id });
    const saved = decision === "approved" ? await this.store.save(collection) : collection;
    if (decision === "approved") await this.remember(saved, `Approved Image Lab asset ${assetId} attached to NFT token ${tokenId}`);
    return saved;
  }

  async launchPackage(forgeProjectId: string, id: string): Promise<Readonly<Record<string, unknown>>> {
    const collection = await this.requireCollection(forgeProjectId, id);
    const preflight = nftCollectionPreflight(collection);
    if (!preflight.readyForMetadata) throw new Error(`NFT launch package is blocked by ${preflight.errors} preflight error(s).`);
    const metadataFiles = collection.items.map((item) => ({ fileName: `${item.tokenId}.json`, tokenId: item.tokenId, metadata: compileNftMetadata(collection, item.tokenId) }));
    const traitLabels = [...new Set(collection.traits.map((trait) => trait.label))];
    const csvHeader = ["token_id", "name", "description", "image", ...traitLabels];
    const csvRows = collection.items.map((item) => {
      const byLabel = new Map(item.attributes.map((attribute) => [attribute.traitType, attribute.value]));
      return [item.tokenId, item.name, item.description, item.imageUri ?? "", ...traitLabels.map((label) => byLabel.get(label) ?? "")];
    });
    const marketplaceCsv = [csvHeader, ...csvRows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
    const contractGuidance = collection.tokenStandard === "metaplex-core"
      ? { standard: "Metaplex Core", royaltiesPlugin: { basisPoints: collection.royaltyBps, creators: "Configure creator addresses/splits at deployment; Forge never invents wallet addresses.", ruleSet: "Author must choose marketplace transfer rules." } }
      : { standard: collection.tokenStandard.toUpperCase(), royaltySignal: collection.royaltyBps > 0 ? "ERC-2981 compatible royalty signaling recommended; marketplace payment is not guaranteed by the standard." : "No creator royalty signal requested." };
    return Object.freeze({
      formatVersion: 1,
      kind: "forge-nft-launch-package",
      generatedAt: new Date().toISOString(),
      collection: collectionSummary(collection),
      preflight,
      storage: {
        mode: collection.storageMode,
        canonicalUriRule: collection.storageMode === "ipfs" ? "Use ipfs:// CID-based URIs as canonical links; HTTP gateways are presentation fallbacks." : collection.storageMode === "arweave" ? "Use permanent Arweave transaction-backed URIs after upload." : collection.storageMode === "onchain" ? "Store/derive metadata onchain only when the chosen contract/program actually implements it." : "Centralized draft mode is not permanence-ready; move final metadata/media to the selected durable storage before minting.",
      },
      contractGuidance,
      metadataFiles: Object.freeze(metadataFiles),
      marketplaceCsv,
      launchPlan: collection.launchPlan ?? null,
      notes: Object.freeze([
        "This package prepares assets/metadata/configuration only. It does not deploy a contract, mint tokens, upload to IPFS/Arweave, sign a wallet transaction, list on a marketplace, or guarantee demand.",
        "Verify marketplace and chain requirements immediately before launch because creator tooling and policy can change.",
      ]),
    });
  }

  private async requireCollection(forgeProjectId: string, id: string): Promise<NftCollection> {
    await this.requireForgeProject(forgeProjectId);
    const collection = await this.store.get(forgeProjectId, id);
    if (!collection) throw new Error(`NFT collection "${id}" not found.`);
    return collection;
  }

  private async requireForgeProject(projectId: string): Promise<ProjectState> {
    const project = await this.projects.load(projectId);
    if (!project) throw new Error(`Forge project "${projectId}" not found.`);
    return project;
  }

  private async remember(collection: NftCollection, reason: string): Promise<void> {
    const project = await this.requireForgeProject(collection.forgeProjectId);
    const memory = memoryFor(project);
    const id = `nft:${collection.id}:${collection.updatedAt.replace(/[^0-9]/g, "")}`;
    if (!memory.get(id)) memory.register(createMemoryRecord({
      id,
      projectId: collection.forgeProjectId,
      class: "production-memory",
      authority: "working",
      summary: `NFT Creation · ${collection.title}`,
      content: JSON.stringify({ nftCollectionId: collection.id, standard: collection.tokenStandard, chain: collection.chain, supply: collection.supply, itemCount: collection.items.length, artworkApproved: collection.items.filter((item) => item.artworkStatus === "approved").length, reason }),
      provenance: [{ kind: "system", reference: "nft-creation-office", recordedAt: collection.updatedAt }],
      relevanceTags: ["nft", "digital-art", "nft-creation", collection.id, collection.tokenStandard],
      now: collection.updatedAt,
    }));
    await this.projects.save(withProjectMemories(project, memory.toPortableState(), collection.updatedAt));
  }
}

function applyProposal(collection: NftCollection, proposal: NftAiProposal): NftCollection {
  const payload = proposal.payload as Record<string, unknown>;
  if (proposal.kind === "trait-system") {
    const raw = Array.isArray(payload.traits) ? payload.traits : [];
    const traits: NftTraitDefinition[] = raw.map((value, index) => parseTrait(value, index));
    return withNftTraitDefinitions(collection, traits);
  }
  if (proposal.kind === "launch-strategy") return withNftLaunchPlan(collection, parseLaunchPlan(payload.launchPlan ?? payload));
  const now = new Date().toISOString();
  const next: NftCollection = {
    ...collection,
    ...(typeof payload.description === "string" && payload.description.trim() ? { description: payload.description.trim().slice(0, 5000) } : {}),
    ...(typeof payload.audience === "string" ? { audience: payload.audience.trim().slice(0, 2000) } : {}),
    ...(typeof payload.artisticThesis === "string" ? { artisticThesis: payload.artisticThesis.trim().slice(0, 5000) } : {}),
    ...(typeof payload.styleGuide === "string" ? { styleGuide: payload.styleGuide.trim().slice(0, 8000) } : {}),
    ...(typeof payload.lore === "string" ? { lore: payload.lore.trim().slice(0, 10000) } : {}),
    ...(typeof payload.rightsNote === "string" ? { rightsNote: payload.rightsNote.trim().slice(0, 4000) } : {}),
    updatedAt: now,
  };
  validateNftCollection(next);
  return Object.freeze(next);
}

function parseTrait(value: unknown, index: number): NftTraitDefinition {
  const row = objectValue(value, `NFT trait ${index + 1}`);
  if (!Array.isArray(row.values)) throw new Error(`NFT trait ${index + 1} values must be an array.`);
  return {
    id: requiredText(row.id, `NFT trait ${index + 1} id`, 120),
    label: requiredText(row.label, `NFT trait ${index + 1} label`, 100),
    values: row.values.map((entry, valueIndex) => {
      const item = objectValue(entry, `NFT trait ${index + 1} value ${valueIndex + 1}`);
      const weight = Number(item.weight);
      if (!Number.isFinite(weight) || weight <= 0) throw new Error(`NFT trait ${index + 1} value ${valueIndex + 1} weight must be greater than zero.`);
      return { value: requiredText(item.value, `NFT trait ${index + 1} value`, 200), weight };
    }),
  };
}

function parseLaunchPlan(value: unknown): NftLaunchPlan {
  const row = objectValue(value, "NFT launch plan");
  const mintType = row.mintType === "scheduled-drop" ? "scheduled-drop" : row.mintType === "open-collection" ? "open-collection" : undefined;
  const reveal = row.reveal === "instant" || row.reveal === "post-mint" || row.reveal === "manual" ? row.reveal : undefined;
  if (!mintType || !reveal) throw new Error("NFT launch plan requires valid mintType and reveal fields.");
  const phases = Array.isArray(row.phases) ? row.phases.map((phase, index) => {
    const item = objectValue(phase, `NFT launch phase ${index + 1}`);
    return {
      name: requiredText(item.name, `NFT launch phase ${index + 1} name`, 100),
      audience: requiredText(item.audience, `NFT launch phase ${index + 1} audience`, 500),
      ...(typeof item.start === "string" && item.start.trim() ? { start: item.start.trim() } : {}),
      ...(typeof item.end === "string" && item.end.trim() ? { end: item.end.trim() } : {}),
      ...(typeof item.priceNote === "string" && item.priceNote.trim() ? { priceNote: item.priceNote.trim().slice(0, 500) } : {}),
      allowlistRequired: item.allowlistRequired === true,
    };
  }) : [];
  return { mintType, reveal, phases, story: requiredText(row.story, "NFT launch story", 10_000), roadmap: stringArray(row.roadmap, 50, 1000), communityPlan: stringArray(row.communityPlan, 50, 1000) };
}

function kindSchema(kind: NftAiProposalKind): string {
  if (kind === "trait-system") return 'For trait-system, payload must contain {"traits":[{"id":"stable-id","label":"Trait Label","values":[{"value":"Value","weight":1}]}]}. Weights are relative positive numbers. Build enough combinatorial space for the requested supply.';
  if (kind === "launch-strategy") return 'For launch-strategy, payload must contain {"launchPlan":{"mintType":"open-collection|scheduled-drop","reveal":"instant|post-mint|manual","phases":[{"name":"...","audience":"...","allowlistRequired":false,"start":"optional","end":"optional","priceNote":"optional"}],"story":"...","roadmap":["..."],"communityPlan":["..."]}}. Never fabricate dates, wallet addresses, prices, partnerships, audience size, or guaranteed demand.';
  if (kind === "collection-strategy") return 'For collection-strategy, payload may contain audience, artisticThesis, styleGuide, lore, rightsNote, description, and optional audience hypotheses. Focus on originality, visual coherence, collector comprehension, and testable positioning.';
  return 'For copy, payload may contain description, lore, audience, artisticThesis, or styleGuide. Keep claims truthful and avoid financial promises.';
}

function collectionSummary(collection: NftCollection): Readonly<Record<string, unknown>> {
  return Object.freeze({ id: collection.id, title: collection.title, symbol: collection.symbol, description: collection.description, collectionType: collection.collectionType, tokenStandard: collection.tokenStandard, chain: collection.chain, supply: collection.supply, royaltyBps: collection.royaltyBps, storageMode: collection.storageMode, audience: collection.audience, artisticThesis: collection.artisticThesis, styleGuide: collection.styleGuide, lore: collection.lore, rightsNote: collection.rightsNote, traits: collection.traits, itemCount: collection.items.length, approvedArtworkCount: collection.items.filter((item) => item.artworkStatus === "approved").length, launchPlan: collection.launchPlan ?? null });
}
function memoryFor(project: ProjectState): ProjectMemoryStore { const memory = new ProjectMemoryStore(); memory.restore(project.memories); return memory; }
function parseObject(text: string, label: string): Record<string, unknown> { const source = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1] ?? text.trim(); try { return objectValue(JSON.parse(source), label); } catch (error) { if (error instanceof Error && error.message.startsWith(label)) throw error; throw new Error(`${label} was not valid JSON.`); } }
function objectValue(value: unknown, label: string): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`); return value as Record<string, unknown>; }
function requiredText(value: unknown, label: string, max: number): string { if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`); const normalized = value.trim(); if (normalized.length > max) throw new Error(`${label} exceeds ${max} characters.`); return normalized; }
function optionalText(value: unknown, max: number): string | undefined { if (value === undefined || value === null || value === "") return undefined; if (typeof value !== "string") throw new Error("Optional NFT text must be a string."); const normalized = value.trim(); if (!normalized) return undefined; if (normalized.length > max) throw new Error(`Optional NFT text exceeds ${max} characters.`); return normalized; }
function stringArray(value: unknown, maxItems: number, maxLength: number): string[] { if (value === undefined || value === null) return []; if (!Array.isArray(value) || value.length > maxItems) throw new Error(`NFT text list must contain at most ${maxItems} items.`); return value.map((entry, index) => requiredText(entry, `NFT text list item ${index + 1}`, maxLength)); }
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function csvCell(value: unknown): string { const text = String(value ?? ""); return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
function evidence(result: AiGenerationResult): Pick<AiGenerationResult, "provider" | "model" | "requestId" | "attempts" | "optimization"> { return { provider: result.provider, model: result.model, ...(result.requestId ? { requestId: result.requestId } : {}), ...(result.attempts ? { attempts: result.attempts } : {}), ...(result.optimization ? { optimization: result.optimization } : {}) }; }

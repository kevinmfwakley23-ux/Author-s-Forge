import { randomUUID } from "node:crypto";
import { ProjectMemoryStore } from "./project-memory-store";
import { generateProjectImage, type ImageGenerationQuality, type ImageGenerationResult, type ImageGenerationSize, type ImageReferenceInput, type ProjectImageGenerationRequest } from "../infrastructure/image-provider";
import { createIllustrationAsset, updateIllustrationAsset, validateIllustrationAssetLibraryState, type IllustrationAsset, type IllustrationAssetLibraryState } from "../domain/illustration-asset-library";
import { validateStudioWorkspace } from "../domain/studio-workspace";
import { withProjectIllustrationAssetLibrary, type ProjectState } from "../domain/project";
import type { FileProjectStore } from "../infrastructure/file-project-store";

export type StudioImageGenerator = (request: ProjectImageGenerationRequest) => Promise<ImageGenerationResult>;
export type StudioImagePurpose = "illustration" | "character-reference" | "location-reference" | "concept-art" | "cover-art";
export const STUDIO_IMAGE_PURPOSES = ["illustration", "character-reference", "location-reference", "concept-art", "cover-art"] as const;
export const STUDIO_IMAGE_SIZES: readonly ImageGenerationSize[] = ["1024x1024", "1536x1024", "1024x1536", "2048x2048", "2048x1152", "auto"];
export const STUDIO_IMAGE_QUALITIES: readonly ImageGenerationQuality[] = ["low", "medium", "high", "auto"];
const MAX_INLINE_REFERENCE_BYTES = 5 * 1024 * 1024;

export interface StudioImageLabGenerateInput {
  readonly projectId: string;
  readonly prompt: string;
  readonly style?: string;
  readonly purpose?: StudioImagePurpose;
  readonly size?: ImageGenerationSize;
  readonly quality?: ImageGenerationQuality;
  readonly referenceImage?: string;
  readonly referenceLabel?: string;
  readonly sourceAssetId?: string;
  readonly characterId?: string;
  readonly locationId?: string;
  readonly now?: string;
}

export interface StudioImageLabGenerateResult {
  readonly project: ProjectState;
  readonly asset: IllustrationAsset;
  readonly sourceAsset?: IllustrationAsset;
  readonly provider: ImageGenerationResult["provider"];
  readonly model: string;
  readonly requestId?: string;
  readonly url: string;
}

export class StudioImageLabService {
  constructor(private readonly store: FileProjectStore, private readonly image: StudioImageGenerator = generateProjectImage) {}

  async list(projectId: string): Promise<readonly IllustrationAsset[]> {
    const project = await this.requireProject(projectId);
    return [...this.library(project).assets].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  }

  async generate(input: StudioImageLabGenerateInput): Promise<StudioImageLabGenerateResult> {
    const project = await this.requireProject(requiredId(input.projectId, "Project id"));
    const prompt = requiredText(input.prompt, "Image direction", 6000);
    const style = optionalText(input.style, "Image style", 500) ?? "author-directed";
    const purpose = enumValue(input.purpose ?? "illustration", STUDIO_IMAGE_PURPOSES, "image purpose");
    const size = enumValue(input.size ?? "1024x1024", STUDIO_IMAGE_SIZES, "image size");
    const quality = enumValue(input.quality ?? "medium", STUDIO_IMAGE_QUALITIES, "image quality");
    const now = timestamp(input.now ?? new Date().toISOString(), "Image generation timestamp");
    if (input.referenceImage && input.sourceAssetId) throw new Error("Choose either an uploaded reference image or an existing source asset, not both.");

    const context = activeContext(project);
    let library = this.library(project);
    let sourceAsset: IllustrationAsset | undefined;
    let referenceImages: readonly ImageReferenceInput[] | undefined;

    if (input.sourceAssetId) {
      sourceAsset = library.assets.find((asset) => asset.id === requiredId(input.sourceAssetId!, "Source asset id"));
      if (!sourceAsset) throw new Error(`Source illustration asset "${input.sourceAssetId}" not found.`);
      if (sourceAsset.approvalStatus === "rejected") throw new Error("Rejected artwork cannot be used as an edit source.");
      requireInlineImage(sourceAsset.assetUri, "Stored source artwork");
      referenceImages = [{ dataUri: sourceAsset.assetUri, label: sourceAsset.prompt.slice(0, 120) }];
    } else if (input.referenceImage) {
      const referenceData = requireInlineImage(input.referenceImage, "Uploaded reference image");
      sourceAsset = createIllustrationAsset({
        id: `image-source-${randomUUID()}`,
        projectId: project.metadata.id,
        bookId: context.bookId,
        chapterId: context.chapterId,
        sceneId: context.sceneId,
        characterId: optionalId(input.characterId) ?? context.characterId,
        locationId: optionalId(input.locationId) ?? "unassigned-location",
        prompt: optionalText(input.referenceLabel, "Reference label", 300) ?? "Author-uploaded source image",
        references: [],
        style: "author-uploaded-source",
        generationSettings: { origin: "author-upload", purpose },
        approvalStatus: "approved",
        assetUri: referenceData,
        now,
      });
      library = validateIllustrationAssetLibraryState({ ...library, assets: [...library.assets, sourceAsset] });
      referenceImages = [{ dataUri: referenceData, label: sourceAsset.prompt }];
    }

    const memory = new ProjectMemoryStore();
    for (const record of project.memories) memory.register(record);
    const result = await this.image({
      memory,
      context: {
        projectId: project.metadata.id,
        taskMemoryClasses: ["project-memory", "story-canon", "character-memory", "style-memory", "visual-identity", "research-memory", "decision-memory", "production-memory"],
        relevanceTags: ["illustration", "visual-identity", purpose],
        queryTerms: [project.metadata.title, prompt, style],
        includeWorkingState: true,
        limit: 60,
      },
      prompt: [
        `Purpose: ${purpose}.`,
        `Author direction: ${prompt}`,
        `Style direction: ${style}.`,
        sourceAsset ? "This is a non-destructive edit/variation. Preserve the source image except where the author explicitly requested a change." : "Create original artwork for the author request.",
      ].join("\n"),
      size,
      quality,
      referenceImages,
    });

    const asset = createIllustrationAsset({
      id: `image-${randomUUID()}`,
      projectId: project.metadata.id,
      bookId: context.bookId,
      chapterId: context.chapterId,
      sceneId: context.sceneId,
      characterId: optionalId(input.characterId) ?? sourceAsset?.characterId ?? context.characterId,
      locationId: optionalId(input.locationId) ?? sourceAsset?.locationId ?? "unassigned-location",
      prompt,
      references: sourceAsset ? [{ id: `ref-${randomUUID()}`, uri: sourceAsset.assetUri, label: sourceAsset.prompt, kind: "source", notes: "Preserved source for non-destructive image generation/edit lineage." }] : [],
      style,
      generationSettings: { purpose, size, quality, provider: result.provider, model: result.model },
      approvalStatus: "pending",
      assetUri: result.dataUri,
      reusedFromAssetId: sourceAsset?.id,
      now,
    });
    library = validateIllustrationAssetLibraryState({ ...library, assets: [...library.assets, asset] });
    const saved = withProjectIllustrationAssetLibrary(project, library, now);
    await this.store.save(saved);
    return Object.freeze({ project: saved, asset, ...(sourceAsset ? { sourceAsset } : {}), provider: result.provider, model: result.model, ...(result.requestId ? { requestId: result.requestId } : {}), url: result.dataUri });
  }

  async review(input: { projectId: string; assetId: string; decision: "approved" | "rejected"; now?: string }): Promise<{ project: ProjectState; asset: IllustrationAsset }> {
    const project = await this.requireProject(requiredId(input.projectId, "Project id"));
    const assetId = requiredId(input.assetId, "Image asset id");
    const decision = enumValue(input.decision, ["approved", "rejected"] as const, "image review decision");
    const library = this.library(project);
    const existing = library.assets.find((asset) => asset.id === assetId);
    if (!existing) throw new Error(`Illustration asset "${assetId}" not found.`);
    if (existing.approvalStatus === decision) throw new Error(`Illustration asset is already ${decision}.`);
    const updated = updateIllustrationAsset(existing, { id: existing.id, approvalStatus: decision, now: input.now });
    const nextLibrary = validateIllustrationAssetLibraryState({ ...library, assets: library.assets.map((asset) => asset.id === updated.id ? updated : asset) });
    const saved = withProjectIllustrationAssetLibrary(project, nextLibrary, input.now ?? new Date().toISOString());
    await this.store.save(saved);
    return Object.freeze({ project: saved, asset: updated });
  }

  private async requireProject(projectId: string): Promise<ProjectState> {
    const project = await this.store.load(projectId);
    if (!project) throw new Error(`Project "${projectId}" not found.`);
    return project;
  }

  private library(project: ProjectState): IllustrationAssetLibraryState {
    return project.illustrationAssetLibrary ?? { formatVersion: 1, projectId: project.metadata.id, assets: [], characterDesignLocks: [] };
  }
}

function activeContext(project: ProjectState): { bookId: string; chapterId: string; sceneId: string; characterId: string } {
  if (!project.studioWorkspace) throw new Error("Create a book, chapter, and scene before generating project artwork.");
  const workspace = validateStudioWorkspace(project.studioWorkspace);
  const book = workspace.books.find((item) => item.id === workspace.activeBookId) ?? workspace.books[0];
  const chapter = book?.chapters[0];
  const scene = chapter?.scenes[0];
  if (!book || !chapter || !scene) throw new Error("Create a book, chapter, and scene before generating project artwork.");
  return { bookId: book.id, chapterId: chapter.id, sceneId: scene.id, characterId: project.characters?.[0]?.id ?? "unassigned-character" };
}
function requireInlineImage(value: string, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} must be an inline PNG, JPEG, or WebP image.`);
  const match = value.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/i);
  if (!match) throw new Error(`${label} must be an inline PNG, JPEG, or WebP image.`);
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.byteLength) throw new Error(`${label} is empty.`);
  if (bytes.byteLength > MAX_INLINE_REFERENCE_BYTES) throw new Error(`${label} exceeds the 5 MiB Studio upload limit.`);
  if (bytes.toString("base64").replace(/=+$/, "") !== match[2].replace(/=+$/, "")) throw new Error(`${label} contains invalid base64 data.`);
  return value;
}
function requiredId(value: string, label: string): string { if (typeof value !== "string" || !value.trim() || value !== value.trim() || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error(`${label} is invalid.`); return value; }
function optionalId(value: string | undefined): string | undefined { return value === undefined || !value.trim() ? undefined : requiredId(value, "Optional id"); }
function requiredText(value: string, label: string, max: number): string { if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`); const text = value.trim(); if (text.length > max) throw new Error(`${label} exceeds ${max} characters.`); return text; }
function optionalText(value: string | undefined, label: string, max: number): string | undefined { return value === undefined || !value.trim() ? undefined : requiredText(value, label, max); }
function timestamp(value: string, label: string): string { if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new Error(`${label} must be a valid timestamp.`); return new Date(value).toISOString(); }
function enumValue<T extends string>(value: unknown, allowed: readonly T[], label: string): T { if (typeof value !== "string" || !allowed.includes(value as T)) throw new Error(`Invalid ${label}.`); return value as T; }

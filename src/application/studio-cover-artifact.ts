import { createHash, randomUUID } from "node:crypto";
import type { BookCoverPlan } from "../domain/book-cover-studio";
import { withProjectBookCoverPlans, type ProjectState } from "../domain/project";
import type { IllustrationAsset } from "../domain/illustration-asset-library";
import {
  SPECIALIZED_DOCUMENT_FORMAT_VERSION,
  SPECIALIZED_OFFICE_FORMAT_VERSION,
  SPECIALIZED_PRODUCTION_PROFILE_VERSION,
  type FlyerData,
  type SpecializedAsset,
  type SpecializedDocument,
  type SpecializedElement,
  type SpecializedOfficeProject,
  type SpecializedProductionProfile,
  type SpecializedSurface,
} from "../domain/specialized-creation-office";
import type { CoverArtifactEvidence, ReleaseCoverFormat } from "../domain/cover-artifact-evidence";
import type { FileProjectStore } from "../infrastructure/file-project-store";
import { FileCoverArtifactVault } from "../infrastructure/file-cover-artifact-vault";
import { SpecializedCreationProductionEngine, type SpecializedRenderedArtifact } from "./specialized-creation-production-engine";
import { renderSpecializedJpegFromPng } from "./specialized-creation-jpeg";

const COVER_DPI = 300;
const KDP_EBOOK_MIN_WIDTH = 625;
const KDP_EBOOK_MIN_HEIGHT = 1000;
const KDP_EBOOK_MAX_DIMENSION = 10_000;
const KDP_EBOOK_MAX_BYTES = 50 * 1024 * 1024;

export interface StudioCoverArtifactInput {
  readonly projectId: string;
  readonly bookId: string;
  readonly planId: string;
  readonly assetId: string;
  readonly authorApproved: boolean;
  readonly now?: string;
}

export interface StudioCoverArtifactResult {
  readonly project: ProjectState;
  readonly evidence: CoverArtifactEvidence;
  readonly contentBase64: string;
  readonly downloadPath: string;
}

export class StudioCoverArtifactService {
  private readonly compositor = new SpecializedCreationProductionEngine();

  constructor(private readonly store: FileProjectStore, private readonly vault: FileCoverArtifactVault) {}

  async render(input: StudioCoverArtifactInput): Promise<StudioCoverArtifactResult> {
    const projectId = requiredId(input.projectId, "Project id");
    const bookId = requiredId(input.bookId, "Book id");
    const planId = requiredId(input.planId, "Cover plan id");
    const assetId = requiredId(input.assetId, "Cover artwork asset id");
    if (input.authorApproved !== true) throw new Error("Explicit author approval is required before Forge renders and promotes a final cover artifact.");
    const now = timestamp(input.now ?? new Date().toISOString());
    const current = await this.requireProject(projectId);
    const plan = this.requirePlan(current, bookId, planId);
    const sourceAsset = this.requireCoverArtwork(current, bookId, assetId);
    const image = embeddedImage(sourceAsset.assetUri);
    const approvedPlan: BookCoverPlan = plan.approvalStatus === "approved"
      ? plan
      : Object.freeze({ ...plan, approvalStatus: "approved" as const, updatedAt: now });
    const composition = coverComposition(approvedPlan, sourceAsset, image.width, image.height, image.mimeType, now);
    const png = this.compositor.render(composition.project, composition.profile, "png", composition.project);
    const jpegArtifact = renderSpecializedJpegFromPng(png, 95);
    const jpegBytes = Buffer.from(jpegArtifact.bytesBase64, "base64");
    const coverFormat = releaseFormat(approvedPlan.format);
    let fileFormat: "jpeg" | "pdf";
    let fileName: string;
    let bytes: Buffer;
    let widthInches: number;
    let heightInches: number;
    if (coverFormat === "ebook") {
      validateEbookCover(jpegArtifact, jpegBytes);
      fileFormat = "jpeg";
      fileName = `${safeName(approvedPlan.title)}-ebook-cover.jpg`;
      bytes = jpegBytes;
      widthInches = composition.profile.widthInches;
      heightInches = composition.profile.heightInches;
    } else {
      fileFormat = "pdf";
      fileName = `${safeName(approvedPlan.title)}-${coverFormat}-cover.pdf`;
      widthInches = approvedPlan.dimensions.widthInches;
      heightInches = approvedPlan.dimensions.heightInches;
      bytes = singleImagePdf(jpegBytes, jpegArtifact.widthPixels ?? 0, jpegArtifact.heightPixels ?? 0, widthInches, heightInches);
      if (bytes.length > 650 * 1024 * 1024) throw new Error("Rendered print cover exceeds KDP's 650 MB cover limit.");
    }
    const artifactId = `cover-artifact-${randomUUID()}`;
    const sourceAssetSha256 = createHash("sha256").update(image.bytes).digest("hex");
    const evidence = await this.vault.save({
      artifactId,
      projectId,
      bookId,
      plan: approvedPlan,
      sourceAssetId: sourceAsset.id,
      sourceAssetSha256,
      fileFormat,
      fileName,
      bytes,
      widthPixels: positiveInteger(jpegArtifact.widthPixels, "Rendered cover pixel width"),
      heightPixels: positiveInteger(jpegArtifact.heightPixels, "Rendered cover pixel height"),
      widthInches,
      heightInches,
      dpi: COVER_DPI,
      generatedAt: now,
    });
    const downloadPath = `/api/projects/${encodeURIComponent(projectId)}/cover/artifacts/${encodeURIComponent(evidence.artifactId)}/file`;
    const promotedPlan: BookCoverPlan = Object.freeze({
      ...approvedPlan,
      outputUri: downloadPath,
      outputFormat: fileFormat === "jpeg" ? "jpeg" : "pdf",
      dpi: COVER_DPI,
      updatedAt: now,
    });
    const plans = (current.bookCoverPlans ?? []).map((candidate) => candidate.id === promotedPlan.id ? promotedPlan : candidate);
    const project = withProjectBookCoverPlans(current, plans, now);
    await this.store.save(project);
    return Object.freeze({ project, evidence, contentBase64: bytes.toString("base64"), downloadPath });
  }

  private async requireProject(projectId: string): Promise<ProjectState> {
    const project = await this.store.load(projectId);
    if (!project) throw new Error(`Project "${projectId}" was not found.`);
    return project;
  }

  private requirePlan(project: ProjectState, bookId: string, planId: string): BookCoverPlan {
    const plan = (project.bookCoverPlans ?? []).find((candidate) => candidate.id === planId && candidate.bookId === bookId);
    if (!plan) throw new Error(`Cover Studio plan "${planId}" was not found for book "${bookId}".`);
    if (plan.projectId !== project.metadata.id) throw new Error("Cover Studio plan belongs to another project.");
    releaseFormat(plan.format);
    return plan;
  }

  private requireCoverArtwork(project: ProjectState, bookId: string, assetId: string): IllustrationAsset {
    const asset = project.illustrationAssetLibrary?.assets.find((candidate) => candidate.id === assetId && candidate.bookId === bookId);
    if (!asset) throw new Error(`Image Lab cover artwork "${assetId}" was not found for book "${bookId}".`);
    if (asset.projectId !== project.metadata.id) throw new Error("Cover artwork belongs to another project.");
    if (asset.approvalStatus !== "approved") throw new Error("Final cover production requires an author-approved Image Lab artwork asset.");
    if (asset.generationSettings.purpose !== "cover-art") throw new Error("Final cover production requires an Image Lab asset whose purpose is cover-art.");
    return asset;
  }
}

function coverComposition(
  plan: BookCoverPlan,
  sourceAsset: IllustrationAsset,
  sourceWidth: number,
  sourceHeight: number,
  mimeType: string,
  now: string,
): { readonly project: SpecializedOfficeProject; readonly profile: SpecializedProductionProfile } {
  const coverFormat = releaseFormat(plan.format);
  const projectId = `cover-compose-${plan.id}`;
  const profile = productionProfile(plan, coverFormat, sourceWidth, sourceHeight);
  const surface = coverSurface(plan, coverFormat, profile, sourceAsset.id, sourceWidth, sourceHeight);
  const document: SpecializedDocument = Object.freeze({
    formatVersion: SPECIALIZED_DOCUMENT_FORMAT_VERSION,
    id: `cover-document-${plan.id}`,
    projectId,
    title: `${plan.title} final ${coverFormat} cover`,
    mode: "flyer",
    surfaces: Object.freeze([surface]),
    styleTokens: Object.freeze({}),
    createdAt: now,
    updatedAt: now,
  });
  const asset: SpecializedAsset = Object.freeze({
    id: sourceAsset.id,
    projectId,
    kind: "artwork",
    name: `${plan.title} approved cover artwork`,
    uri: sourceAsset.assetUri,
    mimeType,
    pixelWidth: sourceWidth,
    pixelHeight: sourceHeight,
    source: typeof sourceAsset.generationSettings.provider === "string" ? "generated" : "author",
    sourceReference: sourceAsset.id,
    ...(typeof sourceAsset.generationSettings.provider === "string" ? { provider: sourceAsset.generationSettings.provider } : {}),
    ...(typeof sourceAsset.generationSettings.model === "string" ? { model: sourceAsset.generationSettings.model } : {}),
    approved: true,
    createdAt: sourceAsset.createdAt,
  });
  const modeData: FlyerData = Object.freeze({
    objective: "Produce the author-approved final book cover",
    audience: "Book buyers and readers",
    headline: plan.title,
    details: plan.backText,
    brandElements: [],
    trustElements: [],
    primaryCta: "Read the book",
    destination: "KDP publication",
    secondaryActions: [],
  });
  const project: SpecializedOfficeProject = Object.freeze({
    formatVersion: SPECIALIZED_OFFICE_FORMAT_VERSION,
    id: projectId,
    forgeProjectId: plan.projectId,
    mode: "flyer",
    title: plan.title,
    brief: plan.frontPrompt,
    audience: "Readers",
    stage: "production",
    modeData,
    documents: Object.freeze([document]),
    assets: Object.freeze([asset]),
    proposals: Object.freeze([]),
    revisions: Object.freeze([]),
    productionProfiles: Object.freeze([profile]),
    artifacts: Object.freeze([]),
    createdAt: now,
    updatedAt: now,
  });
  return Object.freeze({ project, profile });
}

function productionProfile(plan: BookCoverPlan, format: ReleaseCoverFormat, sourceWidth: number, sourceHeight: number): SpecializedProductionProfile {
  const widthInches = format === "ebook" ? sourceWidth / COVER_DPI : plan.dimensions.widthInches;
  const heightInches = format === "ebook" ? sourceHeight / COVER_DPI : plan.dimensions.heightInches;
  const bleedInches = format === "ebook" ? 0 : plan.publishing.bleedInches;
  const safeMarginInches = format === "ebook" ? 0.2 : Math.max(plan.zones.safeMarginInches, bleedInches);
  return Object.freeze({
    formatVersion: SPECIALIZED_PRODUCTION_PROFILE_VERSION,
    id: `cover-${format}-300dpi`,
    label: `${format} cover production`,
    widthInches,
    heightInches,
    bleedInches,
    safeMarginInches,
    dpi: COVER_DPI,
    colorIntent: "sRGB",
    artifactKinds: Object.freeze(["png"] as const),
    duplex: false,
    notes: Object.freeze(["Final cover raster is flattened before JPEG/PDF packaging."]),
  });
}

function coverSurface(
  plan: BookCoverPlan,
  format: ReleaseCoverFormat,
  profile: SpecializedProductionProfile,
  assetId: string,
  sourceWidth: number,
  sourceHeight: number,
): SpecializedSurface {
  const elements: SpecializedElement[] = [];
  elements.push(shape("cover-background", 0, 0, profile.widthInches, profile.heightInches, "#151515", 0));
  if (format === "ebook") {
    elements.push(image("cover-art", assetId, 0, 0, profile.widthInches, profile.heightInches, 1));
    const margin = Math.min(0.3, profile.widthInches * 0.08);
    const titleHeight = Math.min(1.5, profile.heightInches * 0.25);
    elements.push(shape("title-backing", margin, margin, profile.widthInches - margin * 2, titleHeight, "#111111", 2, 0.62));
    elements.push(text("cover-title", plan.title, margin * 1.3, margin * 1.2, profile.widthInches - margin * 2.6, titleHeight * 0.8, 30, "#ffffff", 3, "bold"));
    const authorHeight = Math.min(0.7, profile.heightInches * 0.12);
    const authorY = profile.heightInches - authorHeight - margin;
    elements.push(shape("author-backing", margin, authorY, profile.widthInches - margin * 2, authorHeight, "#111111", 4, 0.62));
    elements.push(text("cover-author", plan.author, margin * 1.3, authorY + 0.08, profile.widthInches - margin * 2.6, authorHeight - 0.12, 18, "#ffffff", 5, "bold"));
  } else {
    const safe = Math.max(0.25, plan.zones.safeMarginInches);
    const front = plan.zones.front;
    const artContainer = {
      x: front.x + safe,
      y: front.y + safe + 1.15,
      width: Math.max(0.5, front.width - safe * 2),
      height: Math.max(0.5, front.height - safe * 2 - 2.0),
    };
    const fitted = fitWithoutUpscale(artContainer, sourceWidth / COVER_DPI, sourceHeight / COVER_DPI);
    elements.push(image("cover-art", assetId, fitted.x, fitted.y, fitted.width, fitted.height, 2));
    elements.push(text("cover-title", plan.title, front.x + safe, front.y + safe, front.width - safe * 2, 0.95, 24, "#ffffff", 3, "bold"));
    elements.push(text("cover-author", plan.author, front.x + safe, front.y + front.height - safe - 0.55, front.width - safe * 2, 0.45, 14, "#ffffff", 4, "bold"));
    const back = plan.zones.back;
    const barcode = plan.zones.barcodeSafeArea;
    const backHeight = Math.max(1, Math.min(back.height - safe * 2, barcode.y - back.y - safe * 1.5));
    elements.push(text("cover-back-copy", plan.backText, back.x + safe, back.y + safe, back.width - safe * 2, backHeight, 10, "#ffffff", 3));
    elements.push(shape("barcode-safe-area", barcode.x, barcode.y, barcode.width, barcode.height, "#ffffff", 8));
  }
  return Object.freeze({
    id: `cover-surface-${plan.id}`,
    kind: "front",
    label: `Final ${format} cover`,
    widthInches: profile.widthInches,
    heightInches: profile.heightInches,
    bleedInches: profile.bleedInches,
    safeMarginInches: profile.safeMarginInches,
    readingOrder: 1,
    elements: Object.freeze(elements),
  });
}

function fitWithoutUpscale(container: { x: number; y: number; width: number; height: number }, sourceWidthInches: number, sourceHeightInches: number) {
  const scale = Math.min(1, container.width / sourceWidthInches, container.height / sourceHeightInches);
  const width = sourceWidthInches * scale;
  const height = sourceHeightInches * scale;
  return Object.freeze({
    x: container.x + (container.width - width) / 2,
    y: container.y + (container.height - height) / 2,
    width,
    height,
  });
}

function shape(id: string, x: number, y: number, width: number, height: number, fill: string, zIndex: number, opacity = 1): SpecializedElement {
  return Object.freeze({ id, kind: "shape", box: { x, y, width, height }, locked: true, zIndex, rotationDegrees: 0, style: { fill, opacity }, metadata: Object.freeze({}) });
}
function image(id: string, assetId: string, x: number, y: number, width: number, height: number, zIndex: number): SpecializedElement {
  return Object.freeze({ id, kind: "image", assetId, box: { x, y, width, height }, locked: true, zIndex, rotationDegrees: 0, style: Object.freeze({}), metadata: Object.freeze({}) });
}
function text(id: string, value: string, x: number, y: number, width: number, height: number, fontSizePt: number, fill: string, zIndex: number, fontWeight: "normal" | "bold" = "normal"): SpecializedElement {
  return Object.freeze({ id, kind: "text", role: id.includes("title") ? "title" : "body", box: { x, y, width, height }, text: value, locked: true, zIndex, rotationDegrees: 0, style: { fontSizePt, fontWeight, fill }, metadata: Object.freeze({}) });
}

function embeddedImage(uri: string): { readonly mimeType: "image/png" | "image/jpeg"; readonly bytes: Buffer; readonly width: number; readonly height: number } {
  const match = uri.match(/^data:image\/(png|jpeg|jpg);base64,([A-Za-z0-9+/=\r\n]+)$/i);
  if (!match) throw new Error("Final cover artwork must be a durable embedded PNG/JPEG Image Lab asset.");
  const bytes = Buffer.from(match[2].replace(/\s+/g, ""), "base64");
  if (!bytes.length) throw new Error("Final cover artwork contains no image bytes.");
  if (match[1].toLowerCase() === "png") {
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    if (bytes.length < 24 || !bytes.subarray(0, 8).equals(signature)) throw new Error("Final cover PNG is invalid.");
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    if (!width || !height) throw new Error("Final cover PNG dimensions are invalid.");
    return Object.freeze({ mimeType: "image/png", bytes, width, height });
  }
  const dimensions = jpegDimensions(bytes);
  return Object.freeze({ mimeType: "image/jpeg", bytes, width: dimensions.width, height: dimensions.height });
}

function jpegDimensions(bytes: Buffer): { readonly width: number; readonly height: number } {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error("Final cover JPEG is invalid.");
  let offset = 2;
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd9 || marker === 0xda) break;
    if (offset + 2 > bytes.length) break;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) break;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      const height = bytes.readUInt16BE(offset + 3);
      const width = bytes.readUInt16BE(offset + 5);
      if (!width || !height) break;
      return Object.freeze({ width, height });
    }
    offset += length;
  }
  throw new Error("Final cover JPEG dimensions could not be read.");
}

function validateEbookCover(artifact: SpecializedRenderedArtifact, bytes: Buffer): void {
  const width = positiveInteger(artifact.widthPixels, "eBook cover pixel width");
  const height = positiveInteger(artifact.heightPixels, "eBook cover pixel height");
  if (width < KDP_EBOOK_MIN_WIDTH || height < KDP_EBOOK_MIN_HEIGHT) throw new Error(`KDP eBook cover is too small (${width}×${height}); minimum is ${KDP_EBOOK_MIN_WIDTH}×${KDP_EBOOK_MIN_HEIGHT} pixels.`);
  if (width > KDP_EBOOK_MAX_DIMENSION || height > KDP_EBOOK_MAX_DIMENSION) throw new Error(`KDP eBook cover exceeds the ${KDP_EBOOK_MAX_DIMENSION}-pixel maximum dimension.`);
  if (height <= width) throw new Error("KDP eBook cover artwork must be portrait-oriented.");
  if (bytes.length >= KDP_EBOOK_MAX_BYTES) throw new Error("KDP eBook cover must be smaller than 50 MB.");
}

function singleImagePdf(jpegBytes: Buffer, widthPixels: number, heightPixels: number, widthInches: number, heightInches: number): Buffer {
  positiveInteger(widthPixels, "Print cover raster width");
  positiveInteger(heightPixels, "Print cover raster height");
  const widthPoints = widthInches * 72;
  const heightPoints = heightInches * 72;
  const content = Buffer.from(`q\n${widthPoints.toFixed(4)} 0 0 ${heightPoints.toFixed(4)} 0 0 cm\n/Im0 Do\nQ\n`, "ascii");
  const objects: Buffer[] = [
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "ascii"),
    Buffer.from("<< /Type /Pages /Kids [5 0 R] /Count 1 >>", "ascii"),
    Buffer.concat([
      Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${widthPixels} /Height ${heightPixels} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`, "ascii"),
      jpegBytes,
      Buffer.from("\nendstream", "ascii"),
    ]),
    Buffer.concat([Buffer.from(`<< /Length ${content.length} >>\nstream\n`, "ascii"), content, Buffer.from("endstream", "ascii")]),
    Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${widthPoints.toFixed(4)} ${heightPoints.toFixed(4)}] /BleedBox [0 0 ${widthPoints.toFixed(4)} ${heightPoints.toFixed(4)}] /Resources << /XObject << /Im0 3 0 R >> >> /Contents 4 0 R >>`, "ascii"),
  ];
  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "binary")];
  const offsets = [0];
  let length = chunks[0].length;
  for (let index = 0; index < objects.length; index += 1) {
    offsets[index + 1] = length;
    const prefix = Buffer.from(`${index + 1} 0 obj\n`, "ascii");
    const suffix = Buffer.from("\nendobj\n", "ascii");
    chunks.push(prefix, objects[index], suffix);
    length += prefix.length + objects[index].length + suffix.length;
  }
  const xrefOffset = length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) xref += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  chunks.push(Buffer.from(xref, "ascii"));
  return Buffer.concat(chunks);
}

function releaseFormat(value: BookCoverPlan["format"]): ReleaseCoverFormat {
  if (value !== "ebook" && value !== "paperback" && value !== "hardcover") throw new Error("Final cover production requires an eBook, paperback, or hardcover Cover Studio plan.");
  return value;
}
function positiveInteger(value: number | undefined, label: string): number {
  if (!Number.isInteger(value) || (value ?? 0) <= 0) throw new Error(`${label} must be a positive integer.`);
  return value as number;
}
function requiredId(value: string, label: string): string {
  if (!value || value !== value.trim() || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error(`${label} is invalid.`);
  return value;
}
function timestamp(value: string): string {
  if (Number.isNaN(Date.parse(value))) throw new Error("Cover artifact timestamp must be valid.");
  return new Date(value).toISOString();
}
function safeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "book";
}

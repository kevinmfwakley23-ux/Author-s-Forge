import { createHash } from "node:crypto";
import type { BookCoverPlan } from "./book-cover-studio";

export const COVER_ARTIFACT_EVIDENCE_FORMAT_VERSION = 1 as const;
export type ReleaseCoverFormat = "ebook" | "paperback" | "hardcover";
export type CoverArtifactFileFormat = "jpeg" | "pdf";

export interface CoverArtifactEvidence {
  readonly formatVersion: typeof COVER_ARTIFACT_EVIDENCE_FORMAT_VERSION;
  readonly artifactId: string;
  readonly projectId: string;
  readonly bookId: string;
  readonly planId: string;
  readonly planVersion: number;
  readonly coverFormat: ReleaseCoverFormat;
  readonly fileFormat: CoverArtifactFileFormat;
  readonly mimeType: string;
  readonly fileName: string;
  readonly storageFileName: string;
  readonly byteLength: number;
  readonly sha256: string;
  readonly planSha256: string;
  readonly sourceAssetId: string;
  readonly sourceAssetSha256: string;
  readonly widthPixels: number;
  readonly heightPixels: number;
  readonly widthInches: number;
  readonly heightInches: number;
  readonly dpi: number;
  readonly generatedAt: string;
}

export interface CoverArtifactVerification {
  readonly evidence: CoverArtifactEvidence;
  readonly valid: boolean;
  readonly issues: readonly string[];
}

export function coverPlanSha256(plan: BookCoverPlan): string {
  const snapshot = {
    formatVersion: plan.formatVersion,
    id: plan.id,
    projectId: plan.projectId,
    bookId: plan.bookId,
    format: plan.format,
    publishing: {
      platform: plan.publishing.platform,
      binding: plan.publishing.binding,
      interiorType: plan.publishing.interiorType ?? null,
      paperType: plan.publishing.paperType ?? null,
      trimWidthInches: plan.publishing.trimWidthInches,
      trimHeightInches: plan.publishing.trimHeightInches,
      pageCount: plan.publishing.pageCount,
      bleedInches: plan.publishing.bleedInches,
      readingDirection: plan.publishing.readingDirection,
    },
    dimensions: { ...plan.dimensions },
    zones: {
      front: { ...plan.zones.front },
      spine: { ...plan.zones.spine },
      back: { ...plan.zones.back },
      barcodeSafeArea: { ...plan.zones.barcodeSafeArea },
      trim: { ...plan.zones.trim },
      safeMarginInches: plan.zones.safeMarginInches,
    },
    title: plan.title,
    author: plan.author,
    frontPrompt: plan.frontPrompt,
    spineText: plan.spineText,
    backText: plan.backText,
    artworkUri: plan.artworkUri ?? null,
    outputFormat: plan.outputFormat,
    dpi: plan.dpi,
    version: plan.version,
    approvalStatus: plan.approvalStatus,
  };
  return createHash("sha256").update(JSON.stringify(snapshot), "utf8").digest("hex");
}

export function createCoverArtifactEvidence(input: {
  readonly artifactId: string;
  readonly projectId: string;
  readonly bookId: string;
  readonly plan: BookCoverPlan;
  readonly sourceAssetId: string;
  readonly sourceAssetSha256: string;
  readonly fileFormat: CoverArtifactFileFormat;
  readonly fileName: string;
  readonly storageFileName: string;
  readonly byteLength: number;
  readonly sha256: string;
  readonly widthPixels: number;
  readonly heightPixels: number;
  readonly widthInches: number;
  readonly heightInches: number;
  readonly dpi: number;
  readonly generatedAt: string;
}): CoverArtifactEvidence {
  const coverFormat = releaseCoverFormat(input.plan.format);
  const fileFormat = fileFormatValue(input.fileFormat);
  if (coverFormat === "ebook" && fileFormat !== "jpeg") throw new Error("KDP eBook cover artifacts must be JPEG files.");
  if (coverFormat !== "ebook" && fileFormat !== "pdf") throw new Error("KDP print cover artifacts must be PDF files.");
  const byteLength = positiveInteger(input.byteLength, "Cover artifact byte length");
  const widthPixels = positiveInteger(input.widthPixels, "Cover artifact pixel width");
  const heightPixels = positiveInteger(input.heightPixels, "Cover artifact pixel height");
  const dpi = positiveInteger(input.dpi, "Cover artifact DPI");
  const widthInches = positiveNumber(input.widthInches, "Cover artifact width");
  const heightInches = positiveNumber(input.heightInches, "Cover artifact height");
  const fileName = requiredText(input.fileName, "Cover artifact filename");
  const storageFileName = safeStorageFileName(input.storageFileName);
  const extension = fileFormat === "jpeg" ? ".jpg" : ".pdf";
  if (!fileName.toLowerCase().endsWith(extension) || !storageFileName.toLowerCase().endsWith(extension)) throw new Error("Cover artifact filename extension does not match its file format.");
  return Object.freeze({
    formatVersion: COVER_ARTIFACT_EVIDENCE_FORMAT_VERSION,
    artifactId: identifier(input.artifactId, "Cover artifact id"),
    projectId: identifier(input.projectId, "Cover artifact project id"),
    bookId: identifier(input.bookId, "Cover artifact book id"),
    planId: identifier(input.plan.id, "Cover artifact plan id"),
    planVersion: positiveInteger(input.plan.version, "Cover artifact plan version"),
    coverFormat,
    fileFormat,
    mimeType: mimeForCoverFile(fileFormat),
    fileName,
    storageFileName,
    byteLength,
    sha256: digest(input.sha256, "Cover artifact SHA-256"),
    planSha256: coverPlanSha256(input.plan),
    sourceAssetId: identifier(input.sourceAssetId, "Cover artifact source asset id"),
    sourceAssetSha256: digest(input.sourceAssetSha256, "Cover artifact source asset SHA-256"),
    widthPixels,
    heightPixels,
    widthInches,
    heightInches,
    dpi,
    generatedAt: timestamp(input.generatedAt),
  });
}

export function validateCoverArtifactEvidence(value: unknown): CoverArtifactEvidence {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Cover artifact evidence must be an object.");
  const item = value as Record<string, unknown>;
  if (item.formatVersion !== COVER_ARTIFACT_EVIDENCE_FORMAT_VERSION) throw new Error("Unsupported cover artifact evidence version.");
  const coverFormat = releaseCoverFormat(item.coverFormat);
  const fileFormat = fileFormatValue(item.fileFormat);
  if (coverFormat === "ebook" && fileFormat !== "jpeg") throw new Error("eBook cover evidence must reference JPEG output.");
  if (coverFormat !== "ebook" && fileFormat !== "pdf") throw new Error("Print cover evidence must reference PDF output.");
  const mimeType = requiredText(item.mimeType, "Cover artifact MIME type");
  if (mimeType !== mimeForCoverFile(fileFormat)) throw new Error("Cover artifact MIME type does not match its file format.");
  const fileName = requiredText(item.fileName, "Cover artifact filename");
  const storageFileName = safeStorageFileName(item.storageFileName);
  const extension = fileFormat === "jpeg" ? ".jpg" : ".pdf";
  if (!fileName.toLowerCase().endsWith(extension) || !storageFileName.toLowerCase().endsWith(extension)) throw new Error("Cover artifact filename extension does not match its file format.");
  return Object.freeze({
    formatVersion: COVER_ARTIFACT_EVIDENCE_FORMAT_VERSION,
    artifactId: identifier(item.artifactId, "Cover artifact id"),
    projectId: identifier(item.projectId, "Cover artifact project id"),
    bookId: identifier(item.bookId, "Cover artifact book id"),
    planId: identifier(item.planId, "Cover artifact plan id"),
    planVersion: positiveInteger(Number(item.planVersion), "Cover artifact plan version"),
    coverFormat,
    fileFormat,
    mimeType,
    fileName,
    storageFileName,
    byteLength: positiveInteger(Number(item.byteLength), "Cover artifact byte length"),
    sha256: digest(item.sha256, "Cover artifact SHA-256"),
    planSha256: digest(item.planSha256, "Cover artifact plan SHA-256"),
    sourceAssetId: identifier(item.sourceAssetId, "Cover artifact source asset id"),
    sourceAssetSha256: digest(item.sourceAssetSha256, "Cover artifact source asset SHA-256"),
    widthPixels: positiveInteger(Number(item.widthPixels), "Cover artifact pixel width"),
    heightPixels: positiveInteger(Number(item.heightPixels), "Cover artifact pixel height"),
    widthInches: positiveNumber(Number(item.widthInches), "Cover artifact width"),
    heightInches: positiveNumber(Number(item.heightInches), "Cover artifact height"),
    dpi: positiveInteger(Number(item.dpi), "Cover artifact DPI"),
    generatedAt: timestamp(item.generatedAt),
  });
}

export function mimeForCoverFile(format: CoverArtifactFileFormat): string {
  return format === "jpeg" ? "image/jpeg" : "application/pdf";
}

function releaseCoverFormat(value: unknown): ReleaseCoverFormat {
  if (value !== "ebook" && value !== "paperback" && value !== "hardcover") throw new Error("Cover artifact requires an eBook, paperback, or hardcover Cover Studio plan.");
  return value;
}
function fileFormatValue(value: unknown): CoverArtifactFileFormat {
  if (value !== "jpeg" && value !== "pdf") throw new Error("Cover artifact file format must be jpeg or pdf.");
  return value;
}
function digest(value: unknown, label: string): string {
  const text = requiredText(value, label).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(text)) throw new Error(`${label} must be a 64-character hexadecimal digest.`);
  return text;
}
function identifier(value: unknown, label: string): string {
  const text = requiredText(value, label);
  if (!/^[A-Za-z0-9_-]+$/.test(text)) throw new Error(`${label} contains unsupported characters.`);
  return text;
}
function requiredText(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}
function positiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer.`);
  return value;
}
function positiveNumber(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be a positive number.`);
  return value;
}
function timestamp(value: unknown): string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new Error("Cover artifact timestamp must be valid.");
  return new Date(value).toISOString();
}
function safeStorageFileName(value: unknown): string {
  const name = requiredText(value, "Cover artifact storage filename");
  if (name.includes("/") || name.includes("\\") || name === "." || name === ".." || name.includes("..")) throw new Error("Cover artifact storage filename is unsafe.");
  if (!/^[A-Za-z0-9_.-]+$/.test(name)) throw new Error("Cover artifact storage filename contains unsupported characters.");
  return name;
}

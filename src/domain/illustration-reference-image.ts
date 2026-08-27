export const ILLUSTRATION_REFERENCE_IMAGE_FORMAT_VERSION = 1 as const;
export const ILLUSTRATION_REFERENCE_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type IllustrationReferenceImageMimeType = typeof ILLUSTRATION_REFERENCE_IMAGE_MIME_TYPES[number];

export interface IllustrationReferenceImage {
  readonly formatVersion: typeof ILLUSTRATION_REFERENCE_IMAGE_FORMAT_VERSION;
  readonly id: string;
  readonly projectId: string;
  readonly originalFileName: string;
  readonly mimeType: IllustrationReferenceImageMimeType;
  readonly byteLength: number;
  readonly assetUri: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateIllustrationReferenceImageInput {
  readonly id: string;
  readonly projectId: string;
  readonly originalFileName: string;
  readonly mimeType: IllustrationReferenceImageMimeType;
  readonly byteLength: number;
  readonly assetUri: string;
  readonly now?: string;
}

export const MAX_ILLUSTRATION_REFERENCE_IMAGE_BYTES = 5 * 1024 * 1024;

export function createIllustrationReferenceImage(input: CreateIllustrationReferenceImageInput): IllustrationReferenceImage {
  const now = timestamp(input.now ?? new Date().toISOString());
  return {
    formatVersion: ILLUSTRATION_REFERENCE_IMAGE_FORMAT_VERSION,
    id: identifier(input.id, "Reference image id"),
    projectId: identifier(input.projectId, "Reference image project id"),
    originalFileName: text(input.originalFileName, "Reference image file name"),
    mimeType: mime(input.mimeType),
    byteLength: positiveBytes(input.byteLength),
    assetUri: text(input.assetUri, "Reference image asset URI"),
    createdAt: now,
    updatedAt: now,
  };
}

export function validateIllustrationReferenceImage(value: unknown): IllustrationReferenceImage {
  if (!value || typeof value !== "object") throw new Error("Invalid illustration reference image.");
  const item = value as Record<string, unknown>;
  return createIllustrationReferenceImage({
    id: String(item.id),
    projectId: String(item.projectId),
    originalFileName: String(item.originalFileName),
    mimeType: item.mimeType as IllustrationReferenceImageMimeType,
    byteLength: Number(item.byteLength),
    assetUri: String(item.assetUri),
    now: String(item.createdAt),
  });
}

function identifier(value: string, label: string): string {
  if (!value.trim() || value !== value.trim()) throw new Error(`${label} is required and cannot have surrounding whitespace.`);
  return value;
}

function text(value: string, label: string): string {
  if (!value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function mime(value: IllustrationReferenceImageMimeType): IllustrationReferenceImageMimeType {
  if (!ILLUSTRATION_REFERENCE_IMAGE_MIME_TYPES.includes(value)) throw new Error("Unsupported reference image type.");
  return value;
}

function positiveBytes(value: number): number {
  if (!Number.isInteger(value) || value < 1) throw new Error("Reference image byte length must be a positive integer.");
  if (value > MAX_ILLUSTRATION_REFERENCE_IMAGE_BYTES) throw new Error("Reference image exceeds the 5 MiB limit.");
  return value;
}

function timestamp(value: string): string {
  if (Number.isNaN(Date.parse(value))) throw new Error("Reference image timestamp must be valid.");
  return new Date(value).toISOString();
}

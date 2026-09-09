import { createHash } from "node:crypto";
import {
  extensionFor,
  mimeFor,
  normalizeProductionManuscript,
  validateProductionArtifact,
  validateProductionOptions,
  type ProductionArtifact,
  type ProductionFormat,
  type ProductionManuscript,
  type ProductionOptions,
} from "./manuscript-production";

export const PRODUCTION_ARTIFACT_EVIDENCE_FORMAT_VERSION = 1 as const;

export interface ProductionArtifactEvidence {
  readonly formatVersion: typeof PRODUCTION_ARTIFACT_EVIDENCE_FORMAT_VERSION;
  readonly artifactId: string;
  readonly projectId: string;
  readonly bookId: string;
  readonly format: ProductionFormat;
  readonly mimeType: string;
  readonly fileName: string;
  readonly storageFileName: string;
  readonly byteLength: number;
  readonly sha256: string;
  readonly sourceSha256: string;
  readonly generatedAt: string;
  readonly options: Readonly<{
    pageSize: "letter" | "a4" | "6x9" | "5x8";
    pageNumbers: boolean;
    includeTitlePage: boolean;
    includeToc: boolean;
    runningHeader?: string;
    runningFooter?: string;
  }>;
}

export interface ProductionArtifactVerification {
  readonly evidence: ProductionArtifactEvidence;
  readonly valid: boolean;
  readonly issues: readonly string[];
}

export function productionSourceSha256(manuscript: ProductionManuscript, options: ProductionOptions): string {
  const book = normalizeProductionManuscript(manuscript);
  validateProductionOptions(options);
  const normalizedOptions = canonicalProductionOptions(options);
  const snapshot = {
    projectId: book.projectId,
    bookId: book.bookId,
    title: book.title,
    subtitle: book.subtitle ?? null,
    author: book.author,
    chapters: book.chapters.map((chapter) => ({
      id: chapter.id,
      number: chapter.number,
      title: chapter.title,
      scenes: chapter.scenes.map((scene) => ({ id: scene.id, title: scene.title, body: scene.body })),
    })),
    frontMatter: book.frontMatter.map((section) => ({ kind: section.kind, title: section.title ?? null, body: section.body })),
    backMatter: book.backMatter.map((section) => ({ kind: section.kind, title: section.title ?? null, body: section.body })),
    seriesName: book.seriesName ?? null,
    seriesNumber: book.seriesNumber ?? null,
    options: normalizedOptions,
  };
  return createHash("sha256").update(JSON.stringify(snapshot), "utf8").digest("hex");
}

export function createProductionArtifactEvidence(
  artifact: ProductionArtifact,
  storageFileName: string,
  options: ProductionOptions,
  sourceSha256: string,
): ProductionArtifactEvidence {
  const artifactIssues = validateProductionArtifact(artifact).filter((issue) => issue.severity === "error");
  if (artifactIssues.length) throw new Error(`Cannot persist invalid production artifact: ${artifactIssues.map((issue) => issue.message).join(" ")}`);
  validateProductionOptions(options);
  if (options.format !== artifact.format) throw new Error("Production artifact options format does not match the generated artifact.");
  const safeStorageName = validateStorageFileName(storageFileName);
  if (!safeStorageName.toLowerCase().endsWith(extensionFor(artifact.format))) throw new Error("Production artifact storage extension does not match its format.");
  const artifactSha = digest(artifact.sha256, "Production artifact SHA-256");
  const sourceSha = digest(sourceSha256, "Production source SHA-256");
  if (!Number.isInteger(artifact.byteLength) || artifact.byteLength <= 0) throw new Error("Production artifact byte length must be a positive integer.");
  const generatedAt = timestamp(artifact.generatedAt);
  const normalizedOptions = canonicalProductionOptions(options);
  return Object.freeze({
    formatVersion: PRODUCTION_ARTIFACT_EVIDENCE_FORMAT_VERSION,
    artifactId: id(artifact.id, "Production artifact id"),
    projectId: id(artifact.projectId, "Production project id"),
    bookId: id(artifact.bookId, "Production book id"),
    format: artifact.format,
    mimeType: mimeFor(artifact.format),
    fileName: requiredText(artifact.fileName, "Production filename"),
    storageFileName: safeStorageName,
    byteLength: artifact.byteLength,
    sha256: artifactSha,
    sourceSha256: sourceSha,
    generatedAt,
    options: Object.freeze(normalizedOptions),
  });
}

export function validateProductionArtifactEvidence(value: unknown): ProductionArtifactEvidence {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Production artifact evidence must be an object.");
  const candidate = value as Record<string, unknown>;
  if (candidate.formatVersion !== PRODUCTION_ARTIFACT_EVIDENCE_FORMAT_VERSION) throw new Error("Unsupported production artifact evidence version.");
  const format = candidate.format as ProductionFormat;
  if (!["docx", "pdf", "epub", "kdp-docx", "kdp-pdf", "kdp-epub"].includes(format)) throw new Error("Production artifact evidence format is invalid.");
  const byteLength = Number(candidate.byteLength);
  if (!Number.isInteger(byteLength) || byteLength <= 0) throw new Error("Production artifact evidence byte length is invalid.");
  const sha256 = digest(candidate.sha256, "Production artifact evidence SHA-256");
  const sourceSha256 = digest(candidate.sourceSha256, "Production artifact evidence source SHA-256");
  const mimeType = requiredText(candidate.mimeType, "Production artifact MIME type");
  if (mimeType !== mimeFor(format)) throw new Error("Production artifact evidence MIME type does not match its format.");
  const fileName = requiredText(candidate.fileName, "Production artifact filename");
  if (!fileName.toLowerCase().endsWith(extensionFor(format))) throw new Error("Production artifact evidence filename extension does not match its format.");
  const storageFileName = validateStorageFileName(candidate.storageFileName);
  if (!storageFileName.toLowerCase().endsWith(extensionFor(format))) throw new Error("Production artifact evidence storage extension does not match its format.");
  const options = candidate.options;
  if (!options || typeof options !== "object" || Array.isArray(options)) throw new Error("Production artifact evidence options are required.");
  const optionRecord = options as Record<string, unknown>;
  const pageSize = optionRecord.pageSize;
  if (typeof pageSize !== "string" || !["letter", "a4", "6x9", "5x8"].includes(pageSize)) throw new Error("Production artifact evidence page size is invalid.");
  for (const field of ["pageNumbers", "includeTitlePage", "includeToc"] as const) {
    if (typeof optionRecord[field] !== "boolean") throw new Error(`Production artifact evidence ${field} must be boolean.`);
  }
  const runningHeader = optionalText(optionRecord.runningHeader);
  const runningFooter = optionalText(optionRecord.runningFooter);
  return Object.freeze({
    formatVersion: PRODUCTION_ARTIFACT_EVIDENCE_FORMAT_VERSION,
    artifactId: id(candidate.artifactId, "Production artifact id"),
    projectId: id(candidate.projectId, "Production project id"),
    bookId: id(candidate.bookId, "Production book id"),
    format,
    mimeType,
    fileName,
    storageFileName,
    byteLength,
    sha256,
    sourceSha256,
    generatedAt: timestamp(candidate.generatedAt),
    options: Object.freeze({
      pageSize: pageSize as "letter" | "a4" | "6x9" | "5x8",
      pageNumbers: optionRecord.pageNumbers as boolean,
      includeTitlePage: optionRecord.includeTitlePage as boolean,
      includeToc: optionRecord.includeToc as boolean,
      ...(runningHeader ? { runningHeader } : {}),
      ...(runningFooter ? { runningFooter } : {}),
    }),
  });
}

function canonicalProductionOptions(options: ProductionOptions): {
  format: ProductionFormat;
  pageSize: "letter" | "a4" | "6x9" | "5x8";
  pageNumbers: boolean;
  includeTitlePage: boolean;
  includeToc: boolean;
  runningHeader?: string;
  runningFooter?: string;
} {
  const pageSize = options.pageSize ?? "letter";
  if (!["letter", "a4", "6x9", "5x8"].includes(pageSize)) throw new Error("Production artifact page size is invalid.");
  const runningHeader = optionalText(options.runningHeader);
  const runningFooter = optionalText(options.runningFooter);
  return {
    format: options.format,
    pageSize: pageSize as "letter" | "a4" | "6x9" | "5x8",
    pageNumbers: options.pageNumbers !== false,
    includeTitlePage: options.includeTitlePage !== false,
    includeToc: options.includeToc !== false,
    ...(runningHeader ? { runningHeader } : {}),
    ...(runningFooter ? { runningFooter } : {}),
  };
}
function digest(value: unknown, label: string): string {
  const text = requiredText(value, label).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(text)) throw new Error(`${label} must be a 64-character hexadecimal digest.`);
  return text;
}
function id(value: unknown, label: string): string {
  const text = requiredText(value, label);
  if (!/^[A-Za-z0-9_-]+$/.test(text)) throw new Error(`${label} contains unsupported characters.`);
  return text;
}
function requiredText(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}
function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function timestamp(value: unknown): string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new Error("Production artifact timestamp must be valid.");
  return new Date(value).toISOString();
}
function validateStorageFileName(value: unknown): string {
  const name = requiredText(value, "Production artifact storage filename");
  if (name.includes("/") || name.includes("\\") || name === "." || name === "..") throw new Error("Production artifact storage filename is unsafe.");
  if (!/^[A-Za-z0-9_.-]+$/.test(name)) throw new Error("Production artifact storage filename contains unsupported characters.");
  return name;
}

import { extensionFor, mimeFor, validateProductionArtifact, type ProductionArtifact, type ProductionFormat, type ProductionOptions } from "./manuscript-production";

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
  readonly generatedAt: string;
  readonly options: Readonly<{
    pageSize: "letter" | "a4" | "6x9" | "5x8";
    pageNumbers: boolean;
    includeTitlePage: boolean;
    includeToc: boolean;
  }>;
}

export interface ProductionArtifactVerification {
  readonly evidence: ProductionArtifactEvidence;
  readonly valid: boolean;
  readonly issues: readonly string[];
}

export function createProductionArtifactEvidence(
  artifact: ProductionArtifact,
  storageFileName: string,
  options: ProductionOptions,
): ProductionArtifactEvidence {
  const artifactIssues = validateProductionArtifact(artifact).filter((issue) => issue.severity === "error");
  if (artifactIssues.length) throw new Error(`Cannot persist invalid production artifact: ${artifactIssues.map((issue) => issue.message).join(" ")}`);
  const safeStorageName = validateStorageFileName(storageFileName);
  if (!safeStorageName.toLowerCase().endsWith(extensionFor(artifact.format))) throw new Error("Production artifact storage extension does not match its format.");
  if (!/^[a-f0-9]{64}$/i.test(artifact.sha256)) throw new Error("Production artifact SHA-256 must be a 64-character hexadecimal digest.");
  if (!Number.isInteger(artifact.byteLength) || artifact.byteLength <= 0) throw new Error("Production artifact byte length must be a positive integer.");
  const generatedAt = timestamp(artifact.generatedAt);
  const pageSize = options.pageSize ?? "letter";
  if (!["letter", "a4", "6x9", "5x8"].includes(pageSize)) throw new Error("Production artifact page size is invalid.");
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
    sha256: artifact.sha256.toLowerCase(),
    generatedAt,
    options: Object.freeze({
      pageSize: pageSize as "letter" | "a4" | "6x9" | "5x8",
      pageNumbers: options.pageNumbers !== false,
      includeTitlePage: options.includeTitlePage !== false,
      includeToc: options.includeToc !== false,
    }),
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
  const sha256 = requiredText(candidate.sha256, "Production artifact SHA-256").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error("Production artifact evidence SHA-256 is invalid.");
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
    generatedAt: timestamp(candidate.generatedAt),
    options: Object.freeze({
      pageSize: pageSize as "letter" | "a4" | "6x9" | "5x8",
      pageNumbers: optionRecord.pageNumbers as boolean,
      includeTitlePage: optionRecord.includeTitlePage as boolean,
      includeToc: optionRecord.includeToc as boolean,
    }),
  });
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

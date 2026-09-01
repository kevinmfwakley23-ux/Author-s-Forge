import type { PublishingConfiguration } from "../domain/book-cover-studio";
import type { KdpCoverFileFacts, KdpInteriorFileFacts, KdpPreflightReport } from "../domain/kdp-preflight";
import { KdpPreflightHistoryService } from "./kdp-preflight-history";

export interface KdpPreflightHttpDeps {
  readonly history: KdpPreflightHistoryService;
  readonly projectId: string;
}

export async function runKdpPreflightFromHttp(deps: KdpPreflightHttpDeps, input: Record<string, unknown>): Promise<KdpPreflightReport> {
  const projectId = requiredText(deps.projectId, "project id");
  const requestProjectId = input.projectId === undefined ? projectId : requiredText(input.projectId, "project id");
  if (requestProjectId !== projectId) throw new Error("KDP preflight request cannot target another project.");

  return deps.history.audit({
    id: optionalText(input.id) ?? `kdp-preflight-${crypto.randomUUID()}`,
    projectId,
    publishing: publishingConfiguration(input.publishing),
    interiorHasBleed: booleanValue(input.interiorHasBleed, "interiorHasBleed"),
    interior: interiorFacts(input.interior),
    cover: coverFacts(input.cover),
    ...(input.now === undefined ? {} : { now: requiredText(input.now, "now") }),
  });
}

export async function listKdpPreflightHistoryFromHttp(deps: KdpPreflightHttpDeps): Promise<{ readonly reports: readonly KdpPreflightReport[]; readonly latest?: KdpPreflightReport }> {
  const projectId = requiredText(deps.projectId, "project id");
  const reports = await deps.history.list(projectId);
  return { reports, ...(reports[0] ? { latest: reports[0] } : {}) };
}

function publishingConfiguration(value: unknown): PublishingConfiguration {
  const input = objectValue(value, "publishing");
  const binding = enumText(input.binding, ["paperback", "hardcover"] as const, "binding");
  const interiorType = enumText(input.interiorType, ["black-white", "premium-color", "standard-color"] as const, "interior type");
  const paperType = enumText(input.paperType, ["white", "cream"] as const, "paper type");
  const readingDirection = enumText(input.readingDirection, ["ltr", "rtl"] as const, "reading direction");
  return {
    platform: "kdp",
    binding,
    interiorType,
    paperType,
    trimWidthInches: positiveNumber(input.trimWidthInches, "trim width"),
    trimHeightInches: positiveNumber(input.trimHeightInches, "trim height"),
    pageCount: integerNumber(input.pageCount, "page count"),
    bleedInches: nonNegativeNumber(input.bleedInches, "bleed"),
    readingDirection,
  };
}

function interiorFacts(value: unknown): KdpInteriorFileFacts {
  const input = objectValue(value, "interior");
  return {
    format: requiredText(input.format, "interior format"),
    sizeBytes: nonNegativeNumber(input.sizeBytes, "interior sizeBytes"),
    encrypted: booleanValue(input.encrypted, "interior encrypted"),
    fontsEmbedded: booleanValue(input.fontsEmbedded, "interior fontsEmbedded"),
    imagesEmbedded: booleanValue(input.imagesEmbedded, "interior imagesEmbedded"),
    ...(input.minimumImageDpi === undefined ? {} : { minimumImageDpi: nonNegativeNumber(input.minimumImageDpi, "interior minimumImageDpi") }),
    transparentObjectsFlattened: booleanValue(input.transparentObjectsFlattened, "interior transparentObjectsFlattened"),
    hasCropMarks: booleanValue(input.hasCropMarks, "interior hasCropMarks"),
    hasTrimMarks: booleanValue(input.hasTrimMarks, "interior hasTrimMarks"),
    hasBookmarks: booleanValue(input.hasBookmarks, "interior hasBookmarks"),
    hasComments: booleanValue(input.hasComments, "interior hasComments"),
    hasAnnotations: booleanValue(input.hasAnnotations, "interior hasAnnotations"),
    hasPlaceholderText: booleanValue(input.hasPlaceholderText, "interior hasPlaceholderText"),
    hasPdfCreationWatermark: booleanValue(input.hasPdfCreationWatermark, "interior hasPdfCreationWatermark"),
    pageWidthInches: positiveNumber(input.pageWidthInches, "interior page width"),
    pageHeightInches: positiveNumber(input.pageHeightInches, "interior page height"),
    insideMarginInches: nonNegativeNumber(input.insideMarginInches, "interior inside margin"),
    outsideMarginInches: nonNegativeNumber(input.outsideMarginInches, "interior outside margin"),
    topMarginInches: nonNegativeNumber(input.topMarginInches, "interior top margin"),
    bottomMarginInches: nonNegativeNumber(input.bottomMarginInches, "interior bottom margin"),
  };
}

function coverFacts(value: unknown): KdpCoverFileFacts {
  const input = objectValue(value, "cover");
  return {
    format: requiredText(input.format, "cover format"),
    sizeBytes: nonNegativeNumber(input.sizeBytes, "cover sizeBytes"),
    encrypted: booleanValue(input.encrypted, "cover encrypted"),
    fontsEmbedded: booleanValue(input.fontsEmbedded, "cover fontsEmbedded"),
    ...(input.minimumImageDpi === undefined ? {} : { minimumImageDpi: nonNegativeNumber(input.minimumImageDpi, "cover minimumImageDpi") }),
    transparentObjectsFlattened: booleanValue(input.transparentObjectsFlattened, "cover transparentObjectsFlattened"),
    hasCropMarks: booleanValue(input.hasCropMarks, "cover hasCropMarks"),
    hasTrimMarks: booleanValue(input.hasTrimMarks, "cover hasTrimMarks"),
    hasTemplateText: booleanValue(input.hasTemplateText, "cover hasTemplateText"),
    titleOnFront: booleanValue(input.titleOnFront, "cover titleOnFront"),
    widthInches: positiveNumber(input.widthInches, "cover width"),
    heightInches: positiveNumber(input.heightInches, "cover height"),
    ...(input.spineTextPresent === undefined ? {} : { spineTextPresent: booleanValue(input.spineTextPresent, "cover spineTextPresent") }),
  };
}

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function requiredText(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function booleanValue(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${label} must be a boolean.`);
  return value;
}

function numberValue(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be a finite number.`);
  return value;
}

function positiveNumber(value: unknown, label: string): number {
  const number = numberValue(value, label);
  if (number <= 0) throw new Error(`${label} must be greater than zero.`);
  return number;
}

function nonNegativeNumber(value: unknown, label: string): number {
  const number = numberValue(value, label);
  if (number < 0) throw new Error(`${label} cannot be negative.`);
  return number;
}

function integerNumber(value: unknown, label: string): number {
  const number = numberValue(value, label);
  if (!Number.isInteger(number)) throw new Error(`${label} must be an integer.`);
  return number;
}

function enumText<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) throw new Error(`Invalid ${label}.`);
  return value as T;
}

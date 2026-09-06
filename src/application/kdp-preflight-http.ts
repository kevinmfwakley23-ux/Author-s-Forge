import { join } from "node:path";
import type { KdpCoverFileFacts, KdpInteriorFileFacts, KdpPreflightReport } from "../domain/kdp-preflight";
import type { ProjectStorePort } from "./project-store-port";
import { FileProjectStore } from "../infrastructure/file-project-store";
import { KdpPreflightHistoryService } from "./kdp-preflight-history";
import { StudioKdpPreflightService } from "./studio-kdp-preflight";

export interface KdpPreflightHttpDeps {
  readonly history: KdpPreflightHistoryService;
  readonly projectId: string;
  readonly projectStore?: ProjectStorePort;
}

export async function runKdpPreflightFromHttp(deps: KdpPreflightHttpDeps, input: Record<string, unknown>): Promise<KdpPreflightReport> {
  const projectId = requiredText(deps.projectId, "project id");
  const requestProjectId = input.projectId === undefined ? projectId : requiredText(input.projectId, "project id");
  if (requestProjectId !== projectId) throw new Error("KDP preflight request cannot target another project.");

  const projectStore = deps.projectStore ?? new FileProjectStore(process.env.FORGE_DATA_DIR ?? join(process.cwd(), ".forge-data"));
  const project = await projectStore.load(projectId);
  if (!project) throw new Error(`KDP preflight project "${projectId}" was not found in durable project state.`);

  const result = await new StudioKdpPreflightService(deps.history).audit({
    project,
    ...(input.coverPlanId === undefined ? {} : { coverPlanId: requiredText(input.coverPlanId, "coverPlanId") }),
    ...(input.bookId === undefined ? {} : { bookId: requiredText(input.bookId, "bookId") }),
    interiorHasBleed: booleanValue(input.interiorHasBleed, "interiorHasBleed"),
    interior: interiorFacts(input.interior),
    cover: coverFacts(input.cover),
    ...(optionalText(input.id) ? { reportId: optionalText(input.id) } : {}),
    ...(input.now === undefined ? {} : { now: requiredText(input.now, "now") }),
  });
  return result.report;
}

export async function listKdpPreflightHistoryFromHttp(deps: KdpPreflightHttpDeps): Promise<{ readonly reports: readonly KdpPreflightReport[]; readonly latest?: KdpPreflightReport }> {
  const projectId = requiredText(deps.projectId, "project id");
  const reports = await deps.history.list(projectId);
  return { reports, ...(reports[0] ? { latest: reports[0] } : {}) };
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

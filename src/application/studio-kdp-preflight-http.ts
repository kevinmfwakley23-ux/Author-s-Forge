import type { ProjectState } from "../domain/project";
import type { KdpCoverFileFacts, KdpInteriorFileFacts, KdpPreflightFinding, KdpPreflightReport } from "../domain/kdp-preflight";
import { KdpPreflightService } from "./kdp-preflight";

export interface StudioKdpPreflightBody {
  readonly bookId?: unknown;
  readonly interiorHasBleed?: unknown;
  readonly interior?: unknown;
  readonly cover?: unknown;
  readonly now?: unknown;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a JSON object.`);
  return value as Record<string, unknown>;
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${label} must be a boolean.`);
  return value;
}

function number(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be a finite number.`);
  return value;
}

function nonNegativeNumber(value: unknown, label: string): number {
  const parsed = number(value, label);
  if (parsed < 0) throw new Error(`${label} must be zero or greater.`);
  return parsed;
}

function positiveNumber(value: unknown, label: string): number {
  const parsed = number(value, label);
  if (parsed <= 0) throw new Error(`${label} must be greater than zero.`);
  return parsed;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function optionalPositiveNumber(value: unknown, label: string): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return positiveNumber(value, label);
}

function optionalBoolean(value: unknown, label: string): boolean | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return boolean(value, label);
}

function parseInterior(value: unknown): KdpInteriorFileFacts {
  const input = record(value, "Interior facts");
  return {
    format: text(input.format, "Interior format"),
    sizeBytes: nonNegativeNumber(input.sizeBytes, "Interior sizeBytes"),
    encrypted: boolean(input.encrypted, "Interior encrypted"),
    fontsEmbedded: boolean(input.fontsEmbedded, "Interior fontsEmbedded"),
    imagesEmbedded: boolean(input.imagesEmbedded, "Interior imagesEmbedded"),
    minimumImageDpi: optionalPositiveNumber(input.minimumImageDpi, "Interior minimumImageDpi"),
    transparentObjectsFlattened: boolean(input.transparentObjectsFlattened, "Interior transparentObjectsFlattened"),
    hasCropMarks: boolean(input.hasCropMarks, "Interior hasCropMarks"),
    hasTrimMarks: boolean(input.hasTrimMarks, "Interior hasTrimMarks"),
    hasBookmarks: boolean(input.hasBookmarks, "Interior hasBookmarks"),
    hasComments: boolean(input.hasComments, "Interior hasComments"),
    hasAnnotations: boolean(input.hasAnnotations, "Interior hasAnnotations"),
    hasPlaceholderText: boolean(input.hasPlaceholderText, "Interior hasPlaceholderText"),
    hasPdfCreationWatermark: boolean(input.hasPdfCreationWatermark, "Interior hasPdfCreationWatermark"),
    pageWidthInches: positiveNumber(input.pageWidthInches, "Interior pageWidthInches"),
    pageHeightInches: positiveNumber(input.pageHeightInches, "Interior pageHeightInches"),
    insideMarginInches: nonNegativeNumber(input.insideMarginInches, "Interior insideMarginInches"),
    outsideMarginInches: nonNegativeNumber(input.outsideMarginInches, "Interior outsideMarginInches"),
    topMarginInches: nonNegativeNumber(input.topMarginInches, "Interior topMarginInches"),
    bottomMarginInches: nonNegativeNumber(input.bottomMarginInches, "Interior bottomMarginInches"),
  };
}

function parseCover(value: unknown): KdpCoverFileFacts {
  const input = record(value, "Cover facts");
  return {
    format: text(input.format, "Cover format"),
    sizeBytes: nonNegativeNumber(input.sizeBytes, "Cover sizeBytes"),
    encrypted: boolean(input.encrypted, "Cover encrypted"),
    fontsEmbedded: boolean(input.fontsEmbedded, "Cover fontsEmbedded"),
    minimumImageDpi: optionalPositiveNumber(input.minimumImageDpi, "Cover minimumImageDpi"),
    transparentObjectsFlattened: boolean(input.transparentObjectsFlattened, "Cover transparentObjectsFlattened"),
    hasCropMarks: boolean(input.hasCropMarks, "Cover hasCropMarks"),
    hasTrimMarks: boolean(input.hasTrimMarks, "Cover hasTrimMarks"),
    hasTemplateText: boolean(input.hasTemplateText, "Cover hasTemplateText"),
    titleOnFront: boolean(input.titleOnFront, "Cover titleOnFront"),
    widthInches: positiveNumber(input.widthInches, "Cover widthInches"),
    heightInches: positiveNumber(input.heightInches, "Cover heightInches"),
    spineTextPresent: optionalBoolean(input.spineTextPresent, "Cover spineTextPresent"),
  };
}

function unverifiedResolutionFindings(interior: KdpInteriorFileFacts, cover: KdpCoverFileFacts): KdpPreflightFinding[] {
  const findings: KdpPreflightFinding[] = [];
  if (interior.minimumImageDpi === undefined) findings.push({
    code: "INTERIOR_IMAGE_DPI_UNVERIFIED",
    severity: "warning",
    area: "interior",
    message: "Interior image resolution has not been verified.",
    remediation: "Inspect the final interior artifact and confirm every image is at least 300 DPI before KDP upload.",
  });
  if (cover.minimumImageDpi === undefined) findings.push({
    code: "COVER_IMAGE_DPI_UNVERIFIED",
    severity: "warning",
    area: "cover",
    message: "Cover image resolution has not been verified.",
    remediation: "Inspect the final cover PDF and confirm all raster artwork is at least 300 DPI before KDP upload.",
  });
  return findings;
}

/**
 * Governed HTTP/application adapter for the Studio Production Office.
 *
 * The client may report inspected file facts, but it cannot provide or override
 * trim size, binding, paper type, page count, or expected cover dimensions.
 * Those values always come from the project's persisted Book Cover Studio plan.
 */
export function runStudioKdpPreflight(
  project: ProjectState,
  body: StudioKdpPreflightBody,
  service = new KdpPreflightService(),
): KdpPreflightReport {
  const bookId = text(body.bookId, "bookId");
  const plan = [...(project.bookCoverPlans ?? [])]
    .filter((candidate) => candidate.bookId === bookId && candidate.publishing.platform === "kdp")
    .sort((a, b) => b.version - a.version)[0];
  if (!plan) throw new Error("Create a KDP cover plan for this book before running production preflight.");

  const interior = parseInterior(body.interior);
  const cover = parseCover(body.cover);
  const report = service.audit({
    id: `kdp-preflight-${bookId}-${plan.version}`,
    projectId: project.metadata.id,
    publishing: plan.publishing,
    interiorHasBleed: boolean(body.interiorHasBleed, "interiorHasBleed"),
    interior,
    cover,
    now: body.now === undefined ? undefined : text(body.now, "now"),
  });
  const unverified = unverifiedResolutionFindings(interior, cover);
  if (!unverified.length) return report;
  return Object.freeze({
    ...report,
    findings: Object.freeze([...report.findings, ...unverified]),
    warningCount: report.warningCount + unverified.length,
  });
}

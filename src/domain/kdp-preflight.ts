export const KDP_PREFLIGHT_FORMAT_VERSION = 1 as const;

export type KdpBinding = "paperback" | "hardcover";
export type KdpSeverity = "error" | "warning";
export type KdpPreflightStatus = "ready" | "blocked";

export interface KdpInteriorFileFacts {
  readonly format: string;
  readonly sizeBytes: number;
  readonly encrypted: boolean;
  readonly fontsEmbedded: boolean;
  readonly imagesEmbedded: boolean;
  readonly minimumImageDpi?: number;
  readonly transparentObjectsFlattened: boolean;
  readonly hasCropMarks: boolean;
  readonly hasTrimMarks: boolean;
  readonly hasBookmarks: boolean;
  readonly hasComments: boolean;
  readonly hasAnnotations: boolean;
  readonly hasPlaceholderText: boolean;
  readonly hasPdfCreationWatermark: boolean;
  readonly pageWidthInches: number;
  readonly pageHeightInches: number;
  readonly insideMarginInches: number;
  readonly outsideMarginInches: number;
  readonly topMarginInches: number;
  readonly bottomMarginInches: number;
}

export interface KdpCoverFileFacts {
  readonly format: string;
  readonly sizeBytes: number;
  readonly encrypted: boolean;
  readonly fontsEmbedded: boolean;
  readonly minimumImageDpi?: number;
  readonly transparentObjectsFlattened: boolean;
  readonly hasCropMarks: boolean;
  readonly hasTrimMarks: boolean;
  readonly hasTemplateText: boolean;
  readonly titleOnFront: boolean;
  readonly widthInches: number;
  readonly heightInches: number;
  readonly spineTextPresent?: boolean;
}

export interface KdpPreflightInput {
  readonly id: string;
  readonly projectId: string;
  readonly binding: KdpBinding;
  readonly trimWidthInches: number;
  readonly trimHeightInches: number;
  readonly pageCount: number;
  readonly interiorHasBleed: boolean;
  readonly expectedCoverWidthInches: number;
  readonly expectedCoverHeightInches: number;
  readonly interior: KdpInteriorFileFacts;
  readonly cover: KdpCoverFileFacts;
  readonly now?: string;
}

export interface KdpPreflightFinding {
  readonly code: string;
  readonly severity: KdpSeverity;
  readonly area: "interior" | "cover" | "pagination" | "geometry";
  readonly message: string;
  readonly remediation: string;
}

export interface KdpPreflightReport {
  readonly formatVersion: typeof KDP_PREFLIGHT_FORMAT_VERSION;
  readonly id: string;
  readonly projectId: string;
  readonly createdAt: string;
  readonly status: KdpPreflightStatus;
  readonly findings: readonly KdpPreflightFinding[];
  readonly errorCount: number;
  readonly warningCount: number;
  readonly expectedInteriorPageWidthInches: number;
  readonly expectedInteriorPageHeightInches: number;
}

const MAX_FILE_BYTES = 650 * 1024 * 1024;
const DIMENSION_TOLERANCE = 0.01;

export function requiredKdpInsideMargin(pageCount: number): number {
  if (!Number.isInteger(pageCount) || pageCount < 24) throw new Error("KDP print page count must be an integer of at least 24 pages.");
  if (pageCount <= 150) return 0.375;
  if (pageCount <= 300) return 0.5;
  if (pageCount <= 500) return 0.625;
  if (pageCount <= 700) return 0.75;
  if (pageCount <= 828) return 0.875;
  throw new Error("KDP preflight margin model currently supports print books up to 828 pages.");
}

export function expectedKdpInteriorPageSize(trimWidthInches: number, trimHeightInches: number, bleed: boolean): { widthInches: number; heightInches: number } {
  positive(trimWidthInches, "Trim width");
  positive(trimHeightInches, "Trim height");
  return bleed
    ? { widthInches: round(trimWidthInches + 0.125), heightInches: round(trimHeightInches + 0.25) }
    : { widthInches: trimWidthInches, heightInches: trimHeightInches };
}

export function createKdpPreflightReport(input: KdpPreflightInput): KdpPreflightReport {
  if (!input.id.trim() || !input.projectId.trim()) throw new Error("KDP preflight id and project id are required.");
  if (input.binding !== "paperback" && input.binding !== "hardcover") throw new Error("Unsupported KDP binding.");
  positive(input.trimWidthInches, "Trim width");
  positive(input.trimHeightInches, "Trim height");
  if (!Number.isInteger(input.pageCount) || input.pageCount < 24) throw new Error("KDP print page count must be an integer of at least 24 pages.");
  positive(input.expectedCoverWidthInches, "Expected cover width");
  positive(input.expectedCoverHeightInches, "Expected cover height");

  const findings: KdpPreflightFinding[] = [];
  const interior = input.interior;
  const cover = input.cover;
  const expectedInterior = expectedKdpInteriorPageSize(input.trimWidthInches, input.trimHeightInches, input.interiorHasBleed);
  const requiredInside = requiredKdpInsideMargin(input.pageCount);
  const requiredOutside = input.interiorHasBleed ? 0.375 : 0.25;

  if (interior.sizeBytes > MAX_FILE_BYTES) add(findings, "INTERIOR_FILE_TOO_LARGE", "error", "interior", "Interior file exceeds KDP's 650 MB conversion limit.", "Reduce the interior PDF file size below 650 MB before upload.");
  if (interior.encrypted) add(findings, "INTERIOR_ENCRYPTED", "error", "interior", "Interior file is locked or encrypted.", "Remove all PDF security before upload.");
  if (!interior.fontsEmbedded) add(findings, "INTERIOR_FONTS_NOT_EMBEDDED", "error", "interior", "Interior fonts are not fully embedded.", "Embed all fonts in the source file and regenerate the PDF.");
  if (!interior.imagesEmbedded) add(findings, "INTERIOR_IMAGES_NOT_EMBEDDED", "error", "interior", "Interior contains unembedded images or objects.", "Embed all images and objects before generating the upload file.");
  if ((interior.minimumImageDpi ?? 300) < 300) add(findings, "INTERIOR_LOW_IMAGE_DPI", "error", "interior", "Interior contains images below 300 DPI.", "Replace or resize low-resolution images so production resolution is at least 300 DPI.");
  if (!interior.transparentObjectsFlattened) add(findings, "INTERIOR_TRANSPARENCY", "error", "interior", "Interior contains unflattened transparent objects or layers.", "Flatten transparent objects and layers before upload.");
  if (interior.hasCropMarks || interior.hasTrimMarks) add(findings, "INTERIOR_PRINTER_MARKS", "error", "interior", "Interior contains crop or trim marks.", "Regenerate the manuscript with printer marks disabled.");
  if (interior.hasBookmarks || interior.hasComments || interior.hasAnnotations || interior.hasPlaceholderText) add(findings, "INTERIOR_NONPRINT_OBJECTS", "error", "interior", "Interior contains bookmarks, comments, annotations, or placeholder content.", "Remove non-printing review and placeholder objects before upload.");
  if (interior.hasPdfCreationWatermark) add(findings, "INTERIOR_WATERMARK", "error", "interior", "Interior contains a PDF creation logo or watermark.", "Regenerate the PDF without creation-service branding or watermarks.");
  if (!near(interior.pageWidthInches, expectedInterior.widthInches) || !near(interior.pageHeightInches, expectedInterior.heightInches)) add(findings, "INTERIOR_PAGE_SIZE", "error", "geometry", `Interior page size is ${interior.pageWidthInches} × ${interior.pageHeightInches} in; expected ${expectedInterior.widthInches} × ${expectedInterior.heightInches} in for this trim/bleed configuration.`, "Regenerate the interior at the expected KDP page dimensions.");
  if (interior.insideMarginInches < requiredInside) add(findings, "INTERIOR_GUTTER_MARGIN", "error", "geometry", `Inside/gutter margin is ${interior.insideMarginInches} in; at least ${requiredInside} in is required for ${input.pageCount} pages.`, "Increase the inside/gutter margin and repaginate the manuscript.");
  if (interior.outsideMarginInches < requiredOutside || interior.topMarginInches < requiredOutside || interior.bottomMarginInches < requiredOutside) add(findings, "INTERIOR_OUTSIDE_MARGINS", "error", "geometry", `Outside/top/bottom margins must be at least ${requiredOutside} in for this bleed setting.`, "Increase the outside, top, and bottom margins to the minimum safe value.");
  if (input.interiorHasBleed && interior.format.toLowerCase() !== "pdf") add(findings, "BLEED_REQUIRES_PDF", "error", "interior", "KDP print interiors with bleed must be submitted as PDF.", "Export the bleed interior as a PDF before upload.");

  if (cover.format.toLowerCase() !== "pdf") add(findings, "COVER_NOT_PDF", "error", "cover", "Print cover is not a PDF.", "Export the complete print cover as a single PDF.");
  if (cover.sizeBytes > MAX_FILE_BYTES) add(findings, "COVER_FILE_TOO_LARGE", "error", "cover", "Cover file exceeds 650 MB.", "Reduce the cover PDF file size below 650 MB.");
  if (cover.encrypted) add(findings, "COVER_ENCRYPTED", "error", "cover", "Cover file is locked or encrypted.", "Remove PDF security before upload.");
  if (!cover.fontsEmbedded) add(findings, "COVER_FONTS_NOT_EMBEDDED", "error", "cover", "Cover fonts are not embedded.", "Embed all cover fonts before generating the PDF.");
  if ((cover.minimumImageDpi ?? 300) < 300) add(findings, "COVER_LOW_IMAGE_DPI", "error", "cover", "Cover contains images below 300 DPI.", "Replace or resize cover images so production resolution is at least 300 DPI.");
  if (!cover.transparentObjectsFlattened) add(findings, "COVER_TRANSPARENCY", "error", "cover", "Cover contains unflattened transparent objects or layers.", "Flatten transparency and layers before upload.");
  if (cover.hasCropMarks || cover.hasTrimMarks) add(findings, "COVER_PRINTER_MARKS", "error", "cover", "Cover contains crop or trim marks.", "Export the cover without crop or trim marks.");
  if (cover.hasTemplateText) add(findings, "COVER_TEMPLATE_TEXT", "error", "cover", "Cover contains template or guide text.", "Remove all template labels and guide text before export.");
  if (!cover.titleOnFront) add(findings, "COVER_TITLE_MISSING", "error", "cover", "Book title is missing from the front cover.", "Add the publication title to the front cover.");
  if (!near(cover.widthInches, input.expectedCoverWidthInches) || !near(cover.heightInches, input.expectedCoverHeightInches)) add(findings, "COVER_DIMENSIONS", "error", "geometry", `Cover size is ${cover.widthInches} × ${cover.heightInches} in; expected ${input.expectedCoverWidthInches} × ${input.expectedCoverHeightInches} in.`, "Regenerate the full-wrap cover using the authoritative production dimensions.");
  if (input.pageCount < 79 && cover.spineTextPresent) add(findings, "SPINE_TEXT_TOO_FEW_PAGES", "error", "cover", "KDP does not allow spine text on books with fewer than 79 pages.", "Remove spine text for this page count.");

  if (input.pageCount % 2 !== 0) add(findings, "ODD_PAGE_COUNT", "warning", "pagination", "KDP calculates print page count from the uploaded file and may round an odd count up to an even number.", "Reconfirm cover/spine dimensions after the final interior PDF is generated.");

  const errorCount = findings.filter((finding) => finding.severity === "error").length;
  const warningCount = findings.length - errorCount;
  return Object.freeze({
    formatVersion: KDP_PREFLIGHT_FORMAT_VERSION,
    id: input.id.trim(),
    projectId: input.projectId.trim(),
    createdAt: new Date(input.now ?? new Date().toISOString()).toISOString(),
    status: errorCount ? "blocked" : "ready",
    findings,
    errorCount,
    warningCount,
    expectedInteriorPageWidthInches: expectedInterior.widthInches,
    expectedInteriorPageHeightInches: expectedInterior.heightInches,
  });
}

function add(findings: KdpPreflightFinding[], code: string, severity: KdpSeverity, area: KdpPreflightFinding["area"], message: string, remediation: string): void {
  findings.push({ code, severity, area, message, remediation });
}
function near(actual: number, expected: number): boolean { return Math.abs(actual - expected) <= DIMENSION_TOLERANCE; }
function positive(value: number, label: string): void { if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be a positive number.`); }
function round(value: number): number { return Math.round(value * 1000) / 1000; }

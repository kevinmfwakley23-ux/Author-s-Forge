import { randomUUID } from "node:crypto";

import {
  SPECIALIZED_PRODUCTION_PROFILE_VERSION,
  type SpecializedArtifactKind,
  type SpecializedDocument,
  type SpecializedElement,
  type SpecializedProductionProfile,
  type SpecializedSurface,
} from "../domain/specialized-creation-office";

import {
  auditBrandCompliance,
  type BrandComplianceReport,
  type BrandKit,
} from "../domain/brand-kit";

export type CreativeTargetClass = "digital" | "print";
export type CreativeReflowIssueSeverity = "warning" | "error";

export interface CreativeTargetSpec {
  readonly id: string;
  readonly label: string;
  readonly targetClass: CreativeTargetClass;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly dpi: number;
  readonly safeMarginPx: number;
  readonly bleedPx: number;
  readonly artifactKinds: readonly SpecializedArtifactKind[];
}

export interface CreativeReflowIssue {
  readonly severity: CreativeReflowIssueSeverity;
  readonly code: string;
  readonly message: string;
  readonly surfaceId?: string;
  readonly elementId?: string;
}

export interface CreativeTargetVariant {
  readonly target: CreativeTargetSpec;
  readonly document: SpecializedDocument;
  readonly profile: SpecializedProductionProfile;
  readonly issues: readonly CreativeReflowIssue[];
  readonly brandCompliance?: BrandComplianceReport;
  readonly readyForAuthorReview: boolean;
}

export interface CreativeMultiTargetProposal {
  readonly sourceDocumentId: string;
  readonly sourceProjectId: string;
  readonly createdAt: string;
  readonly persisted: false;
  readonly variants: readonly CreativeTargetVariant[];
}

/**
 * Practical generic targets that cover the dominant campaign aspect ratios
 * without pretending an external platform specification is permanently fixed.
 * Callers may supply custom target specs whenever a channel changes its rules.
 */
export const CREATIVE_TARGET_PRESETS: readonly CreativeTargetSpec[] = Object.freeze([
  Object.freeze({
    id: "social-square-1080",
    label: "Social square 1080 × 1080",
    targetClass: "digital",
    widthPx: 1080,
    heightPx: 1080,
    dpi: 144,
    safeMarginPx: 72,
    bleedPx: 0,
    artifactKinds: Object.freeze(["png", "jpeg"] as SpecializedArtifactKind[]),
  }),
  Object.freeze({
    id: "social-portrait-4x5-1080",
    label: "Social portrait 1080 × 1350",
    targetClass: "digital",
    widthPx: 1080,
    heightPx: 1350,
    dpi: 144,
    safeMarginPx: 72,
    bleedPx: 0,
    artifactKinds: Object.freeze(["png", "jpeg"] as SpecializedArtifactKind[]),
  }),
  Object.freeze({
    id: "story-vertical-9x16-1080",
    label: "Vertical story 1080 × 1920",
    targetClass: "digital",
    widthPx: 1080,
    heightPx: 1920,
    dpi: 144,
    safeMarginPx: 96,
    bleedPx: 0,
    artifactKinds: Object.freeze(["png", "jpeg"] as SpecializedArtifactKind[]),
  }),
  Object.freeze({
    id: "us-letter-print-300",
    label: "US Letter print 8.5 × 11 at 300 DPI",
    targetClass: "print",
    widthPx: 2550,
    heightPx: 3300,
    dpi: 300,
    safeMarginPx: 75,
    bleedPx: 38,
    artifactKinds: Object.freeze(["pdf", "png", "jpeg"] as SpecializedArtifactKind[]),
  }),
]);

export function creativeTargetPreset(id: string): CreativeTargetSpec | undefined {
  return CREATIVE_TARGET_PRESETS.find((target) => target.id === id);
}

export function createMultiTargetReflowProposal(input: {
  source: SpecializedDocument;
  targets: readonly CreativeTargetSpec[];
  brandKit?: BrandKit;
  now?: string;
}): CreativeMultiTargetProposal {
  const createdAt = timestamp(input.now ?? new Date().toISOString());
  if (!input.targets.length) throw new Error("Multi-target reflow requires at least one target.");

  const targetIds = new Set<string>();
  const variants = input.targets.map((targetInput) => {
    const target = validateCreativeTargetSpec(targetInput);
    if (targetIds.has(target.id)) throw new Error(`Duplicate creative target id \"${target.id}\".`);
    targetIds.add(target.id);
    return reflowToTarget(input.source, target, input.brandKit, createdAt);
  });

  return Object.freeze({
    sourceDocumentId: input.source.id,
    sourceProjectId: input.source.projectId,
    createdAt,
    persisted: false as const,
    variants: Object.freeze(variants),
  });
}

export function validateCreativeTargetSpec(value: CreativeTargetSpec): CreativeTargetSpec {
  const id = identifier(value.id, "Creative target id");
  const label = requiredText(value.label, "Creative target label", 240);
  if (value.targetClass !== "digital" && value.targetClass !== "print") throw new Error("Creative target class must be digital or print.");
  const widthPx = positiveInteger(value.widthPx, "Creative target width");
  const heightPx = positiveInteger(value.heightPx, "Creative target height");
  const dpi = positiveInteger(value.dpi, "Creative target DPI");
  if (dpi < 72 || dpi > 1200) throw new Error("Creative target DPI must be between 72 and 1200.");
  const safeMarginPx = nonNegativeInteger(value.safeMarginPx, "Creative target safe margin");
  const bleedPx = nonNegativeInteger(value.bleedPx, "Creative target bleed");
  if (safeMarginPx * 2 >= widthPx || safeMarginPx * 2 >= heightPx) throw new Error("Creative target safe margin leaves no usable canvas.");
  if (bleedPx * 2 >= widthPx || bleedPx * 2 >= heightPx) throw new Error("Creative target bleed leaves no usable canvas.");
  if (!Array.isArray(value.artifactKinds) || !value.artifactKinds.length) throw new Error("Creative target requires at least one artifact kind.");
  const allowed = new Set<SpecializedArtifactKind>(["pdf", "svg", "png", "jpeg", "cbz", "json", "csv"]);
  const artifactKinds = value.artifactKinds.map((kind) => {
    if (!allowed.has(kind)) throw new Error(`Unsupported creative target artifact kind \"${String(kind)}\".`);
    return kind;
  });
  if (value.targetClass === "digital" && bleedPx !== 0) throw new Error("Digital creative targets must not declare print bleed.");

  return Object.freeze({
    id,
    label,
    targetClass: value.targetClass,
    widthPx,
    heightPx,
    dpi,
    safeMarginPx,
    bleedPx,
    artifactKinds: Object.freeze([...new Set(artifactKinds)]),
  });
}

function reflowToTarget(
  source: SpecializedDocument,
  target: CreativeTargetSpec,
  brandKit: BrandKit | undefined,
  now: string,
): CreativeTargetVariant {
  const widthInches = target.widthPx / target.dpi;
  const heightInches = target.heightPx / target.dpi;
  const safeMarginInches = target.safeMarginPx / target.dpi;
  const bleedInches = target.bleedPx / target.dpi;
  const issues: CreativeReflowIssue[] = [];

  const surfaces = source.surfaces.map((surface) =>
    reflowSurface(surface, target, widthInches, heightInches, safeMarginInches, bleedInches, issues),
  );

  const document: SpecializedDocument = Object.freeze({
    ...source,
    id: `${source.id}-${target.id}-${randomUUID()}`,
    title: `${source.title} — ${target.label}`,
    surfaces: Object.freeze(surfaces),
    styleTokens: Object.freeze({
      ...source.styleTokens,
      "forge.target.id": target.id,
      "forge.target.widthPx": target.widthPx,
      "forge.target.heightPx": target.heightPx,
      "forge.target.dpi": target.dpi,
    }),
    createdAt: now,
    updatedAt: now,
  });

  const profile: SpecializedProductionProfile = Object.freeze({
    formatVersion: SPECIALIZED_PRODUCTION_PROFILE_VERSION,
    id: `target-${target.id}`,
    label: target.label,
    widthInches,
    heightInches,
    bleedInches,
    safeMarginInches,
    dpi: target.dpi,
    colorIntent: "sRGB",
    artifactKinds: Object.freeze([...target.artifactKinds]),
    duplex: false,
    notes: Object.freeze([
      `Derived from editable Forge document ${source.id}.`,
      `Exact raster target: ${target.widthPx} × ${target.heightPx} at ${target.dpi} DPI.`,
      "Review each candidate before persistence or export.",
    ]),
  });

  const brandCompliance = brandKit
    ? auditBrandCompliance(brandKit, document, now)
    : undefined;
  if (brandCompliance && !brandCompliance.compliant) {
    issues.push({
      severity: "error",
      code: "brand-compliance",
      message: "The resized candidate violates one or more active Brand Kit constraints.",
    });
  }

  return Object.freeze({
    target,
    document,
    profile,
    issues: Object.freeze(issues),
    ...(brandCompliance ? { brandCompliance } : {}),
    readyForAuthorReview: !issues.some((issue) => issue.severity === "error"),
  });
}

function reflowSurface(
  source: SpecializedSurface,
  target: CreativeTargetSpec,
  widthInches: number,
  heightInches: number,
  safeMarginInches: number,
  bleedInches: number,
  issues: CreativeReflowIssue[],
): SpecializedSurface {
  const sourceSafe = safeBox(source.widthInches, source.heightInches, source.safeMarginInches);
  const targetSafe = safeBox(widthInches, heightInches, safeMarginInches);
  if (sourceSafe.width <= 0 || sourceSafe.height <= 0) {
    throw new Error(`Source surface \"${source.id}\" has no usable safe area.`);
  }

  const scale = Math.min(targetSafe.width / sourceSafe.width, targetSafe.height / sourceSafe.height);
  const fittedWidth = sourceSafe.width * scale;
  const fittedHeight = sourceSafe.height * scale;
  const offsetX = targetSafe.x + (targetSafe.width - fittedWidth) / 2 - sourceSafe.x * scale;
  const offsetY = targetSafe.y + (targetSafe.height - fittedHeight) / 2 - sourceSafe.y * scale;
  const sourceAspect = sourceSafe.width / sourceSafe.height;
  const targetAspect = targetSafe.width / targetSafe.height;
  const aspectStress = Math.max(sourceAspect / targetAspect, targetAspect / sourceAspect);

  if (aspectStress >= 1.35) {
    issues.push({
      severity: "warning",
      code: "aspect-ratio-review",
      message: `Target ${target.label} changes the safe-area aspect ratio substantially; review whitespace and hierarchy manually.`,
      surfaceId: source.id,
    });
  }

  const elements = source.elements.map((element) => {
    const transformed = transformElement(element, scale, offsetX, offsetY);
    auditElementBounds(transformed, source.id, widthInches, heightInches, safeMarginInches, issues);
    return transformed;
  });

  return Object.freeze({
    ...source,
    id: `${source.id}-${target.id}`,
    label: `${source.label} — ${target.label}`,
    widthInches,
    heightInches,
    bleedInches,
    safeMarginInches,
    elements: Object.freeze(elements),
  });
}

function transformElement(
  element: SpecializedElement,
  scale: number,
  offsetX: number,
  offsetY: number,
): SpecializedElement {
  const nextFontSize = element.style.fontSizePt === undefined
    ? undefined
    : round(element.style.fontSizePt * scale);

  return Object.freeze({
    ...element,
    box: Object.freeze({
      x: round(element.box.x * scale + offsetX),
      y: round(element.box.y * scale + offsetY),
      width: round(element.box.width * scale),
      height: round(element.box.height * scale),
    }),
    style: Object.freeze({
      ...element.style,
      ...(nextFontSize === undefined ? {} : { fontSizePt: nextFontSize }),
    }),
    metadata: Object.freeze({ ...element.metadata }),
  });
}

function auditElementBounds(
  element: SpecializedElement,
  surfaceId: string,
  widthInches: number,
  heightInches: number,
  safeMarginInches: number,
  issues: CreativeReflowIssue[],
): void {
  const epsilon = 0.002;
  const right = element.box.x + element.box.width;
  const bottom = element.box.y + element.box.height;
  if (
    element.box.x < -epsilon ||
    element.box.y < -epsilon ||
    right > widthInches + epsilon ||
    bottom > heightInches + epsilon
  ) {
    issues.push({
      severity: "error",
      code: "canvas-overflow",
      message: `Element \"${element.id}\" extends beyond the target canvas.`,
      surfaceId,
      elementId: element.id,
    });
    return;
  }

  const safeRight = widthInches - safeMarginInches;
  const safeBottom = heightInches - safeMarginInches;
  if (
    element.box.x < safeMarginInches - epsilon ||
    element.box.y < safeMarginInches - epsilon ||
    right > safeRight + epsilon ||
    bottom > safeBottom + epsilon
  ) {
    issues.push({
      severity: "warning",
      code: "safe-zone-review",
      message: `Element \"${element.id}\" reaches outside the target safe zone and needs author review.`,
      surfaceId,
      elementId: element.id,
    });
  }
}

function safeBox(width: number, height: number, margin: number): { x: number; y: number; width: number; height: number } {
  return {
    x: margin,
    y: margin,
    width: width - margin * 2,
    height: height - margin * 2,
  };
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer.`);
  return value;
}

function nonNegativeInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer.`);
  return value;
}

function identifier(value: string, label: string): string {
  const result = String(value ?? "").trim();
  if (!/^[A-Za-z0-9_-]+$/.test(result)) throw new Error(`${label} may contain only letters, numbers, underscore, and hyphen.`);
  return result;
}

function requiredText(value: string, label: string, maxLength: number): string {
  const result = String(value ?? "").trim();
  if (!result) throw new Error(`${label} is required.`);
  if (result.length > maxLength) throw new Error(`${label} exceeds ${maxLength} characters.`);
  return result;
}

function timestamp(value: string): string {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error("Creative target timestamp must be valid ISO date-time text.");
  return new Date(ms).toISOString();
}

function round(value: number): number {
  return Math.round(value * 100_000) / 100_000;
}

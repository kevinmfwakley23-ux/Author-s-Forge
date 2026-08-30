import type { SpecializedCreationMode } from "./specialized-creation";

export const SPECIALIZED_PRODUCTION_FORMAT_VERSION = "1.0.0" as const;

export type ProductionArtifactKind = "print-pdf" | "png" | "jpeg" | "svg" | "cbz" | "data";

export type ProductionSpec = {
  mode: SpecializedCreationMode;
  widthInches: number;
  heightInches: number;
  bleedInches: number;
  safeMarginInches: number;
  dpi: number;
  colorProfile: "sRGB" | "CMYK";
  allowedArtifacts: ProductionArtifactKind[];
};

export type ProductionValidationIssue = {
  code: "INVALID_DIMENSIONS" | "INVALID_BLEED" | "INVALID_SAFE_MARGIN" | "INVALID_DPI" | "UNSUPPORTED_ARTIFACT";
  message: string;
  blocking: boolean;
};

export function createProductionSpec(mode: SpecializedCreationMode, input: Omit<ProductionSpec, "mode" | "allowedArtifacts">): ProductionSpec {
  const allowedArtifacts: Record<SpecializedCreationMode, ProductionArtifactKind[]> = {
    "comic-book": ["print-pdf", "png", "jpeg", "cbz"],
    "greeting-card": ["print-pdf", "png", "jpeg"],
    "birthday-card": ["print-pdf", "png", "jpeg"],
    invitation: ["print-pdf", "png", "jpeg"],
    flyer: ["print-pdf", "png", "jpeg", "svg"],
    "trading-card-game": ["print-pdf", "png", "jpeg", "svg", "data"],
  };
  return { formatVersion: SPECIALIZED_PRODUCTION_FORMAT_VERSION, ...input, mode, allowedArtifacts: allowedArtifacts[mode] } as ProductionSpec;
}

export function validateProductionSpec(spec: ProductionSpec, artifact?: ProductionArtifactKind): ProductionValidationIssue[] {
  const issues: ProductionValidationIssue[] = [];
  if (spec.widthInches <= 0 || spec.heightInches <= 0) issues.push({ code: "INVALID_DIMENSIONS", message: "Production dimensions must be positive.", blocking: true });
  if (spec.bleedInches < 0) issues.push({ code: "INVALID_BLEED", message: "Bleed cannot be negative.", blocking: true });
  if (spec.safeMarginInches < spec.bleedInches) issues.push({ code: "INVALID_SAFE_MARGIN", message: "Safe margin must be at least the bleed allowance.", blocking: true });
  if (!Number.isInteger(spec.dpi) || spec.dpi < 300) issues.push({ code: "INVALID_DPI", message: "Print production requires at least 300 DPI.", blocking: true });
  if (artifact && !spec.allowedArtifacts.includes(artifact)) issues.push({ code: "UNSUPPORTED_ARTIFACT", message: `${artifact} is not supported for ${spec.mode}.`, blocking: true });
  return issues;
}
